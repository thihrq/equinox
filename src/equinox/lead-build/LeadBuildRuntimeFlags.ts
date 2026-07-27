export interface LeadBuildRuntimeFlags {
  anytimeCompositionSearchEnabled: boolean;
  legacySearchFallbackEnabled: boolean;
}

export function getLeadBuildRuntimeFlags(env: Record<string, string | undefined> = process.env): LeadBuildRuntimeFlags {
  const anytimeDisabled = env.EQUINOX_ANYTIME_SEARCH_ENABLED === 'false';
  const legacyEnabled = env.EQUINOX_LEGACY_SEARCH_FALLBACK === 'true';

  return {
    anytimeCompositionSearchEnabled: !anytimeDisabled,
    legacySearchFallbackEnabled: legacyEnabled,
  };
}
