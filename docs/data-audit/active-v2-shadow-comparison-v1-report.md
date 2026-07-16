# Active V2 Shadow Comparison V1 Report

## Scope

- Mode: read-only shadow comparison
- Baseline: current engine logic + controlled baseline source
- Active V2 source: `pokemonsets_v2_staging`
- Production reads: `0`
- Mongo writes: `0`
- Render changes: `0`
- Traffic changes: `0`

## Expected Evidence

```text
scenariosCompared: 4
scenariosWithBaselineExecution: 4
scenariosWithActiveV2Execution: 4
scenariosWithRecordedDifferences: 4
baselineFallbackUsed: false
activeV2FallbackUsed: false
activeRunId: active-staging-2026-07-14T12-20-30-421Z
activeV2SourceRunIds: active-staging-2026-07-14T12-20-30-421Z
activeV2RecordsMissingRunId: 0
activeV2SourceStateReproducible: true
productionCollectionReads: 0
observedMongoWriteCommands: 0
recordsWritten: 0
productionWrites: 0
readyForCompetitiveAcceptanceGate: true
```

## Atlas Read-Only Result

```text
Date: 2026-07-14
Command: npm.cmd run sets:active-v2-shadow:compare
Exit code: 0
Target collection: pokemonsets_v2_staging
Active V2 records loaded: 4
Active run ID: active-staging-2026-07-14T12-20-30-421Z
Active V2 source run IDs: active-staging-2026-07-14T12-20-30-421Z
Active V2 records missing run ID: 0
Active V2 source state reproducible: true
Production collection reads: 0
Observed Mongo write commands: 0
Records written: 0
Production writes: 0
Baseline source version: champions-reg-mb-doubles-baseline-v1
Baseline source digest: sha256-614eb72aaca6757039df5a60b1774d3eafd9bf9ff14a3d8433f4e44706a2e557
Baseline source record count: 9
```

## Notes

No MongoDB URI, username, password, token, or connection string is recorded in this report.
Latency differences are evidence only in this phase. Competitive acceptance thresholds are out of scope.
The baseline digest is computed deterministically from complete normalized records with recursively sorted object keys.
The read-only Atlas comparison was rerun after the final evidence hardening and confirmed the values above with a single active source run, zero production reads, and zero Mongo write commands.
