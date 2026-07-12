import { existsSync } from 'fs';
import { resolveDataMode } from '../config/dataMode';
import { assertDatabaseWritesAllowed } from '../config/databaseWriteGuard';
import { createAuditRunContext } from '../equinox/data-audit/AuditRunContext';
import { calculateSha256 } from '../equinox/data-audit/FileIntegrity';
import { assertMongoAccessAllowed } from '../equinox/data-audit/DataAuditRuntime';
import { CompetitiveSetImporter } from '../equinox/data-import/CompetitiveSetImporter';
import { CompetitiveSetMongoWriter } from '../equinox/repositories/CompetitiveSetMongoWriter';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

process.env.EQUINOX_DATA_MODE = 'filesystem';
process.env.EQUINOX_ALLOW_DATABASE_WRITES = 'false';

assert(resolveDataMode() === 'filesystem', 'Data mode must resolve to filesystem.');

let mongoBlocked = false;
try {
  assertMongoAccessAllowed('guard regression');
} catch (error) {
  mongoBlocked = String(error).includes('MongoDB access is forbidden');
}
assert(mongoBlocked, 'Mongo access must be blocked in filesystem mode.');

let writeBlocked = false;
try {
  assertDatabaseWritesAllowed({ operation: 'test write' });
} catch (error) {
  writeBlocked = String(error).includes('Database write blocked');
}
assert(writeBlocked, 'Database writes must be blocked unless explicitly enabled.');

process.env.EQUINOX_ALLOW_DATABASE_WRITES = 'true';
let filesystemWriteBlocked = false;
try {
  assertDatabaseWritesAllowed({ operation: 'filesystem write' });
} catch (error) {
  filesystemWriteBlocked = String(error).includes('blocked in filesystem mode');
}
assert(filesystemWriteBlocked, 'Filesystem mode must block writes even when writes flag is true.');
process.env.EQUINOX_ALLOW_DATABASE_WRITES = 'false';

process.env.EQUINOX_DATA_MODE = 'shadow';
process.env.EQUINOX_ALLOW_DATABASE_WRITES = 'true';
let shadowWriteBlocked = false;
try {
  assertDatabaseWritesAllowed({ operation: 'shadow write' });
} catch (error) {
  shadowWriteBlocked = String(error).includes('blocked in shadow mode');
}
assert(shadowWriteBlocked, 'Shadow mode must block writes even when writes flag is true.');
process.env.EQUINOX_DATA_MODE = 'filesystem';
process.env.EQUINOX_ALLOW_DATABASE_WRITES = 'false';

process.env.NODE_ENV = 'production';
delete process.env.EQUINOX_DATA_MODE;
let productionModeBlocked = false;
try {
  resolveDataMode();
} catch (error) {
  productionModeBlocked = String(error).includes('EQUINOX_DATA_MODE must be explicitly configured');
}
assert(productionModeBlocked, 'Production must require explicit EQUINOX_DATA_MODE.');
process.env.NODE_ENV = 'test';
process.env.EQUINOX_DATA_MODE = 'filesystem';

const dryReport = new CompetitiveSetImporter().importFromFile({
  file: 'src/equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json',
  regulationId: 'champions_reg_m_b_doubles',
  sourceId: 'equinox-curated-champions-mb-doubles',
  mode: 'dry-run',
  allowEmpty: true,
});

assert(dryReport.dryRun, 'Import report must expose dryRun=true.');
assert(dryReport.writtenCount === 0, 'Dry-run import must write zero records.');
assert(dryReport.mongoWrites === 0, 'Dry-run import must report zero Mongo writes.');
assert(dryReport.loadResult.fileExists, 'Dry-run report must expose file existence.');
assert(dryReport.loadResult.rawRecordCount === dryReport.readCount, 'Dry-run report must expose raw records.');
assert(Boolean(dryReport.runContext?.runId), 'Dry-run report must include runId.');
assert(dryReport.sources.some(source => Boolean(source.sha256)), 'Dry-run report must include source SHA-256.');

let emptyBlocked = false;
try {
  new CompetitiveSetImporter().importFromFile({
    file: 'src/equinox/data-packs/fixtures/empty-sets.json',
    regulationId: 'champions_reg_m_b_doubles',
    sourceId: 'equinox-curated-champions-mb-doubles',
    mode: 'dry-run',
  });
} catch (error) {
  emptyBlocked = String(error).includes('No competitive sets were loaded');
}
assert(emptyBlocked, 'Empty package without allowEmpty must fail with explanation.');

const pilotReport = new CompetitiveSetImporter().importFromFile({
  file: 'src/equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json',
  regulationId: 'champions_reg_m_b_doubles',
  sourceId: 'equinox-curated-champions-mb-doubles',
  mode: 'dry-run',
});
assert(pilotReport.readCount > 0, 'Pilot package must contain records.');
assert(pilotReport.writtenCount === 0 && pilotReport.mongoWrites === 0, 'Pilot dry-run must write zero records.');

async function run(): Promise<void> {
  const writer = new CompetitiveSetMongoWriter();
  let writerBlocked = false;
  try {
    await writer.bulkWrite([]);
  } catch (error) {
    writerBlocked = String(error).includes('Database write blocked');
  }
  assert(writerBlocked, 'Mongo writer must be blocked without explicit authorization.');

  const context = createAuditRunContext('sets:offline-guards:check');
  assert(Boolean(context.runId), 'Audit run context must include runId.');
  assert(typeof context.gitDirty === 'boolean', 'Audit run context must include git dirty state.');

  const hash = await calculateSha256('src/equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json');
    assert(hash.length === 64, 'SHA-256 must be 64 hex characters.');
    assert(existsSync('src/equinox/data-packs/competitive/champions-reg-mb-doubles/regulation.json'), 'Pilot regulation.json must exist.');

  console.log('[Equinox] Offline audit guard validation passed.');
}

run().catch(error => {
    console.error(error);
    process.exit(1);
});
