export type EquinoxDataMode = 'filesystem' | 'mongo' | 'shadow';

const VALID_DATA_MODES = new Set<EquinoxDataMode>(['filesystem', 'mongo', 'shadow']);

export function resolveDataMode(): EquinoxDataMode {
  const configured = process.env.EQUINOX_DATA_MODE;

  if (configured && VALID_DATA_MODES.has(configured as EquinoxDataMode)) {
    return configured as EquinoxDataMode;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('EQUINOX_DATA_MODE must be explicitly configured in production.');
  }

  return 'filesystem';
}
