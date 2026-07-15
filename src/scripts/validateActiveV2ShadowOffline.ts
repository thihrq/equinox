import { readControlledBaselineSource } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowBaselineSource';
import { runActiveV2ShadowComparison } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowRunner';
import { ACTIVE_STAGING_SET_ALLOWLIST } from '../equinox/competitive/active-staging/ActiveStagingHomologationAllowlist';

const source = readControlledBaselineSource();
const allowlist = new Set<string>(ACTIVE_STAGING_SET_ALLOWLIST);
const activeV2Records = source.records
  .filter(record => allowlist.has(record.setId))
  .map(record => ({ ...record, status: 'active' as const, active: true as const, activeRunId: 'offline-active-run' }));
const comparisonInput = {
  baselineRecords: source.records,
  activeV2Records,
  baselineMetadata: source.metadata,
  productionCollectionReads: 0,
  observedMongoWriteCommands: 0,
  observedStagingWriteCommands: 0,
  observedProductionWriteCommands: 0,
  recordsWritten: 0,
  productionWrites: 0,
};
const report = runActiveV2ShadowComparison(comparisonInput);

if (report.aggregate.scenarioCount !== 4) throw new Error('must run four scenarios');
if (report.aggregate.scenariosCompared !== 4) throw new Error('must compare four scenarios');
if (report.aggregate.baselineFallbackUsed !== false) throw new Error('baseline fallback must be false');
if (report.aggregate.activeV2FallbackUsed !== false) throw new Error('active V2 fallback must be false');
if (report.aggregate.productionCollectionReads !== 0) throw new Error('production reads must be zero');
if (report.aggregate.readyForCompetitiveAcceptanceGate !== true) throw new Error('offline report must be ready for next gate');
if (!report.aggregate.baselineSourceDigest.startsWith('sha256-')) throw new Error('baseline digest must be present');
if (report.aggregate.baselineSourceRecordCount < 4) throw new Error('baseline record count must be present');
if (report.aggregate.activeV2RecordsLoaded !== 4) throw new Error('offline active V2 record count must be 4');
if (report.aggregate.activeRunId !== 'offline-active-run') throw new Error('active V2 source run must be reported');
if (report.aggregate.activeV2SourceRunIds.join(',') !== 'offline-active-run') throw new Error('active V2 source run IDs must be explicit');
if (report.aggregate.activeV2RecordsMissingRunId !== 0) throw new Error('active V2 source records must all carry activeRunId');
if (report.aggregate.activeV2SourceStateReproducible !== true) throw new Error('single active V2 source run must be reproducible');
for (const scenario of report.scenarios) {
  if (!scenario.baselineResult) throw new Error(`${scenario.scenarioId} missing baselineResult`);
  if (!scenario.activeV2Result) throw new Error(`${scenario.scenarioId} missing activeV2Result`);
  if (!scenario.comparison) throw new Error(`${scenario.scenarioId} missing comparison`);
  if (!scenario.comparison.differencesFullyRecorded) throw new Error(`${scenario.scenarioId} must record all differences`);
  if (scenario.comparison.latencyDiffMs === undefined) throw new Error(`${scenario.scenarioId} must record latency`);
}

const stagingWriteReport = runActiveV2ShadowComparison({
  ...comparisonInput,
  observedStagingWriteCommands: 1,
});
if (stagingWriteReport.aggregate.readyForCompetitiveAcceptanceGate !== false) {
  throw new Error('observed staging write evidence must block readiness');
}

const productionWriteReport = runActiveV2ShadowComparison({
  ...comparisonInput,
  observedProductionWriteCommands: 1,
});
if (productionWriteReport.aggregate.readyForCompetitiveAcceptanceGate !== false) {
  throw new Error('observed production write evidence must block readiness');
}

const mixedRunReport = runActiveV2ShadowComparison({
  ...comparisonInput,
  activeV2Records: comparisonInput.activeV2Records.map((record, index) => ({
    ...record,
    activeRunId: index === 0 ? 'different-active-run' : record.activeRunId,
  })),
});
if (mixedRunReport.aggregate.activeV2SourceStateReproducible !== false) {
  throw new Error('mixed activeRunId source state must not be reproducible');
}
if (mixedRunReport.aggregate.readyForCompetitiveAcceptanceGate !== false) {
  throw new Error('mixed activeRunId source state must block readiness');
}

console.log('[Equinox] Active V2 shadow offline comparison validation passed.');
