import {
  getStrategyOffensiveProfile,
  StrategyOffensiveProfileId,
} from './StrategyOffensiveProfile';
import {
  OffensiveScoreBreakdown,
  StructuredGateReason,
  OffensivePressureMetadata,
  OffensiveCoverageMetadata,
  toStructuredGateReason,
} from './StrategyQualityDiagnostics';
import { ALL_POKEMON_TYPES, PokemonType } from './TeamDefensiveProfile';

export interface StrategyQualityResult {
  valid: boolean;
  profileId: StrategyOffensiveProfileId;
  primaryPressure: number;
  generalOffensiveScore: number;
  contextualOffensiveScore: number;
  breakdown: OffensiveScoreBreakdown;
  reasons: readonly StructuredGateReason[];
}

function buildPressureReason(
  breakdown: OffensiveScoreBreakdown,
  minimumPrimaryPressure: number,
): StructuredGateReason {
  const { physicalPressure, specialPressure } = breakdown;
  const primaryPressure = Math.max(physicalPressure, specialPressure);

  // O gate testa max(physical, special) < threshold. Se ele falhou, os DOIS
  // lados são necessariamente < threshold (o maior dos dois já é menor que
  // o limite) — não é seguro inferir que só um lado está deficiente.
  const metadata: OffensivePressureMetadata = {
    physicalPressure,
    specialPressure,
    minimumPrimaryPressure,
    primaryPressure,
    deficientSides: ['physical', 'special'],
    strongestSide:
      physicalPressure > specialPressure
        ? 'physical'
        : specialPressure > physicalPressure
          ? 'special'
          : 'balanced',
  };

  return { reasonCode: 'INSUFFICIENT_PRIMARY_PRESSURE', metadata };
}

function buildCoverageReason(
  breakdown: OffensiveScoreBreakdown,
  minimumCoverageBreadth: number,
): StructuredGateReason {
  const present = breakdown.offensiveTypesPresent ?? [];
  const presentSet = new Set<string>(present);
  const uncoveredTypes = (ALL_POKEMON_TYPES as readonly string[])
    .filter(type => !presentSet.has(type)) as PokemonType[];

  const metadata: OffensiveCoverageMetadata = {
    coverageBreadth: breakdown.coverageBreadth,
    minimumCoverageBreadth,
    offensiveTypesPresent: present,
    uncoveredTypes,
  };

  return { reasonCode: 'INSUFFICIENT_COVERAGE', metadata };
}

/**
 * Avalia se um time atende à barra de qualidade ofensiva contextualizada pela sua estratégia.
 * Mantém legalidade e completude como gates absolutos invioláveis.
 */
export function evaluateStrategyQuality(input: {
  strategyId: string;
  legal: boolean;
  strategyComplete: boolean;
  breakdown: OffensiveScoreBreakdown;
}): StrategyQualityResult {
  const { strategyId, legal, strategyComplete, breakdown } = input;
  const profile = getStrategyOffensiveProfile(strategyId);

  // Gates absolutos invioláveis
  if (!legal) {
    return {
      valid: false,
      profileId: profile.id,
      primaryPressure: 0,
      generalOffensiveScore: breakdown.finalScore,
      contextualOffensiveScore: 0,
      breakdown,
      reasons: [toStructuredGateReason('ILLEGAL_TEAM')],
    };
  }

  if (!strategyComplete) {
    return {
      valid: false,
      profileId: profile.id,
      primaryPressure: 0,
      generalOffensiveScore: breakdown.finalScore,
      contextualOffensiveScore: 0,
      breakdown,
      reasons: [toStructuredGateReason('INCOMPLETE_STRATEGY')],
    };
  }

  const primaryPressure = Math.max(
    breakdown.physicalPressure,
    breakdown.specialPressure,
  );

  const reasons: StructuredGateReason[] = [];

  if (primaryPressure < profile.minimumPrimaryPressure) {
    reasons.push(buildPressureReason(breakdown, profile.minimumPrimaryPressure));
  }

  if (breakdown.coverageBreadth < profile.minimumCoverageBreadth) {
    reasons.push(buildCoverageReason(breakdown, profile.minimumCoverageBreadth));
  }

  if (breakdown.strategyConversion < profile.minimumStrategyConversion) {
    reasons.push(toStructuredGateReason('INSUFFICIENT_STRATEGY_CONVERSION'));
  }

  if (breakdown.outsideStrategyPlan < profile.minimumOutsideStrategyPlan) {
    reasons.push(toStructuredGateReason('NO_OUTSIDE_STRATEGY_PLAN'));
  }

  if (
    profile.physicalSpecialSymmetryRequired &&
    Math.min(breakdown.physicalPressure, breakdown.specialPressure) < 40
  ) {
    reasons.push(toStructuredGateReason('PHYSICAL_SPECIAL_ASYMMETRY'));
  }

  const contextualOffensiveScore = Math.round(
    primaryPressure * 0.35 +
    breakdown.coverageBreadth * 0.25 +
    breakdown.strategyConversion * 0.20 +
    breakdown.outsideStrategyPlan * 0.20,
  );

  const valid = reasons.length === 0;

  return {
    valid,
    profileId: profile.id,
    primaryPressure,
    generalOffensiveScore: breakdown.finalScore,
    contextualOffensiveScore,
    breakdown,
    reasons,
  };
}
