import { MongoCommandMonitor, WRITE_COMMAND_NAMES } from '../equinox/competitive/active-staging/ActiveStagingMongoCommandMonitor';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const monitor = new MongoCommandMonitor();
monitor.record({ commandName: 'find', collectionName: 'pokemonsets_v2_staging' });
monitor.record({ commandName: 'update', collectionName: 'pokemonsets_v2_staging' });
monitor.record({ commandName: 'insert', collectionName: 'pokemonsets' });

const report = monitor.report();
assert(WRITE_COMMAND_NAMES.includes('update'), 'update must be a write command');
assert(report.totalCommands === 3, 'monitor must count all commands');
assert(report.readsByCollection.pokemonsets_v2_staging === 1, 'staging find must count as staging read');
assert(report.productionCollectionReads === 0, 'production write must not count as production read');
assert(report.observedMongoWriteCommands === 2, 'two write commands must be observed');
assert(report.observedStagingWriteCommands === 1, 'one staging write command must be observed');
assert(report.observedProductionWriteCommands === 1, 'one production write command must be observed');
console.log('[Equinox] Active staging homologation monitoring validation passed.');
