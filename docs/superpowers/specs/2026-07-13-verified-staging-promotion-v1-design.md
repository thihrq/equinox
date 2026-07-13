# Verified Staging Promotion V1 Design

## Goal

Prepare a controlled, idempotent, staging-only promotion path that can update exactly four eligible curated Champions M-B Doubles records from `reviewed` to `verified` in `pokemonsets_v2_staging`, while keeping generated records, `active`, production writes, and Render production behavior blocked.

## Approved Scope

The user approved the next phase as:

```text
promotion-ready -> verified in staging -> active later -> production later
```

This phase covers spec, plan, implementation, dry-run, PR/merge, real staging execution, post-write validation, idempotency verification, rollback testing, final re-promotion to the expected staging state, and reporting. It does not include active promotion, production collection writes, Render production changes, generated record promotion, or production deployment of frontend/backend changes.

## Current State

- Matchup evidence: 9/9.
- Promotion-ready records: 4 curated only.
- Blocked records: 5.
- Generated records: blocked.
- Verified records in source fixture: 0.
- Active records in source fixture: 0.
- `sets:promote:verified:dry` is data-driven and reports 4 eligible, 5 blocked, 0 writes.
- Real writes are not implemented yet.

## Non-Negotiable Constraints

- Do not write to production collection `pokemonsets`.
- Do not promote any record to `active`.
- Do not promote generated records.
- Do not remove generated source freshness blockers.
- Do not lower confidence/coherence thresholds.
- Do not commit MongoDB URI, username, password, token, or any secret.
- Do not alter Render production configuration.
- Keep ability, move, item, nature, and Pokemon names in canonical English.
- Real execution must target only `pokemonsets_v2_staging`.
- Default execution must remain dry-run and exit successfully with 0 writes.

## Eligible Set Allowlist

The promotion allowlist is exact and must be hard-coded or centrally declared for this phase:

```text
sinistcha-bulky-trick-room-setter-draft
aggronmega-slow-physical-breaker-draft
incineroar-bulky-slow-pivot-draft
ursalunabloodmoon-slow-special-breaker-draft
```

The promotion script must refuse execute mode when:

- `eligibleCount !== 4`;
- `allowlistCount !== 4`;
- eligible IDs differ from the allowlist IDs;
- any allowlisted set is not eligible;
- any eligible record is not `curated`;
- any eligible record is not `promotionReady`;
- any generated record appears in the eligible list;
- any generated record would be written;
- any record is already `active` or would become `active`.

## Authorization Model

Dry-run is the default behavior.

This command must not write and must exit with code 0 when validation succeeds:

```powershell
npm.cmd run sets:promote:verified
```

Dry-run result baseline:

```text
mode: dry-run
recordsEligible: 4
recordsBlocked: 5
recordsAlreadyVerified: 0
recordsPromotedToVerified: 0
recordsWritten: 0
recordsActive: 0
generatedPromoted: 0
productionWrites: 0
```

Real staging execution requires all of these conditions:

```text
EQUINOX_DATA_MODE=mongo
EQUINOX_ALLOW_DATABASE_WRITES=true
EQUINOX_TARGET_COLLECTION=pokemonsets_v2_staging
EQUINOX_ENABLE_VERIFIED_PROMOTION=true
--execute present
```

Equivalent logic:

```text
DATA_MODE=mongo
AND ALLOW_DATABASE_WRITES=true
AND TARGET_COLLECTION=pokemonsets_v2_staging
AND ENABLE_VERIFIED_PROMOTION=true
AND --execute present
```

If `--execute` is present and any authorization condition fails:

```text
recordsWritten: 0
process exit code: 1
```

The failure must occur before any MongoDB write.

## Collection Guardrails

The script must literally block:

```text
pokemonsets
```

The only valid target collection for this phase is:

```text
pokemonsets_v2_staging
```

The script must reject any other target, including missing, empty, misspelled, production, or dynamically inferred collection names.

Production protection should combine:

```text
code guardrail
restricted Mongo credential where available
production snapshot evidence when readable
```

If the staging Mongo user cannot read production, the report must document that production write access is unavailable to that credential.

## Atomic Write Preconditions

Promotion writes must not match by `setId` alone. The Mongo update filter must include the expected state.

Required conceptual filter:

```ts
{
  setId: { $in: allowlist },
  status: "reviewed",
  active: false,
  sourceType: "curated",
  promotionReady: true
}
```

For this controlled phase, missing `active` is an integrity error, not implicit `false`.

After the write operation, the script must assert:

```text
matchedCount + recordsAlreadyVerified === 4
modifiedCount === recordsPromotedToVerified
```

Any mismatch invalidates execution and must be reported as a failed run.

## Concurrency Protection

Two processes must not silently promote the same phase concurrently.

The implementation must include at least one of:

```text
verifiedRunId-based detection
promotionLock or equivalent run marker
single execution document keyed by runId
```

At minimum, the post-write validation must detect records changed between pre-validation and write, fail the run, and report the changed IDs.

## Data Mutation Rules

For the four allowlisted records only, real staging execution may update:

```text
status: verified
verifiedAt: <run timestamp>
verifiedRunId: <run id>
updatedAt: <run timestamp>
```

The promotion must not write `active`. Instead:

```text
precondition: active === false
mutation: do not alter active
```

The script must not change:

```text
moves
item
ability
nature
EVs
IVs
roles
sourceType
sourceUpdatedAt
confidence
coherenceScore
active
```

The five blocked records must remain:

```text
status: reviewed
promotionReady: false
active: false
```

Generated records must remain unmodified.

## Competitive Payload Hashes

Snapshots must hash immutable competitive fields before and after the promotion:

```text
moves
item
ability
nature
EVs
IVs
roles
sourceType
sourceUpdatedAt
confidence
coherenceScore
```

For every promoted set, the report must include:

```text
competitivePayloadHashBefore
competitivePayloadHashAfter
competitivePayloadChanged: false
```

If any competitive payload hash changes, the run must fail validation.

## Idempotency

The promotion must be idempotent.

If the four allowlisted records are already `verified` and `active: false` in staging, rerunning with the same eligibility state must report:

```text
mode: execute
recordsEligible: 4
recordsAlreadyVerified: 4
recordsPromotedToVerified: 0
recordsWritten: 0
recordsActive: 0
generatedPromoted: 0
productionWrites: 0
```

The script must not create duplicates.

## Snapshot Requirements

Real execution must capture snapshots before and after the write.

Snapshot records must include at least:

```text
runId
timestamp
targetCollection
eligibleSetIds
blockedSetIds
beforeStatusBySetId
afterStatusBySetId
competitivePayloadHashBefore
competitivePayloadHashAfter
competitivePayloadChanged
recordsPromotedToVerified
recordsAlreadyVerified
recordsActive
generatedPromoted
productionWrites
```

Snapshots must not include credentials or MongoDB URI.

The implementation may write snapshots to `docs/data-audit/` only for non-secret operational evidence, or print them as structured logs if writing audit files during operational execution is not desired.

## Production Snapshot Evidence

When the credential can read production, the operation must capture before and after production metadata:

```text
productionDocumentCountBefore
productionDocumentCountAfter
productionLatestUpdatedAtBefore
productionLatestUpdatedAtAfter
productionLogicalHashBefore
productionLogicalHashAfter
```

The production logical hash may be built from IDs and `updatedAt` values only. It must not include secrets.

If production is not readable by the staging credential, the report must state:

```text
productionReadAccess: false
productionWriteAccess: false or not granted
productionSnapshotSkippedReason: staging credential cannot read production
```

## Rollback Requirements

A rollback script or rollback mode must be implemented for staging only.

Rollback target:

```text
pokemonsets_v2_staging
```

Rollback execute mode must require:

```powershell
npm.cmd run sets:rollback:verified:staging -- --run-id=<RUN_ID> --execute
```

Without `--run-id`, real rollback must be refused before any write.

Rollback filter:

```ts
{
  setId: { $in: allowlist },
  status: "verified",
  active: false,
  verifiedRunId: runId
}
```

Rollback behavior:

- only the four allowlisted records can be rolled back;
- only records verified by the specified `verifiedRunId` can be reverted;
- `status` changes from `verified` to `reviewed`;
- `active` remains `false` and is not rewritten unless the existing code requires it for schema consistency;
- generated records are untouched;
- production collection is blocked;
- MongoDB connection is closed correctly.

Rollback must also support dry-run.

Pre-promotion rollback dry-run is expected to report:

```text
recordsEligibleForRollback: 0
recordsWritten: 0
```

Post-promotion rollback dry-run is expected to report:

```text
recordsEligibleForRollback: 4
recordsWritten: 0
```

Rollback execute result:

```text
recordsEligibleForRollback: 4
recordsRolledBack: 4
recordsWritten: 4
recordsActive: 0
generatedChanged: 0
productionWrites: 0
```

## Mongo Connection Lifecycle

Every script that opens a Mongo/Mongoose connection must close it in `finally`.

No script may rely on `process.exit(0)` to terminate a healthy run.

Failure paths may set `process.exitCode = 1`, but should still allow logging and connection cleanup.

## Commands

Required npm scripts:

```text
sets:promote:verified
sets:promote:verified:dry
sets:rollback:verified:staging
sets:rollback:verified:staging:dry
sets:verified:staging:check
```

Expected dry-run before real execution:

```text
mode: dry-run
recordsEligible: 4
recordsBlocked: 5
recordsAlreadyVerified: 0
recordsPromotedToVerified: 0
recordsActive: 0
generatedPromoted: 0
productionWrites: 0
recordsWritten: 0
```

Expected first controlled execution:

```text
mode: execute
recordsEligible: 4
recordsAlreadyVerified: 0
recordsPromotedToVerified: 4
recordsWritten: 4
recordsActive: 0
generatedPromoted: 0
productionWrites: 0
```

Expected second idempotent execution:

```text
mode: execute
recordsEligible: 4
recordsAlreadyVerified: 4
recordsPromotedToVerified: 0
recordsWritten: 0
recordsActive: 0
generatedPromoted: 0
productionWrites: 0
```

Expected re-execution after rollback:

```text
recordsEligible: 4
recordsPromotedToVerified: 4
recordsWritten: 4
```

## Mongo Staging Check

`sets:verified:staging:check` must read directly from `pokemonsets_v2_staging`, not from local fixtures only.

It must prove:

```text
allowlistedVerified: 4
allowlistedActive: 0
generatedVerifiedByRun: 0
blockedRecordsStillReviewed: 5
duplicateSetIds: 0
productionWrites: 0
sameVerifiedRunIdForAllowlist: true
```

It must fail if the target collection is not `pokemonsets_v2_staging`.

## Validation

Before PR:

```powershell
npm.cmd run typecheck
npm.cmd run sets:verified:matchups
npm.cmd run sets:verified:readiness
npm.cmd run sets:promote:verified:dry
npm.cmd run sets:rollback:verified:staging:dry
npm.cmd run sets:verified:staging:check
npm.cmd run sets:structure:check
npm.cmd run sets:legality:check
npm.cmd run sets:coherence:check
npm.cmd run build
git diff --check
```

During real staging execution, with explicit approval:

```powershell
$env:EQUINOX_DATA_MODE="mongo"
$env:EQUINOX_ALLOW_DATABASE_WRITES="true"
$env:EQUINOX_TARGET_COLLECTION="pokemonsets_v2_staging"
$env:EQUINOX_ENABLE_VERIFIED_PROMOTION="true"
npm.cmd run sets:promote:verified -- --execute
$env:EQUINOX_ALLOW_DATABASE_WRITES="false"
```

Post-write validation:

```text
4 records verified in pokemonsets_v2_staging
0 active records
0 generated records promoted
0 production writes
pokemonsets unchanged or production access blocked by staging credential
competitivePayloadChanged: false for all four promoted records
```

Operational sequence after merge:

```text
snapshot pre-promotion
dry-run with real Mongo
execute promotion
staging check
second idempotent execute
rollback dry-run
rollback execute
rollback validation
final promotion execute
final staging check
final report
```

The final promotion after rollback is required so the environment ends in the expected state for this phase:

```text
Verified in staging: 4
Active: 0
Generated verified: 0
Production intact
```

## Reporting

Create or update:

```text
docs/data-audit/verified-staging-promotion-v1-report.md
```

The report must include:

- eligible set IDs;
- blocked set IDs;
- dry-run result;
- execute result if execution occurs;
- post-write validation result;
- idempotency execution result;
- rollback dry-run result;
- rollback execute result if rollback is tested;
- final re-promotion result after rollback;
- final staging check result;
- competitive payload hashes before and after;
- confirmation that generated records were not promoted;
- confirmation that active remains 0;
- confirmation that production writes remain 0;
- production snapshot evidence or restricted-credential explanation;
- confirmation that Mongo connection closed correctly.

## Out of Scope

- Promotion to `active`.
- Production writes.
- Render production configuration changes.
- Generated record promotion.
- Removing source freshness blockers.
- Lowering thresholds.
- Production deployment of frontend or backend changes.
