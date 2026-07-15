# Active V2 Shadow Comparison V1 Design

## Status

Approved design direction for the next Equinox data-governance phase. This document is a specification only. It must not execute MongoDB writes, change production traffic, alter Render configuration, or introduce rollout behavior.

## Objective

Execute the same mandatory scenarios through the current Equinox engine logic with a controlled baseline source and the active V2 staging path, then produce structured, reproducible differences without exposing V2 to users or changing production behavior.

This phase answers one question:

```text
Can the current engine logic and active V2 staging path execute the same scenarios in an observable, traceable, comparable way?
```

It does not answer the later rollout question:

```text
What level of competitive divergence is acceptable for production?
```

Strict competitive thresholds are out of scope for this phase and belong to a later phase, tentatively named `Active V2 Competitive Acceptance Gates V1`.

## Core Decision

Build an isolated shadow comparison runner.

For each mandatory scenario, the runner must:

```text
execute baseline path with current engine logic and controlled source
execute active V2 staging path
use the same input
record both complete outputs
calculate structured differences
write no data
change no traffic
```

The runner may report divergences. Divergence by itself must not fail the phase. The phase fails only when one of the mandatory execution, traceability, safety, or reproducibility gates is violated.

## Non-Negotiable Constraints

- The phase is read-only.
- No Render changes.
- No production traffic changes.
- No frontend behavior changes.
- No public API behavior changes.
- No MongoDB writes.
- No reads from the production collection `pokemonsets`.
- No writes to `pokemonsets_v2_staging`.
- No local pilot fallback may mask a failed mandatory scenario.
- The V2 source collection is exactly `pokemonsets_v2_staging`.
- The V2 record filter is exactly `status=active + active=true + allowlist`.
- The baseline must exercise current engine logic with V2 homologation flags disabled, using a controlled, versioned baseline source instead of reading `pokemonsets`.
- The active V2 path must use the same active staging source and guardrails proven by `Active Staging Functional Homologation V1`.

## Dedicated Shadow Flags

Use flags separate from rollout and from the previous homologation command:

```text
EQUINOX_ENABLE_ACTIVE_V2_SHADOW_COMPARISON=true
EQUINOX_ACTIVE_V2_SHADOW_COLLECTION=pokemonsets_v2_staging
EQUINOX_ACTIVE_V2_SHADOW_READ_ONLY=true
EQUINOX_DATA_MODE=mongo
EQUINOX_ALLOW_DATABASE_WRITES=false
```

The shadow comparison command must fail before Mongo access when any required flag is missing or invalid.

Do not reuse rollout flags such as:

```text
EQUINOX_ENABLE_COMPETITIVE_DATA_V2
```

This phase must not accidentally enable the V2 path for normal requests.

## Baseline Path Definition

The baseline must exercise the current engine logic, but it must not access the production Mongo collection.

A controlled and versioned baseline source must be injected explicitly. Use of this source is intentional baseline configuration and must not be reported as fallback.

The baseline flow is:

```text
current engine orchestration
+ controlled baseline source
```

Required properties:

```text
active V2 homologation flags disabled
active V2 shadow flags disabled for baseline execution
no active staging source injected into baseline
no production Mongo collection access
controlled baseline source injected explicitly
same services, functions, and current engine orchestration where practical
not a handcrafted approximation of the output
```

The baseline result must be labeled:

```text
path: current
baselineEnginePath: current
baselineSourceKind: controlled-snapshot
baselineFallbackUsed: false
```

The baseline source must be versioned and reproducible:

```text
baselineSourceVersion
baselineSourceDigest: sha256-...
baselineSourceRecordCount
```

The digest must be computed from the canonical serialized baseline source used by the comparison. The implementation plan must define the exact canonicalization step before hashing.

The spec forbids silently replacing current engine logic with a handcrafted output approximation. It also forbids reading `pokemonsets` to make the baseline more "real"; production remains fully outside the runner.

## Active V2 Staging Path Definition

The active V2 staging path must read the four active allowlisted records from MongoDB staging and inject them explicitly into the comparison path.

Required V2 filter:

```ts
{
  status: 'active',
  active: true,
  setId: { $in: activeV2ShadowAllowlist }
}
```

Required V2 collection:

```text
pokemonsets_v2_staging
```

The V2 result must be labeled:

```text
path: active-v2-staging
activeV2EnginePath: current-with-explicit-v2-context
sourceMode: mongo-staging-active
activeV2SourceKind: mongo-active-staging
activeV2SourceCollection: pokemonsets_v2_staging
activeV2FallbackUsed: false
competitiveVerificationState: staging-controlled
```

## Allowlist

The active V2 shadow allowlist is exactly the four active staging records:

```text
sinistcha-bulky-trick-room-setter-draft
aggronmega-slow-physical-breaker-draft
incineroar-bulky-slow-pivot-draft
ursalunabloodmoon-slow-special-breaker-draft
```

The runner must fail when the V2 path reads:

```text
fewer than 4 active allowlisted records
more than 4 active allowlisted records
any setId outside the allowlist
any sourceType generated record
any record not active
any record not status active
records with different activeRunId values
```

## Mandatory Scenarios

Use the same four scenarios already homologated:

```text
Sinistcha + Aggron-Mega
Incineroar + Ursaluna-Bloodmoon
Sinistcha + Incineroar
Aggron-Mega + Ursaluna-Bloodmoon
```

Each scenario must use identical execution inputs on both sides:

```text
sameScenarioInput: true
sameFormat: true
sameTeamIdentity: true
sameAllowLegendaries: true
sameSeed: true, when controllable randomness exists
```

If the current path cannot accept an explicit seed because it has no controllable randomness, the report must state:

```text
sameSeed: not-applicable
randomnessControl: unavailable-no-randomness-observed
```

The runner must fail when inputs differ between baseline and V2.

## Per-Scenario Result Shape

Each scenario must produce three top-level blocks:

```ts
{
  scenarioId: string;
  baselineResult: ShadowPathResult;
  activeV2Result: ShadowPathResult;
  comparison: ShadowScenarioComparison;
}
```

`baselineResult` and `activeV2Result` must include at least:

```text
path
sourceMode
enginePath
sourceKind
inputPokemon
format
teamIdentity
allowLegendaries
seedState
setsConsumed
movesUsed
itemsUsed
abilitiesUsed
roles
leadStrategies
selectedLeadStrategy
teamDataCoverage
fullTeamEvaluation
score
fallbackUsed
fallbackReason
exportResult
errors
durationMs
competitiveVerificationState
```

The `comparison` block must include at least:

```text
sameScenarioInput
sameFormat
sameTeamIdentity
sameAllowLegendaries
sameSeed
setDiff
moveDiff
itemDiff
abilityDiff
roleDiff
leadStrategyDiff
teamDataCoverageDiff
fullTeamEvaluationDiff
scoreDiff
fallbackDiff
exportDiff
latencyDiffMs
latencyDeltaPercent
errors
criticalFieldsPresent
differencesFullyRecorded
```

## Diff Semantics

The comparison must be structured, not prose-only.

Each diff block should follow this shape:

```ts
{
  status: 'equal' | 'different' | 'missing-baseline' | 'missing-active-v2' | 'error';
  baseline: unknown;
  activeV2: unknown;
  added: unknown[];
  removed: unknown[];
  changed: Array<{
    field: string;
    baseline: unknown;
    activeV2: unknown;
  }>;
}
```

The implementation may use specialized typed diffs for fields such as moves, items, roles, and scores, but the output must remain machine-readable.

The field `differencesFullyRecorded` must be derived from the presence and execution of every required comparator, not manually assigned.

Required comparator blocks:

```text
setDiff
moveDiff
itemDiff
abilityDiff
roleDiff
leadStrategyDiff
teamDataCoverageDiff
fullTeamEvaluationDiff
scoreDiff
fallbackDiff
exportDiff
latencyDiffMs
errorDiff
```

Every comparator block must be present even when there is no divergence. Equal results must still be represented explicitly:

```json
{
  "moveDiff": {
    "status": "equal",
    "baseline": [],
    "activeV2": [],
    "added": [],
    "removed": [],
    "changed": []
  }
}
```

`differencesFullyRecorded` may be `true` only when all required comparator blocks are present and were executed.

## Failure Criteria

The phase must fail when any condition is true:

```text
baseline path fails to execute current engine logic
active V2 staging path fails to execute
fallback masks a mandatory scenario failure
baseline and V2 inputs differ
baseline source version is missing
baseline source digest is missing or malformed
baseline source record count is missing
V2 reads data outside the allowlist
V2 reads any generated active record
V2 reads any non-active record
V2 reads from pokemonsets
any Mongo write command is observed
any write to pokemonsets_v2_staging is observed
any write to pokemonsets is observed
any comparison block is missing
any critical field is absent from baselineResult
any critical field is absent from activeV2Result
any difference is detected but not represented in comparison
any required comparator block is missing
differencesFullyRecorded is false
results are not reproducible for the same input and source state
targetCollection is not pokemonsets_v2_staging
```

The phase must not fail only because:

```text
recommended sets differ
moves differ
items differ
abilities differ
roles differ
lead strategies differ
scores differ
latency differs
exports differ
```

Those differences are expected evidence for review, unless they also violate a mandatory safety or traceability gate.

Latency differences are evidence only in V1. Timeouts and incomplete executions remain gate failures.

## Aggregate Report

The command output must include an aggregate block with:

```text
mode
targetCollection
activeRunId
baselineSourceVersion
baselineSourceDigest
baselineSourceRecordCount
scenarioCount
scenariosCompared
scenariosWithBaselineExecution
scenariosWithActiveV2Execution
scenariosWithSameInput
scenariosWithRecordedDifferences
baselineFallbackUsed
activeV2FallbackUsed
activeV2SourceCollection
activeV2RecordsLoaded
localPilotFallbackUsed
productionCollectionReads
observedMongoWriteCommands
observedStagingWriteCommands
observedProductionWriteCommands
productionWrites
recordsWritten
criticalFieldFailures
unrecordedDifferenceFailures
sameEngineComponents
sameScenarioInput
sameFormat
sameTeamIdentity
sameAllowLegendaries
sameSeed
readyForCompetitiveAcceptanceGate
```

`readyForCompetitiveAcceptanceGate` means the comparison evidence is complete enough for the next phase. It does not mean the V2 output is competitively approved.

## Observability And Output

The runner must output:

```text
machine-readable JSON
concise scalar summary lines
per-scenario baselineResult
per-scenario activeV2Result
per-scenario comparison
aggregate safety counters
```

The output must not include:

```text
MongoDB URI
username
password
tokens
connection strings
raw environment variable dumps
```

## Exit Codes

Use deterministic exit codes:

```text
0: shadow comparison completed and all safety/traceability gates passed
1: comparison gate failed
2: invalid configuration or environment
3: Mongo connection or read failure
```

Differences between baseline and V2 do not force exit code `1` when they are fully recorded and no safety gate fails.

## Testing Strategy

Local non-Mongo validation:

```text
contract tests for result and diff shapes
config tests for required flags
baseline path tests proving V2 flags remain disabled and the controlled source exercises current engine logic
baseline source tests proving version, digest, record count, and no production reads
comparison tests proving differences are recorded rather than hidden
failure tests for missing comparison fields
exit-code tests for config and gate failures
```

Mongo read-only validation:

```text
V2 path reads only pokemonsets_v2_staging
V2 path reads exactly 4 active allowlisted records
baseline path reads only the controlled baseline source
productionCollectionReads remains 0
observedMongoWriteCommands remains 0
recordsWritten remains 0
productionWrites remains 0
Mongo connections close in finally
```

Recommended final commands after implementation:

```powershell
npm.cmd run typecheck
npm.cmd run sets:active-v2-shadow:contracts:check
npm.cmd run sets:active-v2-shadow:config:check
npm.cmd run sets:active-v2-shadow:offline:check
npm.cmd run sets:active-v2-shadow:compare
npm.cmd run build
git diff --check
```

## Report

Create a final evidence report:

```text
docs/data-audit/active-v2-shadow-comparison-v1-report.md
```

The report must summarize:

```text
date
commit
target collection
activeRunId
baselineSourceVersion
baselineSourceDigest
baselineSourceRecordCount
scenario count
per-scenario comparison result
all safety counters
whether differences were fully recorded
whether the evidence is ready for competitive acceptance gates
```

No secret, URI, username, password, or connection string may be included.

## Out Of Scope

This phase does not include:

```text
competitive divergence thresholds
automatic approval or rejection of V2 quality
production rollout
Render changes
frontend changes
public API behavior changes
writes to pokemonsets
writes to pokemonsets_v2_staging
promotion from active staging to production
removal of local pilot fallback code
```

## Completion Criteria

The phase is complete only when:

```text
spec approved
implementation plan created
shadow comparison runner implemented
current path and active V2 path execute the four mandatory scenarios
each scenario emits baselineResult, activeV2Result, and comparison
all differences are structured and recorded
Mongo writes remain 0
production collection reads remain 0
local fallback does not mask mandatory scenarios
final evidence report is produced
```
