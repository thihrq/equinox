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
assertValidationFailure(
  () => buildActiveStagingEngineInput(ACTIVE_STAGING_HOMOLOGATION_SCENARIOS[0], [records[0], records[0], records[1], records[2]]),
  'duplicate active staging set ids',
);
assertValidationFailure(
  () => buildActiveStagingEngineInput(ACTIVE_STAGING_HOMOLOGATION_SCENARIOS[0], [
    { ...records[0], setId: 'unexpected-active-set' },
    records[1],
    records[2],
    records[3],
  ]),
  'unexpected active staging set id',
);
assertValidationFailure(
  () => buildActiveStagingEngineInput(ACTIVE_STAGING_HOMOLOGATION_SCENARIOS[0], [
    { ...records[0], status: 'reviewed', active: false } as unknown as ActiveStagingSetRecord,
    records[1],
    records[2],
    records[3],
  ]),
  'inactive active staging record',
);
assertValidationFailure(
  () =>
    buildActiveStagingEngineInput(
      {
        ...ACTIVE_STAGING_HOMOLOGATION_SCENARIOS[0],
        expectedPresentedSetIds: ['missing-active-set', records[1].setId],
      },
      records,
    ),
  'scenario requesting non-resolved set',
);

for (const scenario of ACTIVE_STAGING_HOMOLOGATION_SCENARIOS) {
  const input = buildActiveStagingEngineInput(scenario, records);
  if (input.expectedActiveV2SetsPresentedToEngine.length !== 2) throw new Error(`${scenario.id} must present exactly 2 records`);
  if (input.expectedActiveV2SetsResolvedFromMongo.length !== records.length) throw new Error(`${scenario.id} must keep ${records.length}-record resolution trace`);
  if (input.expectedActiveV2SetsResolvedFromMongo.join(',') !== records.map((record) => record.setId).join(',')) throw new Error(`${scenario.id} must derive resolution trace from records`);
  if (input.localPilotFallbackUsed !== false) throw new Error(`${scenario.id} must not use local fallback`);
}
console.log('active staging engine adapter ok');
