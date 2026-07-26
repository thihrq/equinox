export type StrategyProfileId =
  | 'trick_room'
  | 'weather'
  | 'tailwind'
  | 'redirect_setup'
  | 'defensive_core'
  | 'terrain'
  | 'balanced';

export interface ResolvedStrategyProfile {
  strategyId: string;
  profileId: StrategyProfileId;
  weather?: 'sun' | 'rain' | 'sand' | 'snow';
  speedMode?: 'tailwind' | 'trick_room' | 'neutral';
  fallbackUsed: boolean;
  reason?: string;
}

const STRATEGY_PROFILE_REGISTRY: Record<string, Omit<ResolvedStrategyProfile, 'strategyId' | 'fallbackUsed'>> = {
  sun_offense: { profileId: 'weather', weather: 'sun' },
  rain_offense: { profileId: 'weather', weather: 'rain' },
  sand_offense: { profileId: 'weather', weather: 'sand' },
  sand_rush: { profileId: 'weather', weather: 'sand' },
  snow_offense: { profileId: 'weather', weather: 'snow' },
  tailwind_rush: { profileId: 'tailwind', speedMode: 'tailwind' },
  trick_room: { profileId: 'trick_room', speedMode: 'trick_room' },
  redirect_setup: { profileId: 'redirect_setup' },
  defensive_core: { profileId: 'defensive_core' },
  terrain: { profileId: 'terrain' },
  terrain_offense: { profileId: 'terrain' },
  weather: { profileId: 'weather' },
  tailwind: { profileId: 'tailwind', speedMode: 'tailwind' },
  balanced: { profileId: 'balanced' },
  balanced_fallback: { profileId: 'balanced' },
};

const loggedFallbackStrategyIds = new Set<string>();

/**
 * Normaliza o ID de uma estratégia em seu perfil formal correspondente.
 * Faz log de aviso uma única vez por ID se for desconhecido.
 */
export function resolveStrategyProfile(strategyId: string): ResolvedStrategyProfile {
  const normalized = (strategyId || '').toLowerCase().trim();

  if (normalized in STRATEGY_PROFILE_REGISTRY) {
    const entry = STRATEGY_PROFILE_REGISTRY[normalized];
    return {
      strategyId,
      profileId: entry.profileId,
      weather: entry.weather,
      speedMode: entry.speedMode,
      fallbackUsed: false,
    };
  }

  if (!loggedFallbackStrategyIds.has(strategyId)) {
    loggedFallbackStrategyIds.add(strategyId);
    console.warn(`[StrategyProfileRegistry] Estratégia desconhecida '${strategyId}'. Aplicando UNKNOWN_STRATEGY_PROFILE_FALLBACK ('balanced').`);
  }

  return {
    strategyId,
    profileId: 'balanced',
    fallbackUsed: true,
    reason: 'UNKNOWN_STRATEGY_PROFILE_FALLBACK',
  };
}
