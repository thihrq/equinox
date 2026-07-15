import { ACTIVE_STAGING_HOMOLOGATION_SCENARIOS, ACTIVE_STAGING_SET_ALLOWLIST } from '../equinox/competitive/active-staging/ActiveStagingHomologationAllowlist';
import { ActiveStagingSetRepository } from '../equinox/competitive/active-staging/ActiveStagingSetRepository';
import { CollectionReadMonitor } from '../equinox/competitive/active-staging/ActiveStagingCollectionReadMonitor';
import { MongoCommandMonitor } from '../equinox/competitive/active-staging/ActiveStagingMongoCommandMonitor';
import { assertActiveStagingHomologationConfig } from '../equinox/competitive/active-staging/ActiveStagingHomologationConfig';
import { readControlledBaselineSource } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowBaselineSource';
import { runActiveV2StagingPath } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowPathAdapter';
import type { ActiveStagingSetRecord } from '../equinox/competitive/active-staging/ActiveStagingHomologationTypes';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const source = readControlledBaselineSource();
  const stagingRecords = source.records
    .filter(record => ACTIVE_STAGING_SET_ALLOWLIST.includes(record.setId as never))
    .map(record => ({ ...record, status: 'active', active: true, activeRunId: 'offline-active-run' })) as ActiveStagingSetRecord[];
  const observedQueries: Array<{ collectionName: string; query: Record<string, unknown> }> = [];
  const client = {
    db: () => ({
      collection: (collectionName: string) => ({
        find: (query: Record<string, unknown>) => {
          observedQueries.push({ collectionName, query });
          return {
            project: () => ({ toArray: async () => stagingRecords }),
          };
        },
      }),
    }),
  } as never;
  const config = assertActiveStagingHomologationConfig({
    enabled: true,
    collectionName: 'pokemonsets_v2_staging',
    readOnly: true,
    dataMode: 'mongo',
    allowDatabaseWrites: false,
    allowDatabaseWritesRaw: 'false',
  });
  const records = await new ActiveStagingSetRepository({
    client,
    config,
    commandMonitor: new MongoCommandMonitor(),
    readMonitor: new CollectionReadMonitor(),
  }).loadActiveAllowlistedSets();

  assert(observedQueries.length === 1, 'V2 staging adapter must issue exactly one source query');
  assert(observedQueries[0].collectionName === 'pokemonsets_v2_staging', 'V2 source collection must be pokemonsets_v2_staging');
  assert(JSON.stringify(observedQueries[0].query) === JSON.stringify({
    setId: { $in: [...ACTIVE_STAGING_SET_ALLOWLIST] },
    status: 'active',
    active: true,
  }), 'V2 source query must require status=active, active=true, and the exact allowlist');
  assert(records.every(record => record.status === 'active' && record.active === true), 'V2 adapter must receive active staging records');

  const result = runActiveV2StagingPath({
    scenario: ACTIVE_STAGING_HOMOLOGATION_SCENARIOS[0],
    records,
    teamIdentity: 'balanced',
    allowLegendaries: false,
  });

  assert(result.path === 'active-v2-staging', 'V2 path must be active-v2-staging');
  assert(result.enginePath === 'current-with-explicit-v2-context', 'V2 path must use explicit V2 context');
  assert(result.sourceKind === 'mongo-active-staging', 'V2 source kind must be mongo active staging');
  assert(result.fallbackUsed === false, 'V2 path must not fallback');
  assert(result.setsConsumed.length === 2, 'V2 scenario must consume two sets');

  const invalidRecords = records.map(record => ({ ...record, status: 'reviewed' as const })) as unknown as ActiveStagingSetRecord[];
  let rejectedInvalidRecord = false;
  try {
    runActiveV2StagingPath({ scenario: ACTIVE_STAGING_HOMOLOGATION_SCENARIOS[0], records: invalidRecords, teamIdentity: 'balanced', allowLegendaries: false });
  } catch {
    rejectedInvalidRecord = true;
  }
  assert(rejectedInvalidRecord, 'V2 adapter must reject records that are not already active');

  const generatedRecords = records.map((record, index) => index === 0
    ? { ...record, sourceType: 'generated' }
    : record) as unknown as ActiveStagingSetRecord[];
  let rejectedGeneratedRecord = false;
  try {
    runActiveV2StagingPath({ scenario: ACTIVE_STAGING_HOMOLOGATION_SCENARIOS[0], records: generatedRecords, teamIdentity: 'balanced', allowLegendaries: false });
  } catch {
    rejectedGeneratedRecord = true;
  }
  assert(rejectedGeneratedRecord, 'V2 adapter must reject generated or non-curated active records');
  console.log('[Equinox] Active V2 shadow staging adapter validation passed.');
}

void main();
