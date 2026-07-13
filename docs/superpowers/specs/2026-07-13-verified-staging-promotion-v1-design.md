# Verified Staging Promotion V1 Design

## Goal

Prepare a controlled, idempotent, staging-only promotion path that can update exactly four eligible curated Champions M-B Doubles records from `reviewed` to `verified` in `pokemonsets_v2_staging`, while keeping generated records, `active`, production writes, and Render production behavior blocked.

## Approved Scope

The user approved the next phase as:

```text
promotion-ready -> verified in staging -> active later -> production later
```

This phase covers spec, plan, implementation, dry-run, PR/merge, real staging execution, post-write validation, and rollback testing. It does not include active promotion, production collection writes, Render production changes, or generated record promotion.

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

## Eligible Set Allowlist

The promotion allowlist is exact and must be hard-coded or centrally declared for this phase:

```text
sinistcha-bulky-trick-room-setter-draft
aggronmega-slow-physical-breaker-draft
incineroar-bulky-slow-pivot-draft
ursalunabloodmoon-slow-special-breaker-draft
```

The promotion script must refuse execution when:

- the eligible count is not exactly 4;
- any eligible set is not in the allowlist;
- any allowlisted set is not eligible;
- any eligible record is not `curated`;
- any generated record appears in the eligible list;
- any generated record would be written;
- any record is already `active` or would become `active`.

## Authorization Model

Dry-run is the default behavior.

This command must not write:

```powershell
npm.cmd run sets:promote:verified
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

If any condition fails:

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

## Data Mutation Rules

For the four allowlisted records only, real staging execution may update:

```text
status: verified
active: false
verifiedAt: <run timestamp>
verifiedRunId: <run id>
updatedAt: <run timestamp>
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

## Idempotency

The promotion must be idempotent.

If the four allowlisted records are already `verified` and `active: false` in staging, rerunning with the same eligibility state must report:

```text
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
recordsPromotedToVerified
recordsAlreadyVerified
recordsActive
generatedPromoted
productionWrites
```

Snapshots must not include credentials or MongoDB URI.

The implementation may write snapshots to `docs/data-audit/` only for non-secret operational evidence, or print them as structured logs if writing audit files during operational execution is not desired.

## Rollback Requirements

A rollback script or rollback mode must be implemented for staging only.

Rollback target:

```text
pokemonsets_v2_staging
```

Rollback behavior:

- only the four allowlisted records can be rolled back;
- only records verified by this phase can be reverted;
- `status` changes from `verified` to `reviewed`;
- `active` remains `false`;
- generated records are untouched;
- production collection is blocked;
- MongoDB connection is closed correctly.

Rollback must also support dry-run.

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
recordsEligible: 4
recordsBlocked: 5
recordsPromotedToVerified: 0
recordsActive: 0
generatedPromoted: 0
productionWrites: 0
recordsWritten: 0
```

Expected after controlled execution:

```text
recordsEligible: 4
recordsPromotedToVerified: 4
recordsActive: 0
generatedPromoted: 0
productionWrites: 0
```

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
pokemonsets unchanged
```

Rollback validation:

```text
4 records reverted to reviewed in pokemonsets_v2_staging
0 active records
0 generated records changed
0 production writes
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
- rollback dry-run result;
- rollback execute result if rollback is tested;
- confirmation that generated records were not promoted;
- confirmation that active remains 0;
- confirmation that production writes remain 0;
- confirmation that Mongo connection closed correctly.

## Out of Scope

- Promotion to `active`.
- Production writes.
- Render production configuration changes.
- Generated record promotion.
- Removing source freshness blockers.
- Lowering thresholds.
- Publishing frontend/backend changes.
