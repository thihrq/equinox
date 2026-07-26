export type StrategyOffensiveProfileId =
  | 'trick_room'
  | 'redirect_setup'
  | 'defensive_core'
  | 'weather'
  | 'tailwind'
  | 'terrain'
  | 'balanced';

export interface StrategyOffensiveProfile {
  id: StrategyOffensiveProfileId;

  minimumPrimaryPressure: number;
  minimumCoverageBreadth: number;
  minimumStrategyConversion: number;
  minimumOutsideStrategyPlan: number;

  physicalSpecialSymmetryRequired: boolean;
  spreadDamageRequired: boolean;
  priorityPressureRequired: boolean;

  fallbackUsed?: boolean;
}

const PROFILES: Record<StrategyOffensiveProfileId, StrategyOffensiveProfile> = {
  trick_room: {
    id: 'trick_room',
    minimumPrimaryPressure: 60,
    minimumCoverageBreadth: 30,
    minimumStrategyConversion: 40,
    minimumOutsideStrategyPlan: 40,
    physicalSpecialSymmetryRequired: false,
    spreadDamageRequired: false,
    priorityPressureRequired: false,
  },
  redirect_setup: {
    id: 'redirect_setup',
    minimumPrimaryPressure: 60,
    minimumCoverageBreadth: 30,
    minimumStrategyConversion: 40,
    minimumOutsideStrategyPlan: 40,
    physicalSpecialSymmetryRequired: false,
    spreadDamageRequired: false,
    priorityPressureRequired: false,
  },
  defensive_core: {
    id: 'defensive_core',
    minimumPrimaryPressure: 50,
    minimumCoverageBreadth: 30,
    minimumStrategyConversion: 40,
    minimumOutsideStrategyPlan: 40,
    physicalSpecialSymmetryRequired: false,
    spreadDamageRequired: false,
    priorityPressureRequired: false,
  },
  weather: {
    id: 'weather',
    minimumPrimaryPressure: 65,
    minimumCoverageBreadth: 35,
    minimumStrategyConversion: 50,
    minimumOutsideStrategyPlan: 40,
    physicalSpecialSymmetryRequired: false,
    spreadDamageRequired: false,
    priorityPressureRequired: false,
  },
  tailwind: {
    id: 'tailwind',
    minimumPrimaryPressure: 60,
    minimumCoverageBreadth: 35,
    minimumStrategyConversion: 50,
    minimumOutsideStrategyPlan: 40,
    physicalSpecialSymmetryRequired: false,
    spreadDamageRequired: false,
    priorityPressureRequired: false,
  },
  terrain: {
    id: 'terrain',
    minimumPrimaryPressure: 60,
    minimumCoverageBreadth: 35,
    minimumStrategyConversion: 50,
    minimumOutsideStrategyPlan: 40,
    physicalSpecialSymmetryRequired: false,
    spreadDamageRequired: false,
    priorityPressureRequired: false,
  },
  balanced: {
    id: 'balanced',
    minimumPrimaryPressure: 65,
    minimumCoverageBreadth: 45,
    minimumStrategyConversion: 50,
    minimumOutsideStrategyPlan: 50,
    physicalSpecialSymmetryRequired: true,
    spreadDamageRequired: false,
    priorityPressureRequired: false,
  },
};

import { resolveStrategyProfile } from './StrategyProfileRegistry';

/**
 * Retorna o perfil de qualidade ofensiva contextualizado para a estratégia solicitada.
 * Se a estratégia for desconhecida, faz fallback fail-closed controlado para 'balanced'.
 */
export function getStrategyOffensiveProfile(
  strategyId: string,
): StrategyOffensiveProfile {
  const resolved = resolveStrategyProfile(strategyId);
  const baseProfile = PROFILES[resolved.profileId] || PROFILES.balanced;

  if (resolved.fallbackUsed) {
    return {
      ...baseProfile,
      fallbackUsed: true,
    };
  }

  return baseProfile;
}
