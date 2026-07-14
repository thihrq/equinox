import { ACTIVE_STAGING_HOMOLOGATION_SCENARIOS } from './ActiveStagingHomologationAllowlist';
import { buildActiveStagingEngineInput } from './ActiveStagingEngineAdapter';
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
    const teamData = applyActiveStagingTraceToTeamData({ team: scenario.leadPokemon }, input);
    const passed =
      teamData.expectedActiveV2SetsResolvedFromMongo.length === 4 &&
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
      passed,
    };
  });

  const uniquePresented = new Set(scenarios.flatMap((scenario) => scenario.expectedActiveV2SetsPresentedToEngine));
  const aggregate = {
    activeRecordsLoadedByRepository: records.length,
    scenariosRun: scenarios.length,
    scenariosPassed: scenarios.filter((scenario) => scenario.passed).length,
    uniqueActiveRecordsPresentedAcrossAllScenarios: uniquePresented.size,
    localPilotFallbackUsed: scenarios.some((scenario) => scenario.localPilotFallbackUsed) as false,
    readyForAtlasReadOnlyHomologation:
      records.length === 4 &&
      scenarios.length === 4 &&
      scenarios.every((scenario) => scenario.passed) &&
      uniquePresented.size === 4,
  };

  return { aggregate, scenarios };
}
