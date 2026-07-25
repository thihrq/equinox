import {
  ACTIVE_STAGING_HOMOLOGATION_SCENARIOS,
  ACTIVE_STAGING_SET_ALLOWLIST,
} from './ActiveStagingHomologationAllowlist';

const EXPECTED_ACTIVE_RECORD_COUNT = ACTIVE_STAGING_SET_ALLOWLIST.length;
import { buildActiveStagingEngineInput } from './ActiveStagingEngineAdapter';
import { runActiveStagingFunctionalEngineProbe } from './ActiveStagingFunctionalEngineProbe';
import { applyActiveStagingTraceToTeamData } from './ActiveStagingTeamDataTracker';
import type {
  ActiveStagingHomologationReport,
  ActiveStagingScenarioReport,
  ActiveStagingSetRecord,
} from './ActiveStagingHomologationTypes';

export function runActiveStagingHomologationWithRecords(
  records: ActiveStagingSetRecord[],
): ActiveStagingHomologationReport {
  const scenarios: ActiveStagingScenarioReport[] = ACTIVE_STAGING_HOMOLOGATION_SCENARIOS.map((scenario) => {
    const input = buildActiveStagingEngineInput(scenario, records);
    const engineResult = runActiveStagingFunctionalEngineProbe(input);
    const teamData = applyActiveStagingTraceToTeamData({ team: scenario.leadPokemon }, input, engineResult.consumedSetIds);
    const passed =
      engineResult.engineExecuted === true &&
      engineResult.leadCapabilityMechanicallyValid === true &&
      engineResult.generatedStrategyIds.length > 0 &&
      engineResult.teamDataVerifiedSets === 2 &&
      engineResult.teamDataGeneratedFallbacks === 0 &&
      engineResult.teamDataUnknownSets === 0 &&
      engineResult.fullTeamEvaluationExecuted === true &&
      teamData.expectedActiveV2SetsResolvedFromMongo.length === records.length &&
      teamData.expectedActiveV2SetsPresentedToEngine.length === 2 &&
      teamData.expectedActiveV2SetsAppliedToTeamData.length === 2 &&
      teamData.localPilotFallbackUsed === false &&
      teamData.competitiveVerificationState === 'staging-controlled';

    return {
      scenarioId: scenario.id,
      leadPokemon: [...scenario.leadPokemon],
      expectedActiveV2SetsResolvedFromMongo: teamData.expectedActiveV2SetsResolvedFromMongo,
      expectedActiveV2SetsPresentedToEngine: teamData.expectedActiveV2SetsPresentedToEngine,
      expectedActiveV2SetsAppliedToTeamData: teamData.expectedActiveV2SetsAppliedToTeamData,
      competitiveVerificationState: teamData.competitiveVerificationState,
      localPilotFallbackUsed: teamData.localPilotFallbackUsed,
      engineExecuted: engineResult.engineExecuted,
      generatedStrategyIds: engineResult.generatedStrategyIds,
      selectedStrategyId: engineResult.selectedStrategyId,
      teamDataVerifiedSets: engineResult.teamDataVerifiedSets,
      teamDataGeneratedFallbacks: engineResult.teamDataGeneratedFallbacks,
      teamDataUnknownSets: engineResult.teamDataUnknownSets,
      fullTeamEvaluationScore: engineResult.fullTeamEvaluationScore,
      fullTeamEvaluationExecuted: engineResult.fullTeamEvaluationExecuted,
      passed,
    };
  });

  const uniquePresented = new Set(scenarios.flatMap((scenario) => scenario.expectedActiveV2SetsPresentedToEngine));
  const aggregate = {
    activeRecordsLoadedByRepository: records.length,
    scenariosRun: scenarios.length,
    scenariosPassed: scenarios.filter((scenario) => scenario.passed).length,
    uniqueActiveRecordsPresentedAcrossAllScenarios: uniquePresented.size,
    scenariosWithEngineExecution: scenarios.filter((scenario) => scenario.engineExecuted).length,
    scenariosWithZeroFallbacks: scenarios.filter((scenario) => scenario.teamDataGeneratedFallbacks === 0 && scenario.teamDataUnknownSets === 0).length,
    localPilotFallbackUsed: scenarios.some((scenario) => scenario.localPilotFallbackUsed) as false,
    readyForAtlasReadOnlyHomologation:
      records.length === EXPECTED_ACTIVE_RECORD_COUNT &&
      scenarios.length === ACTIVE_STAGING_HOMOLOGATION_SCENARIOS.length &&
      scenarios.every((scenario) => scenario.passed) &&
      scenarios.every((scenario) => scenario.engineExecuted) &&
      scenarios.every((scenario) => scenario.fullTeamEvaluationExecuted) &&
      uniquePresented.size === EXPECTED_ACTIVE_RECORD_COUNT,
  };

  return { aggregate, scenarios };
}
