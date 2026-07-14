# Active Staging Functional Homologation V1 Report

## Scope

- Target collection: `pokemonsets_v2_staging`
- Production collection reads: `0`
- Mongo writes: `0`
- Render changes: `0`
- Traffic changes: `0`
- Required filter: `status=active + active=true + allowlist`

## Expected Final Evidence

```text
activeRecordsLoadedByRepository: 4
scenariosRun: 4
scenariosPassed: 4
uniqueActiveRecordsPresentedAcrossAllScenarios: 4
productionCollectionReads: 0
observedMongoWriteCommands: 0
observedStagingWriteCommands: 0
observedProductionWriteCommands: 0
localPilotFallbackUsed: false
competitiveVerificationState: staging-controlled
```

## Local Validation

```text
npm.cmd run sets:active-staging:contracts:check
npm.cmd run sets:active-staging:config:check
npm.cmd run sets:active-staging:monitoring:check
npm.cmd run sets:active-staging:engine-adapter:check
npm.cmd run sets:active-staging:teamdata:check
npm.cmd run sets:active-staging:runner:offline
npm.cmd run sets:active-staging:offline-integration:check
npm.cmd run typecheck
npm.cmd run build
git diff --check
```

## Atlas Read-Only Homologation

```text
Command: npm.cmd run sets:active-staging:homologate
Exit code: 0
Target collection: pokemonsets_v2_staging
Production collection reads: 0
Observed Mongo write commands: 0
```

## Stop Criteria

Stop immediately if any field differs from the expected evidence block or if any command exits non-zero outside the documented config failure test.
