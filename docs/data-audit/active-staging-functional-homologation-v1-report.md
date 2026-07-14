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
scenariosWithEngineExecution: 4
scenariosWithZeroFallbacks: 4
fullTeamEvaluationExecuted: true in 4/4 scenarios
productionCollectionReads: 0
observedMongoWriteCommands: 0
observedStagingWriteCommands: 0
observedProductionWriteCommands: 0
recordsWritten: 0
productionWrites: 0
localPilotFallbackUsed: false
competitiveVerificationState: staging-controlled
```

## Local Validation

```text
npm.cmd run sets:active-staging:contracts:check
npm.cmd run sets:active-staging:config:check
npm.cmd run sets:active-staging:monitoring:check
npm.cmd run sets:active-staging:repository:exit-codes:check
npm.cmd run sets:active-staging:cli-exit-codes:check
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

## Atlas Read-Only Homologation Result

```text
Date: 2026-07-14
Command: npm.cmd run sets:active-staging:homologate
Exit code: 0
Target collection: pokemonsets_v2_staging
activeRecordsLoadedByRepository: 4
scenariosRun: 4
scenariosPassed: 4
uniqueActiveRecordsPresentedAcrossAllScenarios: 4
scenariosWithEngineExecution: 4
scenariosWithZeroFallbacks: 4
fullTeamEvaluationExecuted: true in 4/4 scenarios
productionCollectionReads: 0
observedMongoWriteCommands: 0
observedStagingWriteCommands: 0
observedProductionWriteCommands: 0
localPilotFallbackUsed: false
competitiveVerificationState: staging-controlled
recordsWritten: 0
productionWrites: 0
```

Operational note: the Windows resolver returned the Atlas SRV records, but Node's default DNS resolver returned `ECONNREFUSED` for the same SRV lookup. The homologation run used a temporary process-only `NODE_OPTIONS=--require=<temp dns patch>` preload to call `dns.setServers(['8.8.8.8','1.1.1.1'])`. The preload file, `NODE_OPTIONS`, `MONGO_URI`, and `MONGODB_URI` were removed from the process after the run. No URI, username, password, or host secret is recorded in this report.

## Stop Criteria

Stop immediately if any field differs from the expected evidence block or if any command exits non-zero outside the documented config failure test.
