import { spawnSync } from 'child_process';
import { ActiveStagingRepositoryFunctionalGateError, activeStagingRepositoryExitCodeFor } from '../equinox/competitive/active-staging/ActiveStagingRepositoryValidation';
import {
  ACTIVE_STAGING_CONFIG_EXIT_CODE,
  ACTIVE_STAGING_FUNCTIONAL_GATE_EXIT_CODE,
  ACTIVE_STAGING_MONGO_READ_EXIT_CODE,
} from '../equinox/competitive/active-staging/ActiveStagingHomologationTypes';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function cliEnv(overrides: Record<string, string>): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of [
    'MONGO_URI',
    'MONGODB_URI',
    'EQUINOX_ENABLE_ACTIVE_STAGING_HOMOLOGATION',
    'EQUINOX_ACTIVE_STAGING_COLLECTION',
    'EQUINOX_ACTIVE_STAGING_READ_ONLY',
    'EQUINOX_DATA_MODE',
    'EQUINOX_ALLOW_DATABASE_WRITES',
  ]) {
    delete env[key];
  }
  return { ...env, ...overrides };
}

function runHomologationCli(overrides: Record<string, string>) {
  const command = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npm';
  const args =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npm.cmd run --silent sets:active-staging:homologate']
      : ['run', '--silent', 'sets:active-staging:homologate'];
  return spawnSync(command, args, {
    cwd: process.cwd(),
    env: cliEnv(overrides),
    encoding: 'utf8',
    timeout: 15000,
  });
}

const configFailure = runHomologationCli({});
assert(
  configFailure.status === ACTIVE_STAGING_CONFIG_EXIT_CODE,
  `invalid config must exit 2, received ${configFailure.status}; stderr=${configFailure.stderr}`,
);

const mongoFailure = runHomologationCli({
  EQUINOX_ENABLE_ACTIVE_STAGING_HOMOLOGATION: 'true',
  EQUINOX_ACTIVE_STAGING_COLLECTION: 'pokemonsets_v2_staging',
  EQUINOX_ACTIVE_STAGING_READ_ONLY: 'true',
  EQUINOX_DATA_MODE: 'mongo',
  EQUINOX_ALLOW_DATABASE_WRITES: 'false',
  MONGO_URI: 'mongodb://user:super-secret@127.0.0.1:1/equinox?serverSelectionTimeoutMS=200',
});
assert(
  mongoFailure.status === ACTIVE_STAGING_MONGO_READ_EXIT_CODE,
  `Mongo read failure must exit 3, received ${mongoFailure.status}; stderr=${mongoFailure.stderr}`,
);
assert(!`${mongoFailure.stdout}\n${mongoFailure.stderr}`.includes('super-secret'), 'CLI output must not leak Mongo credentials');

const functionalGateCode = activeStagingRepositoryExitCodeFor(
  new ActiveStagingRepositoryFunctionalGateError('forced functional gate failure'),
);
assert(functionalGateCode === ACTIVE_STAGING_FUNCTIONAL_GATE_EXIT_CODE, 'functional gate failures must exit 1');

console.log('[Equinox] Active staging homologation CLI exit-code validation passed.');
