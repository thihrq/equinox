import { ACTIVE_STAGING_CONFIG_EXIT_CODE } from './ActiveStagingHomologationTypes';

export interface ActiveStagingHomologationConfig {
  enabled: boolean;
  collectionName: string;
  readOnly: boolean;
  dataMode: string | undefined;
  allowDatabaseWrites: boolean;
}

export class ActiveStagingConfigError extends Error {
  public readonly exitCode = ACTIVE_STAGING_CONFIG_EXIT_CODE;
}

export function readActiveStagingHomologationConfig(env: NodeJS.ProcessEnv = process.env): ActiveStagingHomologationConfig {
  return {
    enabled: env.EQUINOX_ENABLE_ACTIVE_STAGING_HOMOLOGATION === 'true',
    collectionName: env.EQUINOX_ACTIVE_STAGING_COLLECTION ?? '',
    readOnly: env.EQUINOX_ACTIVE_STAGING_READ_ONLY === 'true',
    dataMode: env.EQUINOX_DATA_MODE,
    allowDatabaseWrites: env.EQUINOX_ALLOW_DATABASE_WRITES === 'true',
  };
}

export function assertActiveStagingHomologationConfig(config: ActiveStagingHomologationConfig): ActiveStagingHomologationConfig & { collectionName: 'pokemonsets_v2_staging'; enabled: true; readOnly: true } {
  const failures = [
    config.enabled ? null : 'EQUINOX_ENABLE_ACTIVE_STAGING_HOMOLOGATION=true is required',
    config.collectionName === 'pokemonsets_v2_staging' ? null : 'EQUINOX_ACTIVE_STAGING_COLLECTION=pokemonsets_v2_staging is required',
    config.readOnly ? null : 'EQUINOX_ACTIVE_STAGING_READ_ONLY=true is required',
    config.dataMode === 'mongo' ? null : 'EQUINOX_DATA_MODE=mongo is required',
    config.allowDatabaseWrites === false ? null : 'EQUINOX_ALLOW_DATABASE_WRITES=false is required',
  ].filter((failure): failure is string => Boolean(failure));
  if (failures.length) throw new ActiveStagingConfigError(`Active staging functional homologation config failed:\n- ${failures.join('\n- ')}`);
  return { ...config, enabled: true, readOnly: true, collectionName: 'pokemonsets_v2_staging' };
}
