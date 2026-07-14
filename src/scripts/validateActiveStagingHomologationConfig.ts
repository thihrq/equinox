import { assertActiveStagingHomologationConfig, ActiveStagingConfigError, readActiveStagingHomologationConfig } from '../equinox/competitive/active-staging/ActiveStagingHomologationConfig';

function assert(condition: boolean, message: string): void { if (!condition) throw new Error(message); }

function assertBlocked(message: string): void {
  let blocked = false;
  try {
    assertActiveStagingHomologationConfig(readActiveStagingHomologationConfig());
  } catch (error) {
    blocked = error instanceof ActiveStagingConfigError && error.exitCode === 2 && String(error).includes(message);
  }
  assert(blocked, `${message} must block with configuration exit code 2`);
}

const originalEnv = { ...process.env };
process.env.EQUINOX_ENABLE_ACTIVE_STAGING_HOMOLOGATION = 'false';
process.env.EQUINOX_ACTIVE_STAGING_COLLECTION = 'pokemonsets_v2_staging';
process.env.EQUINOX_ACTIVE_STAGING_READ_ONLY = 'true';
process.env.EQUINOX_DATA_MODE = 'mongo';
process.env.EQUINOX_ALLOW_DATABASE_WRITES = 'false';
assertBlocked('EQUINOX_ENABLE_ACTIVE_STAGING_HOMOLOGATION=true is required');
process.env.EQUINOX_ENABLE_ACTIVE_STAGING_HOMOLOGATION = 'true';
process.env.EQUINOX_ACTIVE_STAGING_COLLECTION = 'pokemonsets';
assertBlocked('pokemonsets_v2_staging');
process.env.EQUINOX_ACTIVE_STAGING_COLLECTION = 'pokemonsets_v2_staging';
process.env.EQUINOX_ACTIVE_STAGING_READ_ONLY = 'false';
assertBlocked('EQUINOX_ACTIVE_STAGING_READ_ONLY=true is required');
delete process.env.EQUINOX_ACTIVE_STAGING_READ_ONLY;
assertBlocked('EQUINOX_ACTIVE_STAGING_READ_ONLY=true is required');
process.env.EQUINOX_ACTIVE_STAGING_READ_ONLY = 'true';
process.env.EQUINOX_DATA_MODE = 'filesystem';
assertBlocked('EQUINOX_DATA_MODE=mongo is required');
delete process.env.EQUINOX_DATA_MODE;
assertBlocked('EQUINOX_DATA_MODE=mongo is required');
process.env.EQUINOX_DATA_MODE = 'mongo';
process.env.EQUINOX_ALLOW_DATABASE_WRITES = 'true';
assertBlocked('EQUINOX_ALLOW_DATABASE_WRITES=false is required');
process.env.EQUINOX_ALLOW_DATABASE_WRITES = 'False';
assertBlocked('EQUINOX_ALLOW_DATABASE_WRITES=false is required');
delete process.env.EQUINOX_ALLOW_DATABASE_WRITES;
assertBlocked('EQUINOX_ALLOW_DATABASE_WRITES=false is required');
process.env.EQUINOX_ALLOW_DATABASE_WRITES = 'false';
const config = assertActiveStagingHomologationConfig(readActiveStagingHomologationConfig());
assert(config.enabled === true, 'enabled must be true');
assert(config.collectionName === 'pokemonsets_v2_staging', 'collection must be staging');
assert(config.readOnly === true, 'readOnly must be true');
process.env = originalEnv;
console.log('[Equinox] Active staging homologation config validation passed.');
