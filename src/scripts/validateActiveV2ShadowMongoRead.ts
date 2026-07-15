import { MongoCommandMonitor } from '../equinox/competitive/active-staging/ActiveStagingMongoCommandMonitor';
import { CollectionReadMonitor } from '../equinox/competitive/active-staging/ActiveStagingCollectionReadMonitor';

const commandMonitor = new MongoCommandMonitor();
const readMonitor = new CollectionReadMonitor();

commandMonitor.record({ commandName: 'find', collectionName: 'pokemonsets_v2_staging' });
readMonitor.recordRead('pokemonsets_v2_staging', 4);

const commandReport = commandMonitor.report();
const readReport = readMonitor.report();

if (commandReport.productionCollectionReads !== 0) throw new Error('production command reads must be zero');
if (readReport.productionCollectionReads !== 0) throw new Error('production collection reads must be zero');
if (commandReport.observedMongoWriteCommands !== 0) throw new Error('writes must be zero');
console.log('[Equinox] Active V2 shadow Mongo read monitor validation passed.');
