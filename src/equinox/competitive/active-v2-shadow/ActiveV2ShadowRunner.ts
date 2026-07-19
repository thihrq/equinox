import {
  ACTIVE_STAGING_HOMOLOGATION_SCENARIOS,
  ACTIVE_STAGING_SET_ALLOWLIST,
} from '../active-staging/ActiveStagingHomologationAllowlist';

const EXPECTED_SCENARIO_COUNT = ACTIVE_STAGING_HOMOLOGATION_SCENARIOS.length;
const EXPECTED_ACTIVE_V2_RECORD_COUNT = ACTIVE_STAGING_SET_ALLOWLIST.length;
import type { ActiveStagingSetRecord } from '../active-staging/ActiveStagingHomologationTypes';
import { compareShadowPathResults } from './ActiveV2ShadowComparators';
import { ActiveV2ShadowGateError } from './ActiveV2ShadowGates';
import { runActiveV2StagingPath, runControlledBaselinePath } from './ActiveV2ShadowPathAdapter';
import { calculateCanonicalActiveV2DataDigest, ACTIVE_V2_DATA_DIGEST_ALGORITHM } from '../../../services/competitive-data/digest/ActiveV2CanonicalDataDigest';
import type {
  ActiveV2ShadowAggregate,
  ActiveV2ShadowBaselineMetadata,
  ActiveV2ShadowReport,
  ActiveV2ShadowScenarioResult,
} from './ActiveV2ShadowTypes';

export interface ActiveV2ShadowRunnerInput {
  baselineRecords: ActiveStagingSetRecord[];
  activeV2Records: ActiveStagingSetRecord[];
  baselineMetadata: ActiveV2ShadowBaselineMetadata;
  productionCollectionReads: number;
  observedMongoWriteCommands: number;
  observedStagingWriteCommands: number;
  observedProductionWriteCommands: number;
  recordsWritten: number;
  productionWrites: number;
}

function executeActiveV2ShadowComparison(input: ActiveV2ShadowRunnerInput): ActiveV2ShadowReport {
  const activeV2SourceRunIds = [...new Set(input.activeV2Records
    .map(record => record.activeRunId?.trim())
    .filter((runId): runId is string => Boolean(runId)))].sort();
  const activeV2RecordsMissingRunId = input.activeV2Records.filter(record => !record.activeRunId?.trim()).length;
  const activeV2SourceStateReproducible = input.activeV2Records.length === EXPECTED_ACTIVE_V2_RECORD_COUNT
    && activeV2RecordsMissingRunId === 0
    && activeV2SourceRunIds.length === 1;
  const scenarios: ActiveV2ShadowScenarioResult[] = ACTIVE_STAGING_HOMOLOGATION_SCENARIOS.map(scenario => {
    const baselineResult = runControlledBaselinePath({
      scenario,
      records: input.baselineRecords,
      teamIdentity: 'balanced',
      allowLegendaries: false,
    });
    const activeV2Result = runActiveV2StagingPath({
      scenario,
      records: input.activeV2Records,
      teamIdentity: 'balanced',
      allowLegendaries: false,
    });
    const comparison = compareShadowPathResults(baselineResult, activeV2Result);
    const passed =
      baselineResult.errors.length === 0 &&
      activeV2Result.errors.length === 0 &&
      baselineResult.fallbackUsed === false &&
      activeV2Result.fallbackUsed === false &&
      comparison.differencesFullyRecorded === true &&
      comparison.criticalFieldsPresent === true;
    return { scenarioId: scenario.id, baselineResult, activeV2Result, comparison, passed };
  });

  const aggregate: ActiveV2ShadowAggregate = {
    mode: 'active-v2-shadow-comparison',
    targetCollection: 'pokemonsets_v2_staging',
    activeRunId: activeV2SourceStateReproducible ? activeV2SourceRunIds[0] : undefined,
    activeV2DataDigest: activeV2SourceStateReproducible ? calculateCanonicalActiveV2DataDigest(input.activeV2Records) : undefined,
    activeV2RecordCount: activeV2SourceStateReproducible ? input.activeV2Records.length : undefined,
    activeV2DataDigestAlgorithm: activeV2SourceStateReproducible ? ACTIVE_V2_DATA_DIGEST_ALGORITHM : undefined,
    activeV2SourceRunIds,
    activeV2RecordsMissingRunId,
    activeV2SourceStateReproducible,
    ...input.baselineMetadata,
    scenarioCount: ACTIVE_STAGING_HOMOLOGATION_SCENARIOS.length,
    scenariosCompared: scenarios.length,
    scenariosWithBaselineExecution: scenarios.filter(scenario => scenario.baselineResult.errors.length === 0).length,
    scenariosWithActiveV2Execution: scenarios.filter(scenario => scenario.activeV2Result.errors.length === 0).length,
    scenariosWithSameInput: scenarios.filter(scenario => scenario.comparison.sameScenarioInput).length,
    scenariosWithRecordedDifferences: scenarios.filter(scenario => scenario.comparison.differencesFullyRecorded).length,
    baselineFallbackUsed: scenarios.some(scenario => scenario.baselineResult.fallbackUsed),
    activeV2FallbackUsed: scenarios.some(scenario => scenario.activeV2Result.fallbackUsed),
    activeV2SourceCollection: 'pokemonsets_v2_staging',
    activeV2RecordsLoaded: input.activeV2Records.length,
    localPilotFallbackUsed: false,
    productionCollectionReads: input.productionCollectionReads,
    observedMongoWriteCommands: input.observedMongoWriteCommands,
    observedStagingWriteCommands: input.observedStagingWriteCommands,
    observedProductionWriteCommands: input.observedProductionWriteCommands,
    productionWrites: input.productionWrites,
    recordsWritten: input.recordsWritten,
    criticalFieldFailures: scenarios.filter(scenario => !scenario.comparison.criticalFieldsPresent).length,
    unrecordedDifferenceFailures: scenarios.filter(scenario => !scenario.comparison.differencesFullyRecorded).length,
    sameEngineComponents: true,
    sameScenarioInput: scenarios.every(scenario => scenario.comparison.sameScenarioInput),
    sameFormat: scenarios.every(scenario => scenario.comparison.sameFormat),
    sameTeamIdentity: scenarios.every(scenario => scenario.comparison.sameTeamIdentity),
    sameAllowLegendaries: scenarios.every(scenario => scenario.comparison.sameAllowLegendaries),
    sameSeed: 'not-applicable',
    readyForCompetitiveAcceptanceGate: false,
  };

  aggregate.readyForCompetitiveAcceptanceGate =
    aggregate.scenariosCompared === EXPECTED_SCENARIO_COUNT &&
    aggregate.scenariosWithBaselineExecution === EXPECTED_SCENARIO_COUNT &&
    aggregate.scenariosWithActiveV2Execution === EXPECTED_SCENARIO_COUNT &&
    aggregate.scenariosWithSameInput === EXPECTED_SCENARIO_COUNT &&
    aggregate.scenariosWithRecordedDifferences === EXPECTED_SCENARIO_COUNT &&
    aggregate.baselineFallbackUsed === false &&
    aggregate.activeV2FallbackUsed === false &&
    aggregate.activeV2SourceStateReproducible === true &&
    aggregate.productionCollectionReads === 0 &&
    aggregate.observedMongoWriteCommands === 0 &&
    aggregate.observedStagingWriteCommands === 0 &&
    aggregate.observedProductionWriteCommands === 0 &&
    aggregate.recordsWritten === 0 &&
    aggregate.productionWrites === 0 &&
    aggregate.criticalFieldFailures === 0 &&
    aggregate.unrecordedDifferenceFailures === 0 &&
    scenarios.every(scenario => scenario.passed);

  return { aggregate, scenarios };
}

export function runActiveV2ShadowComparison(input: ActiveV2ShadowRunnerInput): ActiveV2ShadowReport {
  try {
    return executeActiveV2ShadowComparison(input);
  } catch (error) {
    if (error instanceof ActiveV2ShadowGateError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new ActiveV2ShadowGateError(`Active V2 shadow functional execution failed: ${message}`);
  }
}
