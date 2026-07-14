import type { MongoClient } from 'mongodb';
import { ACTIVE_STAGING_SET_ALLOWLIST } from './ActiveStagingHomologationAllowlist';
import type { ActiveStagingHomologationConfig } from './ActiveStagingHomologationConfig';
import type { ActiveStagingSetRecord } from './ActiveStagingHomologationTypes';
import type { CollectionReadMonitor } from './ActiveStagingCollectionReadMonitor';
import type { MongoCommandMonitor } from './ActiveStagingMongoCommandMonitor';

interface RepositoryOptions {
  client: MongoClient;
  config: ActiveStagingHomologationConfig;
  commandMonitor: MongoCommandMonitor;
  readMonitor: CollectionReadMonitor;
}

export class ActiveStagingSetRepository {
  public constructor(private readonly options: RepositoryOptions) {}

  public async loadActiveAllowlistedSets(): Promise<ActiveStagingSetRecord[]> {
    const { client, config, readMonitor } = this.options;
    if (config.collectionName !== 'pokemonsets_v2_staging') {
      throw new Error(`invalid target collection: ${config.collectionName}`);
    }

    const docs = await client
      .db()
      .collection<ActiveStagingSetRecord>('pokemonsets_v2_staging')
      .find({
        setId: { $in: [...ACTIVE_STAGING_SET_ALLOWLIST] },
        status: 'active',
        active: true,
      })
      .project<ActiveStagingSetRecord>({ _id: 0 })
      .toArray();

    readMonitor.recordRead('pokemonsets_v2_staging', docs.length);
    const sorted = docs.sort((a, b) => String(a.setId).localeCompare(String(b.setId)));
    const uniqueIds = new Set(sorted.map((doc) => doc.setId));
    if (uniqueIds.size !== sorted.length) throw new Error('duplicate active staging setIds returned by repository');
    return sorted;
  }
}
