import { assertChampionsFinalizationFlags } from './championsFinalizationFlags';

const base = { EQUINOX_ENABLE_CHAMPIONS_FINALIZATION: 'true', EQUINOX_CHAMPIONS_FINALIZATION_ONLY: 'true', EQUINOX_CHAMPIONS_ALLOW_NETWORK_READS: 'false', EQUINOX_ALLOW_DATABASE_WRITES: 'false', EQUINOX_CHAMPIONS_REGULATION_ID: 'M-B', EQUINOX_ENABLE_CHAMPIONS_VALIDATED_SETS: 'true', EQUINOX_CHAMPIONS_VALIDATED_SETS_SHADOW_ONLY: 'true', EQUINOX_CHAMPIONS_ALLOW_REVIEW_REQUIRED_FALLBACK: 'false', EQUINOX_CHAMPIONS_VALIDATED_SETS_PERCENTAGE: '0' };
assertChampionsFinalizationFlags(base);
for (const [key, value] of [['EQUINOX_ENABLE_CHAMPIONS_FINALIZATION', 'false'], ['EQUINOX_CHAMPIONS_FINALIZATION_ONLY', 'false'], ['EQUINOX_CHAMPIONS_ALLOW_NETWORK_READS', 'true'], ['EQUINOX_ALLOW_DATABASE_WRITES', 'true'], ['EQUINOX_CHAMPIONS_REGULATION_ID', 'A']] as const) {
  let blocked = false;
  try { assertChampionsFinalizationFlags({ ...base, [key]: value }); } catch { blocked = true; }
  if (!blocked) throw new Error(`CHAMPIONS_FINALIZATION_GUARD_FAILED:${key}`);
}
console.log('champions finalization flags tests passed');
