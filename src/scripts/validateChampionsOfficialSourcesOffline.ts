declare const require: (moduleName: string) => any;
const { getChampionsSourceFlags } = require('../config/championsSourceFlags') as any;
const flags = getChampionsSourceFlags();
const result = { valid: !flags.networkReads && !flags.officialWebImport, networkReads: flags.networkReads, officialWebImport: flags.officialWebImport, mongoWrites: flags.databaseWrites };
console.log(JSON.stringify(result, null, 2));
if (!result.valid || result.mongoWrites) process.exitCode = 1;
