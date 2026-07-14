import { ACTIVE_STAGING_HOMOLOGATION_SCENARIOS } from '../equinox/competitive/active-staging/ActiveStagingHomologationAllowlist';
import { buildActiveStagingEngineInput } from '../equinox/competitive/active-staging/ActiveStagingEngineAdapter';
import type { ActiveStagingSetRecord } from '../equinox/competitive/active-staging/ActiveStagingHomologationTypes';

const records: ActiveStagingSetRecord[] = ACTIVE_STAGING_HOMOLOGATION_SCENARIOS.flatMap((scenario) =>
  scenario.expectedPresentedSetIds.map((setId) => ({
    setId,
    pokemon: setId.includes('aggron') ? 'Aggron-Mega' : setId.includes('incineroar') ? 'Incineroar' : setId.includes('ursaluna') ? 'Ursaluna-Bloodmoon' : 'Sinistcha',
    status: 'active',
    active: true,
    sourceType: 'curated',
    format: 'champions-reg-mb-doubles',
  })),
);

for (const scenario of ACTIVE_STAGING_HOMOLOGATION_SCENARIOS) {
  const input = buildActiveStagingEngineInput(scenario, records);
  if (input.expectedActiveV2SetsPresentedToEngine.length !== 2) throw new Error(`${scenario.id} must present exactly 2 records`);
  if (input.expectedActiveV2SetsResolvedFromMongo.length !== 4) throw new Error(`${scenario.id} must keep 4-record resolution trace`);
  if (input.localPilotFallbackUsed !== false) throw new Error(`${scenario.id} must not use local fallback`);
}
console.log('active staging engine adapter ok');
