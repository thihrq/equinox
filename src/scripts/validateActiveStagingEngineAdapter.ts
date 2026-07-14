import { ACTIVE_STAGING_HOMOLOGATION_SCENARIOS, ACTIVE_STAGING_SET_ALLOWLIST } from '../equinox/competitive/active-staging/ActiveStagingHomologationAllowlist';
import { buildActiveStagingEngineInput } from '../equinox/competitive/active-staging/ActiveStagingEngineAdapter';
import type { ActiveStagingSetRecord } from '../equinox/competitive/active-staging/ActiveStagingHomologationTypes';

function assertValidationFailure(action: () => void, label: string): void {
  try {
    action();
  } catch {
    return;
  }
  throw new Error(`${label} must fail validation`);
}

const records: ActiveStagingSetRecord[] = ACTIVE_STAGING_SET_ALLOWLIST.map((setId) => ({
    setId,
    pokemon: setId.includes('aggron') ? 'Aggron-Mega' : setId.includes('incineroar') ? 'Incineroar' : setId.includes('ursaluna') ? 'Ursaluna-Bloodmoon' : 'Sinistcha',
    status: 'active',
    active: true,
    sourceType: 'curated',
    format: 'champions-reg-mb-doubles',
}));

assertValidationFailure(
  () => buildActiveStagingEngineInput(ACTIVE_STAGING_HOMOLOGATION_SCENARIOS[0], records.slice(0, 2)),
  'two-record active staging input',
);

for (const scenario of ACTIVE_STAGING_HOMOLOGATION_SCENARIOS) {
  const input = buildActiveStagingEngineInput(scenario, records);
  if (input.expectedActiveV2SetsPresentedToEngine.length !== 2) throw new Error(`${scenario.id} must present exactly 2 records`);
  if (input.expectedActiveV2SetsResolvedFromMongo.length !== 4) throw new Error(`${scenario.id} must keep 4-record resolution trace`);
  if (input.expectedActiveV2SetsResolvedFromMongo.join(',') !== records.map((record) => record.setId).join(',')) throw new Error(`${scenario.id} must derive resolution trace from records`);
  if (input.localPilotFallbackUsed !== false) throw new Error(`${scenario.id} must not use local fallback`);
}
console.log('active staging engine adapter ok');
