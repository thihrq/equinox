import {
  ActiveV2ShadowConfigError,
  assertActiveV2ShadowConfig,
  readActiveV2ShadowConfig,
} from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowConfig';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function expectConfigFailure(env: NodeJS.ProcessEnv, label: string): void {
  try {
    assertActiveV2ShadowConfig(readActiveV2ShadowConfig(env));
  } catch (error) {
    assert(error instanceof ActiveV2ShadowConfigError, `${label} must throw ActiveV2ShadowConfigError`);
    return;
  }
  throw new Error(`${label} must fail`);
}

const valid = assertActiveV2ShadowConfig(readActiveV2ShadowConfig({
  EQUINOX_ENABLE_ACTIVE_V2_SHADOW_COMPARISON: 'true',
  EQUINOX_ACTIVE_V2_SHADOW_COLLECTION: 'pokemonsets_v2_staging',
  EQUINOX_ACTIVE_V2_SHADOW_READ_ONLY: 'true',
  EQUINOX_DATA_MODE: 'mongo',
  EQUINOX_ALLOW_DATABASE_WRITES: 'false',
}));

assert(valid.enabled === true, 'enabled must be true');
assert(valid.collectionName === 'pokemonsets_v2_staging', 'collection must be staging');
assert(valid.readOnly === true, 'readOnly must be true');
assert(valid.dataMode === 'mongo', 'dataMode must be mongo');
assert(valid.allowDatabaseWritesRaw === 'false', 'writes must be explicitly false');

expectConfigFailure({}, 'missing flags');
expectConfigFailure({
  EQUINOX_ENABLE_ACTIVE_V2_SHADOW_COMPARISON: 'true',
  EQUINOX_ACTIVE_V2_SHADOW_COLLECTION: 'pokemonsets',
  EQUINOX_ACTIVE_V2_SHADOW_READ_ONLY: 'true',
  EQUINOX_DATA_MODE: 'mongo',
  EQUINOX_ALLOW_DATABASE_WRITES: 'false',
}, 'production collection');
expectConfigFailure({
  EQUINOX_ENABLE_ACTIVE_V2_SHADOW_COMPARISON: 'true',
  EQUINOX_ACTIVE_V2_SHADOW_COLLECTION: 'pokemonsets_v2_staging',
  EQUINOX_ACTIVE_V2_SHADOW_READ_ONLY: 'true',
  EQUINOX_DATA_MODE: 'mongo',
  EQUINOX_ALLOW_DATABASE_WRITES: 'true',
}, 'writes enabled');

console.log('[Equinox] Active V2 shadow config validation passed.');
