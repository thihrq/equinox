import { MongoCommandMonitor, WRITE_COMMAND_NAMES } from '../equinox/competitive/active-staging/ActiveStagingMongoCommandMonitor';
import { CollectionReadMonitor } from '../equinox/competitive/active-staging/ActiveStagingCollectionReadMonitor';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const monitor = new MongoCommandMonitor();
monitor.record({ commandName: 'find', collectionName: 'pokemonsets_v2_staging' });
monitor.record({ commandName: 'update', collectionName: 'pokemonsets_v2_staging' });
monitor.record({ commandName: 'insert', collectionName: 'pokemonsets' });
monitor.record({ commandName: 'createIndexes', collectionName: 'pokemonsets_v2_staging' });
monitor.record({ commandName: 'drop', collectionName: 'pokemonsets' });

const report = monitor.report();
assert(WRITE_COMMAND_NAMES.includes('update'), 'update must be a write command');
assert(WRITE_COMMAND_NAMES.includes('createIndexes'), 'createIndexes must be a write command');
assert(WRITE_COMMAND_NAMES.includes('drop'), 'drop must be a write command');
assert(report.totalCommands === 5, 'monitor must count all commands');
assert(report.readsByCollection.pokemonsets_v2_staging === 1, 'staging find must count as staging read');
assert(report.productionCollectionReads === 0, 'production write must not count as production read');
assert(report.observedMongoWriteCommands === 4, 'four write commands must be observed');
assert(report.observedStagingWriteCommands === 2, 'two staging write commands must be observed');
assert(report.observedProductionWriteCommands === 2, 'two production write commands must be observed');

const readMonitor = new CollectionReadMonitor();
readMonitor.recordRead('pokemonsets_v2_staging', 4);
readMonitor.recordRead('pokemonsets', 1);
const readReport = readMonitor.report();
assert(readReport.totalReads === 5, 'read monitor must count records');
assert(readReport.readsByCollection.pokemonsets_v2_staging === 4, 'staging read count must be 4');
assert(readReport.productionCollectionReads === 1, 'production read count must be 1');
console.log('[Equinox] Active staging homologation monitoring validation passed.');
