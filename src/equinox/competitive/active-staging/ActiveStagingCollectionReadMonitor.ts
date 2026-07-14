export interface CollectionReadReport {
  totalReads: number;
  readsByCollection: Record<string, number>;
  productionCollectionReads: number;
}

export class CollectionReadMonitor {
  private readonly readsByCollection: Record<string, number> = {};

  public recordRead(collectionName: string, recordCount: number): void {
    this.readsByCollection[collectionName] = (this.readsByCollection[collectionName] ?? 0) + recordCount;
  }

  public report(): CollectionReadReport {
    const totalReads = Object.values(this.readsByCollection).reduce((sum, count) => sum + count, 0);

    return {
      totalReads,
      readsByCollection: { ...this.readsByCollection },
      productionCollectionReads: this.readsByCollection.pokemonsets ?? 0,
    };
  }
}
