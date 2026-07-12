import { connectDatabase } from '../config/database';
import pilotPack from '../equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json';
import manifest from '../equinox/data-packs/competitive/champions-reg-mb-doubles/manifest.json';
import { CompetitiveSetMongoWriter } from '../equinox/repositories/CompetitiveSetMongoWriter';
import { buildAuditRuntimeReport, printAuditRuntimeReport } from '../equinox/data-audit/DataAuditRuntime';

async function main(): Promise<void> {
  const targetCollection = process.env.EQUINOX_TARGET_COLLECTION;
  if (targetCollection !== 'pokemonsets_v2_staging') {
    throw new Error('Staging publish requires EQUINOX_TARGET_COLLECTION=pokemonsets_v2_staging.');
  }

  if (manifest.status === 'draft') {
    throw new Error('Staging publish blocked: pilot package is still draft and requires human review first.');
  }

  const records = pilotPack.sets;
  const operations = records.map(record => ({
    replaceOne: {
      filter: { setId: record.setId, dataVersion: record.dataVersion },
      replacement: record,
      upsert: true,
    },
  }));

  await connectDatabase();
  await new CompetitiveSetMongoWriter().bulkWrite(operations, targetCollection);
  console.log(`[STAGING PUBLISH] target=${targetCollection} records written=${operations.length} production writes=0`);
  printAuditRuntimeReport(buildAuditRuntimeReport([{
    type: 'mongo',
    label: 'staging competitive sets',
    recordCount: operations.length,
    path: targetCollection,
  }]));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
