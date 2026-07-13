import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import pilotPack from '../equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json';
import manifest from '../equinox/data-packs/competitive/champions-reg-mb-doubles/manifest.json';
import { CompetitiveSetMongoWriter } from '../equinox/repositories/CompetitiveSetMongoWriter';
import { buildAuditRuntimeReport, printAuditRuntimeReport } from '../equinox/data-audit/DataAuditRuntime';

const dryRun = process.argv.includes('--dry-run') || process.argv.includes('--preflight');

async function main(): Promise<void> {
  const targetCollection = process.env.EQUINOX_TARGET_COLLECTION ?? (dryRun ? 'pokemonsets_v2_staging' : undefined);
  if (targetCollection !== 'pokemonsets_v2_staging') {
    throw new Error('Staging publish requires EQUINOX_TARGET_COLLECTION=pokemonsets_v2_staging.');
  }

  if (manifest.status === 'draft') {
    throw new Error('Staging publish blocked: pilot package is still draft and requires human review first.');
  }

  const records = pilotPack.sets;
  if (manifest.recordCount !== records.length) {
    throw new Error(`Staging publish blocked: manifest recordCount=${manifest.recordCount} but sets=${records.length}.`);
  }

  if (manifest.reviewState !== 'staging-ready') {
    throw new Error(`Staging publish blocked: reviewState must be staging-ready, received ${manifest.reviewState}.`);
  }

  const blockedRecords = records.filter(record =>
    record.status === 'draft' ||
    record.status === 'quarantined' ||
    record.status === 'deprecated'
  );
  if (blockedRecords.length > 0) {
    throw new Error(`Staging publish blocked: ${blockedRecords.length} records are not reviewed, verified or active.`);
  }

  const operations = records.map(record => ({
    replaceOne: {
      filter: { setId: record.setId, dataVersion: record.dataVersion },
      replacement: record,
      upsert: true,
    },
  }));

  if (dryRun) {
    console.log(`[STAGING DRY-RUN] target=${targetCollection} records planned=${operations.length} mongo writes=0`);
    printAuditRuntimeReport(buildAuditRuntimeReport([{
      type: 'file',
      label: 'staging competitive sets dry-run',
      recordCount: operations.length,
      path: 'src/equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json',
    }]));
    return;
  }

  try {
    await connectDatabase();
    await new CompetitiveSetMongoWriter().bulkWrite(operations, targetCollection);
    console.log(`[STAGING PUBLISH] target=${targetCollection} records written=${operations.length} production writes=0`);
    printAuditRuntimeReport(buildAuditRuntimeReport([{
      type: 'mongo',
      label: 'staging competitive sets',
      recordCount: operations.length,
      path: targetCollection,
    }]));
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
