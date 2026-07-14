import type { ActiveStagingHomologationScenario, ActiveStagingSetRecord } from './ActiveStagingHomologationTypes';
import { ACTIVE_STAGING_SET_ALLOWLIST } from './ActiveStagingHomologationAllowlist';

export interface ActiveStagingEngineInput {
  scenarioId: string;
  leadPokemon: string[];
  format: 'champions-reg-mb-doubles';
  competitiveVerificationState: 'staging-controlled';
  expectedActiveV2SetsResolvedFromMongo: string[];
  expectedActiveV2SetsPresentedToEngine: string[];
  presentedRecords: ActiveStagingSetRecord[];
  localPilotFallbackUsed: false;
}

export function buildActiveStagingEngineInput(
  scenario: ActiveStagingHomologationScenario,
  records: ActiveStagingSetRecord[],
): ActiveStagingEngineInput {
  const byId = new Map(records.map((record) => [record.setId, record]));
  const presentedRecords = scenario.expectedPresentedSetIds.map((setId) => {
    const record = byId.get(setId);
    if (!record) throw new Error(`scenario ${scenario.id} missing active staging set ${setId}`);
    if (record.status !== 'active' || record.active !== true) throw new Error(`scenario ${scenario.id} received inactive set ${setId}`);
    return record;
  });

  return {
    scenarioId: scenario.id,
    leadPokemon: [...scenario.leadPokemon],
    format: 'champions-reg-mb-doubles',
    competitiveVerificationState: 'staging-controlled',
    expectedActiveV2SetsResolvedFromMongo: [...ACTIVE_STAGING_SET_ALLOWLIST],
    expectedActiveV2SetsPresentedToEngine: presentedRecords.map((record) => record.setId),
    presentedRecords,
    localPilotFallbackUsed: false,
  };
}
