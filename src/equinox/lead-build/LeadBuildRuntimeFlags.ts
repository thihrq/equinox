export interface LeadBuildRuntimeFlags {
  anytimeCompositionSearchEnabled: boolean;
  legacySearchFallbackEnabled: boolean;
  weaknessPenaltyWeight: number;
}

function parseWeaknessPenaltyWeight(value: string | undefined): number {
  if (value === undefined) return 0;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) return 0;
  return parsed;
}

export function getLeadBuildRuntimeFlags(env: Record<string, string | undefined> = process.env): LeadBuildRuntimeFlags {
  const anytimeDisabled = env.EQUINOX_ANYTIME_SEARCH_ENABLED === 'false';
  const legacyEnabled = env.EQUINOX_LEGACY_SEARCH_FALLBACK === 'true';

  return {
    anytimeCompositionSearchEnabled: !anytimeDisabled,
    legacySearchFallbackEnabled: legacyEnabled,
    weaknessPenaltyWeight: parseWeaknessPenaltyWeight(env.EQUINOX_WEAKNESS_PENALTY_WEIGHT),
  };
}
