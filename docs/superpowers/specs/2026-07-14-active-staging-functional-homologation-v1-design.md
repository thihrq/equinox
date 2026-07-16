# Active Staging Functional Homologation V1 Design

## Status

Approved design for the next Equinox data-governance phase. This document is a specification only. It must not execute MongoDB writes, change production traffic, or alter Render configuration.

## Objective

Prove that the Equinox recommendation engine can consume only the four `active` records from `pokemonsets_v2_staging` in MongoDB staging, without changing production behavior or masking failures with the local pilot pack.

## Core Decision

Use an isolated, read-only staging source injected explicitly into the homologation path.

This phase must not modify the default behavior of:

```text
CompetitiveSetRepository
MongoCompetitiveSetSource
LeadStrategyRecommendationService
```

Default flow remains unchanged when homologation flags are disabled. Homologation flow is enabled only by dedicated staging flags and must read from `pokemonsets_v2_staging` directly.

## Non-Negotiable Constraints

- Target collection is exactly `pokemonsets_v2_staging`.
- Production collection `pokemonsets` is not writable and must not be used as the homologation source.
- The source is read-only by interface and by runtime guard.
- No insert, update, delete, bulkWrite, save, or write-capable method may be exposed by the active staging source.
- Mongo writes must remain disabled: `EQUINOX_ALLOW_DATABASE_WRITES=false`.
- The local pilot pack must not be used as a silent substitute in mandatory scenarios.
- The phase does not change Render, production flags, production traffic, or production data collections.

## Dedicated Homologation Flags

The homologation path uses flags separate from future rollout flags:

```text
EQUINOX_ENABLE_ACTIVE_STAGING_HOMOLOGATION=true
EQUINOX_ACTIVE_STAGING_COLLECTION=pokemonsets_v2_staging
EQUINOX_ACTIVE_STAGING_READ_ONLY=true
EQUINOX_DATA_MODE=mongo
EQUINOX_ALLOW_DATABASE_WRITES=false
```

The homologation script must fail immediately when any of these is false or missing:

```text
EQUINOX_ENABLE_ACTIVE_STAGING_HOMOLOGATION=true
EQUINOX_ACTIVE_STAGING_COLLECTION=pokemonsets_v2_staging
EQUINOX_ACTIVE_STAGING_READ_ONLY=true
EQUINOX_DATA_MODE=mongo
EQUINOX_ALLOW_DATABASE_WRITES=false
```

Do not reuse rollout-oriented flags such as `EQUINOX_ENABLE_COMPETITIVE_DATA_V2`. Homologation and rollout are separate phases.

## Read-Only Source Contract

Introduce a read-only contract equivalent to:

```ts
export interface CompetitiveSetReadSource<TSet> {
  findActiveSets(input: ActiveStagingSetQuery): Promise<ActiveStagingSetLoadResult<TSet>>;
}
```

The contract may expose read methods only. It must not expose:

```text
insert
update
delete
bulkWrite
save
```

The active staging implementation must query the collection by name through the Mongo connection, not by silently inheriting the default `PokemonSet` model collection.

Required collection name:

```text
pokemonsets_v2_staging
```

## Strict Document Selection

The Mongo query must require all of the following at the same time:

```ts
{
  status: 'active',
  active: true,
  setId: { $in: homologationAllowlist }
}
```

The loader must reject the read result when any of these conditions occur:

```text
activeRecordsRead !== 4
setId outside allowlist
sourceType === generated
missing activeRunId
more than one activeRunId across the four records
missing expected setId
collection !== pokemonsets_v2_staging
readOnly !== true
dataMode !== mongo
```

## Homologation Allowlist

The active staging homologation allowlist is exactly:

```text
sinistcha-bulky-trick-room-setter-draft
aggronmega-slow-physical-breaker-draft
incineroar-bulky-slow-pivot-draft
ursalunabloodmoon-slow-special-breaker-draft
```

The source must report the loaded set IDs and the shared `activeRunId`.

## Engine Isolation

The implementation must avoid conditionals scattered through the engine. Preferred flow:

```text
homologation flags disabled
  -> current engine behavior remains unchanged

homologation flags enabled
  -> ActiveStagingCompetitiveSetSource
  -> read-only staging repository/adapter
  -> homologation runner
  -> recommendation engine execution with explicit active staging context
```

The homologation runner must pass active staging records explicitly to the motor path being tested. It must not mutate global engine behavior for normal requests.

## Pilot Pack Fallback Contract

The local pilot pack may remain in the repository for existing shadow and fixture workflows. It may also be reported as an emergency fallback signal.

For the mandatory homologation scenarios, fallback is not allowed:

```text
engineUsesMongoStagingActive: true
localPilotFallbackUsed: false
```

If the motor uses the local pilot pack instead of the four active Mongo staging records, the mandatory homologation must fail.

If the active staging source fails, returns an incomplete package, or cannot resolve any requested set ID, the mandatory scenario must stop immediately. The runner may report whether local fallback was available, but it must not execute any mandatory scenario with that fallback.

Required failure behavior:

```text
Mongo staging failed
-> scenario failed
-> localPilotFallbackUsed: false
-> localPilotFallbackAvailable: true/false
```

Forbidden behavior:

```text
Mongo staging failed
-> use pilot pack
-> execute mandatory scenario
-> fail only in final aggregate report
```

This is the central proof of the phase.

## Homologation Script

Create a dedicated script rather than changing the meaning of the older staging check:

```text
src/scripts/validateActiveStagingFunctionalHomologation.ts
```

Add an npm command:

```text
sets:active-staging:functional-homologate
```

The existing `validateStagingHomologation.ts` may remain available for previous-stage checks. It must not be silently repurposed in a way that makes historical reports ambiguous.

## Package State Gates

The new functional homologation must distinguish package loading from scenario presentation.

Repository/package-level gates:

```text
activeRecordsRead: 4
activeRecordsAvailable: 4
activeRecordsLoadedByRepository: 4
uniqueActiveRecordsAvailableToHomologation: 4
allowlistedActive: 4
allowlistedVerified: 0
blockedRecordsStillReviewed: 5
blockedRecordsActive: 0
generatedActiveConsumed: 0
activeConflicts: 0
sameActiveRunIdForAllowlist: true
```

Scenario-presentation gates:

```text
activeRecordsPresentedToEnginePerScenario: 2
requestedSetsPresentedToEnginePerScenario: 2
uniqueActiveRecordsPresentedAcrossAllScenarios: 4
reviewedRecordsPresentedToEngine: 0
generatedRecordsPresentedToEngine: 0
localPilotFallbackUsed: false
```

The repository must load and validate all four allowlisted active records once. Each mandatory scenario must present exactly the two requested active records to the engine context. Across the complete homologation run, all four unique active records must have been presented in at least one mandatory scenario.

Isolation and write-observation gates:

```text
productionCollectionReads: 0
observedMongoWriteCommands: 0
observedStagingWriteCommands: 0
observedProductionWriteCommands: 0
productionWrites: 0
recordsWritten: 0
```

## Functional Scenarios

Run these four mandatory scenarios:

```text
Sinistcha + Aggron-Mega
Incineroar + Ursaluna-Bloodmoon
Sinistcha + Incineroar
Aggron-Mega + Ursaluna-Bloodmoon
```

Each scenario must report:

```text
scenarioId
input Pokemon names
requestedSetCount
requestedSetIds
mongoRequestedSetsFound
setIds read from Mongo
shared activeRunId
source of each set
requestedSetsPresentedToEngine
sets presented to engine
sets effectively used by the recommendation
requestedSetsAppliedToTeamData
fallback triggered or not
localPilotFallbackAvailable
TeamDataCoverage
competitiveVerificationState
export result
query duration
scenario total duration
expectedActiveV2SetsResolvedFromMongo
expectedActiveV2SetsPresentedToEngine
expectedActiveV2SetsAppliedToTeamData
recommendationContainsExpectedActiveV2, only when the exported result contract actually exposes consumed set IDs
```

The central per-scenario gate is not that input Pokemon appear as recommendations. The gate is that all requested set IDs were read from Mongo staging, presented to the engine, used when building TeamDataCoverage or the competitive context, and traceable in final scenario evidence.

`recommendationContainsExpectedActiveV2` may be reported only when the result/export contract really includes the consumed set IDs. It must not be the primary gate for scenarios where the requested Pokemon are inputs rather than recommended outputs.

Example scenario result shape:

```ts
{
  scenarioId: 'sinistcha-aggronmega',
  requestedSetCount: 2,
  requestedSetIds: [
    'sinistcha-bulky-trick-room-setter-draft',
    'aggronmega-slow-physical-breaker-draft'
  ],
  mongoRequestedSetsFound: 2,
  requestedSetsPresentedToEngine: 2,
  requestedSetsAppliedToTeamData: 2,
  activeV2SetsConsumed: [
    'sinistcha-bulky-trick-room-setter-draft',
    'aggronmega-slow-physical-breaker-draft'
  ],
  expectedActiveV2SetsResolvedFromMongo: true,
  expectedActiveV2SetsPresentedToEngine: true,
  expectedActiveV2SetsAppliedToTeamData: true,
  engineUsesMongoStagingActive: true,
  localPilotFallbackUsed: false,
  competitiveVerificationState: 'staging-controlled'
}
```

## Competitive Verification State Contract

For this phase, do not model staging approval as a truthy boolean. Use a domain state:

```ts
type CompetitiveVerificationState =
  | 'unverified'
  | 'staging-controlled'
  | 'production-approved';
```

Required value for this phase:

```text
competitiveVerificationState: staging-controlled
```

Meaning:

```text
the data has been verified and activated in staging, but it has not been approved for production rollout.
```

This avoids consumers treating a string such as `controlled-true` as truthy production approval. This phase must not represent staging homologation as full production approval. A later rollout phase may promote the external behavior to:

```text
competitiveVerificationState: production-approved
```

## Immediate Failure Criteria

Stop and fail homologation when any condition is true:

```text
activeRecordsRead !== 4
activeRecordsLoadedByRepository !== 4
uniqueActiveRecordsAvailableToHomologation !== 4
activeRecordsPresentedToEnginePerScenario !== 2
uniqueActiveRecordsPresentedAcrossAllScenarios !== 4
requestedSetCount !== 2 in any mandatory scenario
mongoRequestedSetsFound !== 2 in any mandatory scenario
requestedSetsPresentedToEngine !== 2 in any mandatory scenario
requestedSetsAppliedToTeamData !== 2 in any mandatory scenario
reviewedRecordsConsumed > 0
reviewedRecordsPresentedToEngine > 0
generatedActiveConsumed > 0
generatedRecordsPresentedToEngine > 0
localPilotFallbackUsed === true in any mandatory scenario
targetCollection !== pokemonsets_v2_staging
productionCollectionReads > 0
observedMongoWriteCommands > 0
observedStagingWriteCommands > 0
observedProductionWriteCommands > 0
productionWrites > 0
activeRunIds are distinct
any expected setId is missing
expectedActiveV2SetsResolvedFromMongo !== true in any mandatory scenario
expectedActiveV2SetsPresentedToEngine !== true in any mandatory scenario
expectedActiveV2SetsAppliedToTeamData !== true in any mandatory scenario
competitiveVerificationState !== staging-controlled in any mandatory scenario
```

## Observability Requirements

The homologation output must be machine-readable JSON plus concise scalar summary lines, following the existing operational script style.

Required aggregate fields:

```text
mode
mongoRead
targetCollection
activeRunId
activeRecordsAvailable
activeRecordsLoadedByRepository
uniqueActiveRecordsAvailableToHomologation
activeRecordsPresentedToEnginePerScenario
uniqueActiveRecordsPresentedAcrossAllScenarios
reviewedRecordsPresentedToEngine
generatedRecordsPresentedToEngine
localPilotFallbackUsed
scenarioCount
scenariosPassed
productionCollectionReads
observedMongoWriteCommands
observedStagingWriteCommands
observedProductionWriteCommands
productionWrites
recordsWritten
```

Required per-scenario fields:

```text
scenarioId
inputPokemon
requestedSetCount
requestedSetIds
mongoRequestedSetsFound
mongoSetIdsRead
activeRunId
activeRunIdMatchesPackage
setSources
requestedSetsPresentedToEngine
setsPresentedToEngine
setsUsedByRecommendation
requestedSetsAppliedToTeamData
reviewedSetsPresentedToEngine
generatedSetsPresentedToEngine
localPilotFallbackUsed
localPilotFallbackAvailable
teamDataCoverage
competitiveVerificationState
exportResult
queryDurationMs
totalDurationMs
expectedActiveV2SetsResolvedFromMongo
expectedActiveV2SetsPresentedToEngine
expectedActiveV2SetsAppliedToTeamData
recommendationContainsExpectedActiveV2
observedMongoWriteCommands
passed
```

The output must not include MongoDB URI, username, password, tokens, or connection strings.

## Testing Strategy

Local non-Mongo validation:

- Typecheck must pass.
- Homologation command without required Mongo/read-only flags must fail before Mongo access.
- Homologation command in non-Mongo mode must not pretend success for mandatory scenarios.

Mongo read-only validation:

- `EQUINOX_ALLOW_DATABASE_WRITES=false` is required.
- The script reads only `pokemonsets_v2_staging`.
- The script fails if the active records are missing or if any mandatory scenario would need the local pilot pack.
- The script verifies no writes occurred during the run by command observation, not only by an internal script counter.
- Mongo command monitoring, a repository spy, or an equivalent wrapper must record every `insert`, `update`, `delete`, `replace`, `findAndModify`, `bulkWrite`, or transaction write command issued by the homologation process.
- The run fails when the observed write-command count is greater than zero.
- Production collection reads must be observed and reported as `productionCollectionReads: 0`; if this cannot be instrumented, the homologation is incomplete rather than approved.

Recommended commands after implementation:

```powershell
npm.cmd run typecheck
npm.cmd run sets:activate:staging:check
npm.cmd run sets:active-staging:functional-homologate
npm.cmd run build
git diff --check
```

## Runtime Safety And Exit Codes

The homologation runner must close MongoDB connections in `finally`, even when a gate fails.

Secrets must never be emitted. Logs and JSON output must not include MongoDB URI, username, password, tokens, or DNS hook details.

Exit codes must be deterministic:

```text
0: homologation succeeded
1: functional gate failed
2: invalid configuration or environment
3: Mongo connection or read failure
```

All failed gates must produce a non-zero process exit code. Partial scenario completion cannot produce exit code 0.
## Out Of Scope

This phase does not include:

```text
Render changes
production feature flag
traffic percentage changes
writes to pokemonsets
creation of a production V2 collection
changes to default engine behavior
removal of the local pilot pack
rollout
canary release
frontend changes
public API behavior changes
```

## Completion Criteria

The phase is complete only when:

```text
spec approved
implementation plan created
read-only active staging source implemented
homologation script implemented
all mandatory scenarios pass using Mongo staging active records
local pilot fallback is false in every mandatory scenario
production writes remain 0
production collection is not modified
final evidence report is produced
```
