import {
  getStrategyOffensiveProfile,
  StrategyOffensiveProfileId,
} from './StrategyOffensiveProfile';
import {
  OffensiveScoreBreakdown,
  StrategyQualityReason,
} from './StrategyQualityDiagnostics';

export interface StrategyQualityResult {
  valid: boolean;
  profileId: StrategyOffensiveProfileId;
  primaryPressure: number;
  generalOffensiveScore: number;
  contextualOffensiveScore: number;
  breakdown: OffensiveScoreBreakdown;
  reasons: readonly StrategyQualityReason[];
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
      reasons: ['ILLEGAL_TEAM' as any],
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
      reasons: ['INCOMPLETE_STRATEGY' as any],
    };
  }

  const primaryPressure = Math.max(
    breakdown.physicalPressure,
    breakdown.specialPressure,
  );

  const reasons: StrategyQualityReason[] = [];

  if (primaryPressure < profile.minimumPrimaryPressure) {
    reasons.push('INSUFFICIENT_PHYSICAL_PRESSURE');
  }

  if (breakdown.coverageBreadth < profile.minimumCoverageBreadth) {
    reasons.push('INSUFFICIENT_COVERAGE');
  }

  if (breakdown.strategyConversion < profile.minimumStrategyConversion) {
    reasons.push('INSUFFICIENT_STRATEGY_CONVERSION');
  }

  if (breakdown.outsideStrategyPlan < profile.minimumOutsideStrategyPlan) {
    reasons.push('NO_OUTSIDE_STRATEGY_PLAN');
  }

  if (
    profile.physicalSpecialSymmetryRequired &&
    Math.min(breakdown.physicalPressure, breakdown.specialPressure) < 40
  ) {
    reasons.push('PHYSICAL_SPECIAL_ASYMMETRY');
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
