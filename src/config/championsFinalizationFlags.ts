export interface ChampionsFinalizationFlags { enabled: boolean; finalizationOnly: boolean; networkReads: boolean; databaseWrites: boolean; regulationId: string; validatedSetsEnabled: boolean; shadowOnly: boolean; reviewRequiredFallback: boolean; percentage: number; }

const strictTrue = (value: string | undefined): boolean => value === 'true';

export function getChampionsFinalizationFlags(env: Record<string, string | undefined>): ChampionsFinalizationFlags {
  const percentage = Number(env.EQUINOX_CHAMPIONS_VALIDATED_SETS_PERCENTAGE ?? '0');
  return { enabled: strictTrue(env.EQUINOX_ENABLE_CHAMPIONS_FINALIZATION), finalizationOnly: strictTrue(env.EQUINOX_CHAMPIONS_FINALIZATION_ONLY), networkReads: strictTrue(env.EQUINOX_CHAMPIONS_ALLOW_NETWORK_READS), databaseWrites: strictTrue(env.EQUINOX_ALLOW_DATABASE_WRITES), regulationId: env.EQUINOX_CHAMPIONS_REGULATION_ID ?? '', validatedSetsEnabled: strictTrue(env.EQUINOX_ENABLE_CHAMPIONS_VALIDATED_SETS), shadowOnly: strictTrue(env.EQUINOX_CHAMPIONS_VALIDATED_SETS_SHADOW_ONLY), reviewRequiredFallback: strictTrue(env.EQUINOX_CHAMPIONS_ALLOW_REVIEW_REQUIRED_FALLBACK), percentage };
}

export function assertChampionsFinalizationFlags(env: Record<string, string | undefined>): ChampionsFinalizationFlags {
  const flags = getChampionsFinalizationFlags(env);
  if (!flags.enabled) throw new Error('CHAMPIONS_FINALIZATION_DISABLED');
  if (!flags.finalizationOnly) throw new Error('CHAMPIONS_FINALIZATION_MODE_REQUIRED');
  if (flags.networkReads) throw new Error('CHAMPIONS_FINALIZATION_NETWORK_MUST_BE_DISABLED');
  if (flags.databaseWrites) throw new Error('CHAMPIONS_DATABASE_WRITES_MUST_BE_DISABLED');
  if (flags.regulationId !== 'M-B') throw new Error('CHAMPIONS_REGULATION_ID_MISMATCH');
  if (flags.percentage < 0 || flags.percentage > 100 || !Number.isInteger(flags.percentage)) throw new Error('CHAMPIONS_VALIDATED_SETS_PERCENTAGE_INVALID');
  if (flags.validatedSetsEnabled && !flags.shadowOnly) throw new Error('CHAMPIONS_FINALIZATION_PUBLIC_SERVE_MUST_REMAIN_DISABLED');
  if (flags.reviewRequiredFallback) throw new Error('CHAMPIONS_REVIEW_REQUIRED_FALLBACK_MUST_REMAIN_DISABLED');
  return flags;
}
