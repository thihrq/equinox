import { ACTIVE_V2_SHADOW_CONFIG_EXIT_CODE } from './ActiveV2ShadowTypes';

export interface ActiveV2ShadowConfig {
  enabled: boolean;
  collectionName: string;
  readOnly: boolean;
  dataMode: string | undefined;
  allowDatabaseWrites: boolean;
  allowDatabaseWritesRaw: string | undefined;
}

export class ActiveV2ShadowConfigError extends Error {
  public readonly exitCode = ACTIVE_V2_SHADOW_CONFIG_EXIT_CODE;
}

export function readActiveV2ShadowConfig(env: NodeJS.ProcessEnv = process.env): ActiveV2ShadowConfig {
  return {
    enabled: env.EQUINOX_ENABLE_ACTIVE_V2_SHADOW_COMPARISON === 'true',
    collectionName: env.EQUINOX_ACTIVE_V2_SHADOW_COLLECTION ?? '',
    readOnly: env.EQUINOX_ACTIVE_V2_SHADOW_READ_ONLY === 'true',
    dataMode: env.EQUINOX_DATA_MODE,
    allowDatabaseWrites: env.EQUINOX_ALLOW_DATABASE_WRITES === 'true',
    allowDatabaseWritesRaw: env.EQUINOX_ALLOW_DATABASE_WRITES,
  };
}

export function assertActiveV2ShadowConfig(
  config: ActiveV2ShadowConfig,
): ActiveV2ShadowConfig & { enabled: true; collectionName: 'pokemonsets_v2_staging'; readOnly: true; dataMode: 'mongo' } {
  const failures = [
    config.enabled ? null : 'EQUINOX_ENABLE_ACTIVE_V2_SHADOW_COMPARISON=true is required',
    config.collectionName === 'pokemonsets_v2_staging' ? null : 'EQUINOX_ACTIVE_V2_SHADOW_COLLECTION=pokemonsets_v2_staging is required',
    config.readOnly ? null : 'EQUINOX_ACTIVE_V2_SHADOW_READ_ONLY=true is required',
    config.dataMode === 'mongo' ? null : 'EQUINOX_DATA_MODE=mongo is required',
    config.allowDatabaseWritesRaw === 'false' ? null : 'EQUINOX_ALLOW_DATABASE_WRITES=false is required',
  ].filter((failure): failure is string => Boolean(failure));

  if (failures.length > 0) {
    throw new ActiveV2ShadowConfigError(`Active V2 shadow comparison config failed:\n- ${failures.join('\n- ')}`);
  }

  return {
    ...config,
    enabled: true,
    collectionName: 'pokemonsets_v2_staging',
    readOnly: true,
    dataMode: 'mongo',
  };
}
