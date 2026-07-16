# Verified To Active Staging Promotion V1 Report

## Objective

Promote only the four curated records that are already `verified` in `pokemonsets_v2_staging` to `active`, keeping production blocked and leaving generated records inactive.

## Scope

In scope:

- `pokemonsets_v2_staging`
- four allowlisted curated set IDs
- `verified -> active`
- dry-run by default
- transaction-backed execute mode
- rollback by `activeRunId`

Out of scope:

- `pokemonsets`
- production rollout
- Render production changes
- generated set activation
- non-allowlisted records

## Allowlist

```text
sinistcha-bulky-trick-room-setter-draft
aggronmega-slow-physical-breaker-draft
incineroar-bulky-slow-pivot-draft
ursalunabloodmoon-slow-special-breaker-draft
```

## Required Execute Environment

```powershell
$env:EQUINOX_DATA_MODE="mongo"
$env:EQUINOX_TARGET_COLLECTION="pokemonsets_v2_staging"
$env:EQUINOX_ALLOW_DATABASE_WRITES="true"
$env:EQUINOX_ENABLE_STAGING_ACTIVATION="true"
```

Real activation still requires:

```powershell
npm.cmd run sets:activate:staging -- --execute
```

Rollback requires:

```powershell
npm.cmd run sets:activate:staging:rollback -- --run-id=<ACTIVE_RUN_ID> --execute
```

## Operational Sequence

```text
snapshot pre-operation
active staging check
dry-run
execute activation
post-check
idempotency execute
rollback dry-run
rollback execute
rollback validation
final activation
final validation
```

## Expected Pre-Activation State

```text
recordsFound: 4
recordsEligible: 4
allowlistedVerified: 4
allowlistedActive: 0
blockedRecordsStillReviewed: 5
blockedRecordsActive: 0
generatedActive: 0
activeConflicts: 0
duplicateSetIds: 0
productionWrites: 0
recordsWritten: 0
```

## Expected Final State

```text
allowlistedActive: 4
allowlistedStillVerified: 0
blockedRecordsStillReviewed: 5
blockedRecordsActive: 0
generatedActive: 0
activeConflicts: 0
duplicateSetIds: 0
sameActiveRunIdForAllowlist: true
productionWrites: 0
```

## Validation Commands

```powershell
npm.cmd run typecheck
npm.cmd run sets:activate:staging:check
npm.cmd run sets:activate:staging:dry
npm.cmd run sets:activate:staging
npm.cmd run sets:activate:staging:rollback
npm.cmd run build
git diff --check
```

`sets:activate:staging` and rollback execute without required flags must fail before Mongo writes with `recordsWritten: 0`.

## Evidence Log

Fill after operational execution. Do not include URI, username, password, tokens, or DNS hook details.

### Pre-Operation Snapshot

```text
pending
```

### Dry-Run Result

```text
pending
```

### Activation Execute Result

```text
pending
```

### Post-Activation Check

```text
pending
```

### Idempotency Result

```text
pending
```

### Rollback Dry-Run Result

```text
pending
```

### Rollback Execute Result

```text
pending
```

### Final Activation Result

```text
pending
```

### Final Validation

```text
pending
```

## Cleanup

After any operational execution:

```powershell
$env:EQUINOX_ALLOW_DATABASE_WRITES="false"
$env:EQUINOX_ENABLE_STAGING_ACTIVATION="false"
Remove-Item Env:MONGODB_URI -ErrorAction SilentlyContinue
Remove-Item Env:MONGO_URI -ErrorAction SilentlyContinue
Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue
```
