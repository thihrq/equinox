import type { MongoClient } from 'mongodb';
import type { CollectionReadMonitor } from '../active-staging/ActiveStagingCollectionReadMonitor';
import type { MongoCommandMonitor } from '../active-staging/ActiveStagingMongoCommandMonitor';
import { ActiveStagingSetRepository } from '../active-staging/ActiveStagingSetRepository';
import type { ActiveStagingSetRecord } from '../active-staging/ActiveStagingHomologationTypes';
import type { ActiveV2ShadowConfig } from './ActiveV2ShadowConfig';

export interface ActiveV2ShadowMongoReadInput {
  client: MongoClient;
  config: ActiveV2ShadowConfig & { collectionName: 'pokemonsets_v2_staging'; readOnly: true };
  commandMonitor: MongoCommandMonitor;
  readMonitor: CollectionReadMonitor;
}

export async function loadActiveV2ShadowRecords(input: ActiveV2ShadowMongoReadInput): Promise<ActiveStagingSetRecord[]> {
  const repository = new ActiveStagingSetRepository({
    client: input.client,
    config: {
      enabled: true,
      collectionName: input.config.collectionName,
      readOnly: input.config.readOnly,
      dataMode: input.config.dataMode,
      allowDatabaseWrites: input.config.allowDatabaseWrites,
      allowDatabaseWritesRaw: input.config.allowDatabaseWritesRaw,
    },
    commandMonitor: input.commandMonitor,
    readMonitor: input.readMonitor,
  });
  return repository.loadActiveAllowlistedSets();
}
