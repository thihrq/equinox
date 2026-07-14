export const WRITE_COMMAND_NAMES = [
  'insert',
  'update',
  'delete',
  'replace',
  'findAndModify',
  'bulkWrite',
  'commitTransaction',
] as const;

export interface MongoCommandObservation {
  commandName: string;
  collectionName?: string;
}

export interface MongoCommandMonitorReport {
  totalCommands: number;
  readsByCollection: Record<string, number>;
  productionCollectionReads: number;
  observedMongoWriteCommands: number;
  observedStagingWriteCommands: number;
  observedProductionWriteCommands: number;
}

export class MongoCommandMonitor {
  private readonly observations: MongoCommandObservation[] = [];

  public record(observation: MongoCommandObservation): void {
    this.observations.push({
      commandName: observation.commandName,
      collectionName: observation.collectionName,
    });
  }

  public report(): MongoCommandMonitorReport {
    const readsByCollection: Record<string, number> = {};
    let productionCollectionReads = 0;
    let observedMongoWriteCommands = 0;
    let observedStagingWriteCommands = 0;
    let observedProductionWriteCommands = 0;

    for (const observation of this.observations) {
      const collectionName = observation.collectionName ?? 'unknown';

      if (WRITE_COMMAND_NAMES.includes(observation.commandName as never)) {
        observedMongoWriteCommands += 1;
        if (collectionName === 'pokemonsets_v2_staging') observedStagingWriteCommands += 1;
        if (collectionName === 'pokemonsets') observedProductionWriteCommands += 1;
        continue;
      }

      if (['find', 'aggregate', 'count', 'countDocuments'].includes(observation.commandName)) {
        readsByCollection[collectionName] = (readsByCollection[collectionName] ?? 0) + 1;
        if (collectionName === 'pokemonsets') productionCollectionReads += 1;
      }
    }

    return {
      totalCommands: this.observations.length,
      readsByCollection,
      productionCollectionReads,
      observedMongoWriteCommands,
      observedStagingWriteCommands,
      observedProductionWriteCommands,
    };
  }
}
