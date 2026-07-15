import { spawnSync } from 'child_process';
import {
  ACTIVE_V2_SHADOW_CONFIG_EXIT_CODE,
  ACTIVE_V2_SHADOW_GATE_EXIT_CODE,
  ACTIVE_V2_SHADOW_MONGO_EXIT_CODE,
  type ActiveV2ShadowReport,
} from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowTypes';
import {
  activeV2ShadowExitCodeFor,
  closeActiveV2ShadowCliClient,
  sanitizeActiveV2ShadowCliMessage,
  serializeActiveV2ShadowReport,
} from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowCli';
import { readControlledBaselineSource } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowBaselineSource';
import { runActiveV2ShadowComparison } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowRunner';
import { ACTIVE_STAGING_SET_ALLOWLIST } from '../equinox/competitive/active-staging/ActiveStagingHomologationAllowlist';
import { ActiveStagingRepositoryFunctionalGateError } from '../equinox/competitive/active-staging/ActiveStagingRepositoryValidation';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runCli(env: Record<string, string>) {
  const command = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npm';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm.cmd run --silent sets:active-v2-shadow:compare']
    : ['run', '--silent', 'sets:active-v2-shadow:compare'];
  return spawnSync(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MONGO_URI: undefined,
      MONGODB_URI: undefined,
      ...env,
    },
    encoding: 'utf8',
    timeout: 15000,
  });
}

async function main(): Promise<void> {
  const source = readControlledBaselineSource();
  const allowlist = new Set<string>(ACTIVE_STAGING_SET_ALLOWLIST);
  const activeV2Records = source.records
    .filter(record => allowlist.has(record.setId))
    .map(record => ({ ...record, status: 'active' as const, active: true as const, activeRunId: 'offline-active-run' }));
  const emittedReport = JSON.parse(serializeActiveV2ShadowReport(runActiveV2ShadowComparison({
    baselineRecords: source.records,
    activeV2Records,
    baselineMetadata: source.metadata,
    productionCollectionReads: 0,
    observedMongoWriteCommands: 0,
    observedStagingWriteCommands: 0,
    observedProductionWriteCommands: 0,
    recordsWritten: 0,
    productionWrites: 0,
  }))) as ActiveV2ShadowReport;
  assert(emittedReport.aggregate.activeV2SourceRunIds[0] === 'offline-active-run', 'CLI evidence must emit active V2 source run IDs');
  assert(emittedReport.aggregate.activeV2RecordsMissingRunId === 0, 'CLI evidence must emit missing source-run count');
  assert(emittedReport.aggregate.activeV2SourceStateReproducible === true, 'CLI evidence must emit source reproducibility state');
  assert(emittedReport.scenarios[0].baselineResult.fallbackReason === null, 'CLI evidence must emit fallbackReason');
  assert(emittedReport.scenarios[0].baselineResult.exportResult === null, 'CLI evidence must emit exportResult');
  let functionalFailure: unknown;
  try {
    runActiveV2ShadowComparison({
      baselineRecords: source.records,
      activeV2Records: activeV2Records.slice(1),
      baselineMetadata: source.metadata,
      productionCollectionReads: 0,
      observedMongoWriteCommands: 0,
      observedStagingWriteCommands: 0,
      observedProductionWriteCommands: 0,
      recordsWritten: 0,
      productionWrites: 0,
    });
  } catch (error) {
    functionalFailure = error;
  }
  assert(functionalFailure !== undefined, 'missing allowlisted records must fail execution');
  assert(
    activeV2ShadowExitCodeFor(functionalFailure) === ACTIVE_V2_SHADOW_GATE_EXIT_CODE,
    'runner functional execution failure must exit 1',
  );
  assert(
    activeV2ShadowExitCodeFor(new ActiveStagingRepositoryFunctionalGateError('duplicate records')) === ACTIVE_V2_SHADOW_GATE_EXIT_CODE,
    'duplicate repository records must exit 1',
  );
  assert(
    activeV2ShadowExitCodeFor(new Error('connect ECONNREFUSED')) === ACTIVE_V2_SHADOW_MONGO_EXIT_CODE,
    'untyped connectivity failures must remain Mongo exit 3',
  );

  const configFailure = runCli({});
  assert(configFailure.status === ACTIVE_V2_SHADOW_CONFIG_EXIT_CODE, 'missing config must exit 2');

  const mongoFailure = runCli({
    EQUINOX_ENABLE_ACTIVE_V2_SHADOW_COMPARISON: 'true',
    EQUINOX_ACTIVE_V2_SHADOW_COLLECTION: 'pokemonsets_v2_staging',
    EQUINOX_ACTIVE_V2_SHADOW_READ_ONLY: 'true',
    EQUINOX_DATA_MODE: 'mongo',
    EQUINOX_ALLOW_DATABASE_WRITES: 'false',
    MONGO_URI: 'mongodb://user:shadow-secret@127.0.0.1:1/equinox?serverSelectionTimeoutMS=200',
  });

  assert(mongoFailure.status === ACTIVE_V2_SHADOW_MONGO_EXIT_CODE, 'Mongo failure must exit 3');
  assert(!`${mongoFailure.stdout}\n${mongoFailure.stderr}`.includes('shadow-secret'), 'CLI output must not leak URI credentials');

  assert(
    !sanitizeActiveV2ShadowCliMessage('Mongo failed: mongodb://user:mongodb-secret@host/equinox').includes('mongodb-secret'),
    'mongodb URI credentials must be redacted',
  );
  assert(
    !sanitizeActiveV2ShadowCliMessage('Mongo failed: mongodb+srv://user:mongodb-srv-secret@cluster/equinox').includes('mongodb-srv-secret'),
    'mongodb+srv URI credentials must be redacted',
  );

  const cleanupErrors: string[] = [];
  const originalConsoleError = console.error;
  console.error = (...values: unknown[]) => { cleanupErrors.push(values.map(String).join(' ')); };
  try {
    const cleanupFailureCode = await closeActiveV2ShadowCliClient(
      { close: async () => { throw new Error('close failed: mongodb+srv://user:cleanup-secret@cluster/equinox'); } },
      0,
    );
    assert(cleanupFailureCode === ACTIVE_V2_SHADOW_MONGO_EXIT_CODE, 'cleanup failure must exit 3 without rejection');

    const preservedConfigCode = await closeActiveV2ShadowCliClient(
      { close: async () => { throw new Error('close failed: mongodb://user:preserved-secret@host/equinox'); } },
      ACTIVE_V2_SHADOW_CONFIG_EXIT_CODE,
    );
    assert(preservedConfigCode === ACTIVE_V2_SHADOW_CONFIG_EXIT_CODE, 'cleanup failure must preserve an earlier nonzero exit code');
  } finally {
    console.error = originalConsoleError;
  }
  assert(!cleanupErrors.join('\n').includes('cleanup-secret'), 'cleanup failure output must not leak URI credentials');
  assert(!cleanupErrors.join('\n').includes('preserved-secret'), 'cleanup failure output must redact every URI credential');
  console.log('[Equinox] Active V2 shadow CLI exit-code validation passed.');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
