import { AnyBulkWriteOperation } from 'mongoose';
import { assertDatabaseWritesAllowed } from '../../config/databaseWriteGuard';
import { PokemonSet } from '../../models/PokemonSet';
import { markMongoWrite } from '../data-audit/DataAuditRuntime';

export class CompetitiveSetMongoWriter {
  public async bulkWrite(operations: AnyBulkWriteOperation[], targetCollection = 'pokemonsets'): Promise<unknown> {
    assertDatabaseWritesAllowed({
      operation: 'competitive set bulk write',
      collection: targetCollection,
      recordCount: operations.length,
    });

    const result = targetCollection === 'pokemonsets'
      ? await PokemonSet.bulkWrite(operations)
      : await PokemonSet.collection.conn.collection(targetCollection).bulkWrite(operations as never[]);
    markMongoWrite(operations.length);
    return result;
  }
}
