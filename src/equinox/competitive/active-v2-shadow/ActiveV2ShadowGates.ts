import { recomputeShadowComparisonEvidence } from './ActiveV2ShadowComparators';
import { ACTIVE_V2_SHADOW_GATE_EXIT_CODE, type ActiveV2ShadowReport } from './ActiveV2ShadowTypes';

export class ActiveV2ShadowGateError extends Error {
  public readonly exitCode = ACTIVE_V2_SHADOW_GATE_EXIT_CODE;
}

export function assertActiveV2ShadowGates(report: ActiveV2ShadowReport): void {
  const recomputedEvidence = report.scenarios.map(scenario => recomputeShadowComparisonEvidence(
    scenario.baselineResult,
    scenario.activeV2Result,
    scenario.comparison,
  ));
  const scenarioCriticalFieldFailures = recomputedEvidence.filter(evidence => !evidence.criticalFieldsPresent).length;
  const scenarioDifferenceFailures = recomputedEvidence.filter(evidence => !evidence.differencesFullyRecorded).length;
  const storedEvidenceFlagsMatch = report.scenarios.every((scenario, index) =>
    scenario.comparison.criticalFieldsPresent === recomputedEvidence[index].criticalFieldsPresent
    && scenario.comparison.differencesFullyRecorded === recomputedEvidence[index].differencesFullyRecorded);
  const recomputedScenarioPasses = report.scenarios.map((scenario, index) => (
    Array.isArray(scenario.baselineResult.errors)
    && scenario.baselineResult.errors.length === 0
    && Array.isArray(scenario.activeV2Result.errors)
    && scenario.activeV2Result.errors.length === 0
    && scenario.baselineResult.fallbackUsed === false
    && scenario.activeV2Result.fallbackUsed === false
    && recomputedEvidence[index].criticalFieldsPresent
    && recomputedEvidence[index].differencesFullyRecorded
  ));
  const scenarioPassFlagsMatch = report.scenarios.every(
    (scenario, index) => scenario.passed === recomputedScenarioPasses[index],
  );
  const everyScenarioPassed = recomputedScenarioPasses.every(passed => passed);
  const sourceRunIds = Array.isArray(report.aggregate.activeV2SourceRunIds)
    ? report.aggregate.activeV2SourceRunIds
    : [];
  const sourceStateReproducible = sourceRunIds.length === 1
    && typeof sourceRunIds[0] === 'string'
    && sourceRunIds[0].length > 0
    && sourceRunIds[0].trim() === sourceRunIds[0]
    && report.aggregate.activeV2RecordsMissingRunId === 0
    && report.aggregate.activeRunId === sourceRunIds[0];
  const failures = [
    report.scenarios.length === 4 ? null : 'report must contain 4 scenario results',
    report.aggregate.targetCollection === 'pokemonsets_v2_staging' ? null : 'target collection must be pokemonsets_v2_staging',
    report.aggregate.activeV2SourceCollection === 'pokemonsets_v2_staging' ? null : 'active V2 source collection must be pokemonsets_v2_staging',
    report.aggregate.scenarioCount === 4 ? null : 'scenarioCount must be 4',
    report.aggregate.scenariosCompared === 4 ? null : 'scenariosCompared must be 4',
    report.aggregate.scenariosWithBaselineExecution === 4 ? null : 'baseline must execute all scenarios',
    report.aggregate.scenariosWithActiveV2Execution === 4 ? null : 'active V2 must execute all scenarios',
    report.aggregate.scenariosWithSameInput === 4 ? null : 'all scenarios must use same input',
    report.aggregate.scenariosWithRecordedDifferences === 4 ? null : 'all differences must be recorded',
    report.aggregate.baselineFallbackUsed === false ? null : 'baseline fallback must be false',
    report.aggregate.activeV2FallbackUsed === false ? null : 'active V2 fallback must be false',
    report.aggregate.activeV2RecordsLoaded === 4 ? null : 'active V2 must load 4 records',
    sourceStateReproducible ? null : 'active V2 records must have one shared non-empty activeRunId',
    report.aggregate.activeV2SourceStateReproducible === sourceStateReproducible
      ? null
      : 'active V2 source reproducibility flag must match source-run evidence',
    report.aggregate.activeV2SourceStateReproducible === true ? null : 'active V2 source state must be reproducible',
    report.aggregate.productionCollectionReads === 0 ? null : 'production reads must be zero',
    report.aggregate.observedMongoWriteCommands === 0 ? null : 'Mongo writes must be zero',
    report.aggregate.observedStagingWriteCommands === 0 ? null : 'staging write commands must be zero',
    report.aggregate.observedProductionWriteCommands === 0 ? null : 'production write commands must be zero',
    report.aggregate.recordsWritten === 0 ? null : 'recordsWritten must be zero',
    report.aggregate.productionWrites === 0 ? null : 'productionWrites must be zero',
    report.aggregate.criticalFieldFailures === 0 ? null : 'critical field failures must be zero',
    report.aggregate.unrecordedDifferenceFailures === 0 ? null : 'unrecorded differences must be zero',
    scenarioCriticalFieldFailures === 0 ? null : 'scenario critical field evidence must be complete',
    scenarioDifferenceFailures === 0 ? null : 'scenario difference evidence must be complete',
    storedEvidenceFlagsMatch ? null : 'stored scenario evidence flags must match recomputed evidence',
    scenarioPassFlagsMatch ? null : 'scenario pass flags must match recomputed evidence',
    everyScenarioPassed ? null : 'every scenario must pass recomputed execution and evidence gates',
    report.aggregate.criticalFieldFailures === scenarioCriticalFieldFailures
      ? null
      : 'aggregate critical field failures must match scenario evidence',
    report.aggregate.unrecordedDifferenceFailures === scenarioDifferenceFailures
      ? null
      : 'aggregate unrecorded differences must match scenario evidence',
    report.aggregate.scenariosWithRecordedDifferences === report.scenarios.length - scenarioDifferenceFailures
      ? null
      : 'recorded difference count must match recomputed scenario evidence',
    report.aggregate.readyForCompetitiveAcceptanceGate === true ? null : 'report must be ready for competitive acceptance gate',
  ].filter((failure): failure is string => Boolean(failure));

  if (failures.length > 0) {
    throw new ActiveV2ShadowGateError(`Active V2 shadow comparison gates failed:\n- ${failures.join('\n- ')}`);
  }
}
