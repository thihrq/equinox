export function isReferenceBootstrapEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.EQUINOX_CHAMPIONS_ALLOW_NETWORK_READS === 'true' && env.EQUINOX_CHAMPIONS_REFERENCE_BOOTSTRAP === 'true';
}

export function isReferenceOfflineEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.EQUINOX_CHAMPIONS_ALLOW_NETWORK_READS !== 'true' && env.EQUINOX_CHAMPIONS_REFERENCE_BOOTSTRAP !== 'true';
}
