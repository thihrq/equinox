# Verified Staging Promotion V1 Report

## Scope

Staging-only verified promotion workflow for four curated Champions M-B Doubles pilot sets.

This implementation adds the guarded commands and local evidence only. It does not execute real MongoDB writes in this PR.

## Eligible Set IDs

- `sinistcha-bulky-trick-room-setter-draft`
- `aggronmega-slow-physical-breaker-draft`
- `incineroar-bulky-slow-pivot-draft`
- `ursalunabloodmoon-slow-special-breaker-draft`

## Blocked Set IDs

- `sinistcha-redirection-support-draft`
- `aggronmega-body-press-defensive-attacker-draft`
- `incineroar-fast-taunt-pivot-draft`
- `togekiss-bulky-redirection-support-draft`
- `mukalola-special-wall-draft`

Generated and non-ready records remain reviewed and blocked.

## Dry-Run Result

Command:

```powershell
npm.cmd run sets:promote:verified
```

Result:

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

## Explicit Dry-Run Result

Command:

```powershell
npm.cmd run sets:promote:verified:dry
```

Result:

```text
mode: dry-run
recordsEligible: 4
recordsBlocked: 5
recordsWritten: 0
productionWrites: 0
```

## Execute Refusal Result

Command:

```powershell
npm.cmd run sets:promote:verified -- --execute
```

Result:

```text
recordsWritten: 0
productionWrites: 0
execute refused because required Mongo target and write flags were not provided
```

## Rollback Dry-Run Result

Command:

```powershell
npm.cmd run sets:rollback:verified:staging:dry
```

Result:

```text
mode: dry-run
recordsEligibleForRollback: 0
recordsRolledBack: 0
recordsWritten: 0
recordsActive: 0
generatedChanged: 0
productionWrites: 0
```

## Staging Check Result

Command:

```powershell
npm.cmd run sets:verified:staging:check
```

Result in local filesystem mode:

```text
mongoRead: false
recordsWritten: 0
```

The Mongo-backed staging check is implemented for the post-merge operational execution and must be run with `EQUINOX_DATA_MODE=mongo` and `EQUINOX_TARGET_COLLECTION=pokemonsets_v2_staging`.

## Execute Result

Not executed in this PR.

## Rollback Execute Result

Not executed in this PR.

## Safety Confirmation

- Target collection for real execution: `pokemonsets_v2_staging`
- Production collection `pokemonsets`: blocked by command guard
- Active records promoted: 0
- Generated records promoted: 0
- Production writes: 0
- Mongo credentials: not recorded
- Real staging execution remains approval-gated by flags plus `--execute`
- Rollback execute remains scoped by `--run-id=<RUN_ID>`

## Post-Merge Operational Order

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
