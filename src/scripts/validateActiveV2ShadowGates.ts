import { readControlledBaselineSource } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowBaselineSource';
import { assertActiveV2ShadowGates, ActiveV2ShadowGateError } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowGates';
import { runActiveV2ShadowComparison } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowRunner';
import { ACTIVE_STAGING_SET_ALLOWLIST } from '../equinox/competitive/active-staging/ActiveStagingHomologationAllowlist';

const source = readControlledBaselineSource();
const allowlist = new Set<string>(ACTIVE_STAGING_SET_ALLOWLIST);
const activeV2Records = source.records
  .filter(record => allowlist.has(record.setId))
  .map(record => ({ ...record, status: 'active' as const, active: true as const, activeRunId: 'offline-active-run' }));
const report = runActiveV2ShadowComparison({
  baselineRecords: source.records,
  activeV2Records,
  baselineMetadata: source.metadata,
  productionCollectionReads: 0,
  observedMongoWriteCommands: 0,
  observedStagingWriteCommands: 0,
  observedProductionWriteCommands: 0,
  recordsWritten: 0,
  productionWrites: 0,
});

assertActiveV2ShadowGates(report);

const mixedRunReport = runActiveV2ShadowComparison({
  baselineRecords: source.records,
  activeV2Records: activeV2Records.map((record, index) => ({
    ...record,
    activeRunId: index === 0 ? 'different-active-run' : record.activeRunId,
  })),
  baselineMetadata: source.metadata,
  productionCollectionReads: 0,
  observedMongoWriteCommands: 0,
  observedStagingWriteCommands: 0,
  observedProductionWriteCommands: 0,
  recordsWritten: 0,
  productionWrites: 0,
});
try {
  assertActiveV2ShadowGates(mixedRunReport);
  throw new Error('mixed activeRunId source state must fail the final gate');
} catch (error) {
  if (!(error instanceof ActiveV2ShadowGateError)) throw error;
}

try {
  assertActiveV2ShadowGates({
    ...report,
    aggregate: { ...report.aggregate, productionCollectionReads: 1 },
  });
  throw new Error('production read gate must fail');
} catch (error) {
  if (!(error instanceof ActiveV2ShadowGateError)) throw error;
}

try {
  assertActiveV2ShadowGates({
    ...report,
    aggregate: {
      ...report.aggregate,
      observedStagingWriteCommands: 1,
      readyForCompetitiveAcceptanceGate: true,
    },
  });
  throw new Error('staging write command gate must fail');
} catch (error) {
  if (!(error instanceof ActiveV2ShadowGateError)) throw error;
}

try {
  assertActiveV2ShadowGates({
    ...report,
    aggregate: {
      ...report.aggregate,
      observedProductionWriteCommands: 1,
      readyForCompetitiveAcceptanceGate: true,
    },
  });
  throw new Error('production write command gate must fail');
} catch (error) {
  if (!(error instanceof ActiveV2ShadowGateError)) throw error;
}

try {
  assertActiveV2ShadowGates({
    ...report,
    scenarios: report.scenarios.map((scenario, index) => index === 0 ? {
      ...scenario,
      comparison: { ...scenario.comparison, criticalFieldsPresent: false },
    } : scenario),
  });
  throw new Error('scenario critical field failure must fail independently of aggregate claims');
} catch (error) {
  if (!(error instanceof ActiveV2ShadowGateError)) throw error;
}

try {
  assertActiveV2ShadowGates({
    ...report,
    scenarios: report.scenarios.map((scenario, index) => index === 0 ? {
      ...scenario,
      comparison: {
        ...scenario.comparison,
        differencesFullyRecorded: false,
        teamDataCoverageDiff: {
          ...scenario.comparison.teamDataCoverageDiff,
          baseline: undefined,
        },
      },
    } : scenario),
  });
  throw new Error('scenario comparator evidence failure must fail independently of aggregate claims');
} catch (error) {
  if (!(error instanceof ActiveV2ShadowGateError)) throw error;
}

try {
  assertActiveV2ShadowGates({
    ...report,
    scenarios: report.scenarios.map((scenario, index) => index === 0 ? {
      ...scenario,
      baselineResult: {
        ...scenario.baselineResult,
        sourceMode: 'mongo-staging-active',
      },
      comparison: {
        ...scenario.comparison,
        criticalFieldsPresent: true,
        differencesFullyRecorded: true,
      },
    } : scenario),
  });
  throw new Error('stale success flags must not mask invalid traceability fields');
} catch (error) {
  if (!(error instanceof ActiveV2ShadowGateError)) throw error;
}

try {
  assertActiveV2ShadowGates({
    ...report,
    scenarios: report.scenarios.map((scenario, index) => index === 0 ? {
      ...scenario,
      comparison: {
        ...scenario.comparison,
        selectedLeadStrategyDiff: {
          ...scenario.comparison.selectedLeadStrategyDiff,
          baseline: 'unrecorded-selected-strategy',
        },
        criticalFieldsPresent: true,
        differencesFullyRecorded: true,
      },
    } : scenario),
  });
  throw new Error('stale success flags must not mask malformed diff evidence');
} catch (error) {
  if (!(error instanceof ActiveV2ShadowGateError)) throw error;
}

try {
  assertActiveV2ShadowGates({
    ...report,
    scenarios: report.scenarios.map((scenario, index) => index === 0 ? {
      ...scenario,
      activeV2Result: {
        ...scenario.activeV2Result,
        fallbackUsed: true,
        fallbackReason: 'fixture fallback evidence',
      },
      comparison: {
        ...scenario.comparison,
        fallbackDiff: {
          status: 'different',
          baseline: false,
          activeV2: true,
          added: [],
          removed: [],
          changed: [{ field: 'value', baseline: false, activeV2: true }],
        },
      },
      passed: false,
    } : scenario),
    aggregate: {
      ...report.aggregate,
      activeV2FallbackUsed: false,
      readyForCompetitiveAcceptanceGate: true,
    },
  });
  throw new Error('failed scenario evidence must not be accepted by stale aggregate success fields');
} catch (error) {
  if (!(error instanceof ActiveV2ShadowGateError)) throw error;
}

console.log('[Equinox] Active V2 shadow gates validation passed.');
