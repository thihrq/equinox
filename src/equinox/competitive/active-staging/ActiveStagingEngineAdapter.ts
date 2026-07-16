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
  if (records.length !== ACTIVE_STAGING_SET_ALLOWLIST.length) {
    throw new Error(`active staging resolution requires exactly ${ACTIVE_STAGING_SET_ALLOWLIST.length} records, received ${records.length}`);
  }

  const recordIds = records.map((record) => record.setId);
  const uniqueRecordIds = new Set(recordIds);
  if (uniqueRecordIds.size !== records.length) {
    throw new Error('active staging resolution requires unique set IDs');
  }

  const missingSetIds = ACTIVE_STAGING_SET_ALLOWLIST.filter((setId) => !uniqueRecordIds.has(setId));
  const unexpectedSetIds = recordIds.filter((setId) => !ACTIVE_STAGING_SET_ALLOWLIST.includes(setId as typeof ACTIVE_STAGING_SET_ALLOWLIST[number]));
  if (missingSetIds.length > 0 || unexpectedSetIds.length > 0) {
    throw new Error(`active staging resolution must contain exactly the active allowlist; missing=${missingSetIds.join(',')} unexpected=${unexpectedSetIds.join(',')}`);
  }

  for (const record of records) {
    if (record.status !== 'active' || record.active !== true) {
      throw new Error(`active staging resolution received inactive set ${record.setId}`);
    }
  }

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
    expectedActiveV2SetsResolvedFromMongo: records.map((record) => record.setId),
    expectedActiveV2SetsPresentedToEngine: presentedRecords.map((record) => record.setId),
    presentedRecords,
    localPilotFallbackUsed: false,
  };
}
