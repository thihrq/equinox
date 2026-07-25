import { PokemonData } from '../core/AnalysisContext';
import { getPokemonTypes, getVariant } from '../utils/PokemonUtils';

export interface OffensiveScoreBreakdown {
  physicalPressure: number;
  specialPressure: number;
  spreadDamage: number;
  priorityPressure: number;
  coverageBreadth: number;
  strategyConversion: number;
  outsideStrategyPlan: number;
  setupDependencyPenalty: number;
  finalScore: number;
}

export interface OffensiveScoreContribution {
  rawValue: number;
  normalizedValue: number;
  weight: number;
  weightedValue: number;
}

export type StrategyQualityReason =
  | 'INSUFFICIENT_PHYSICAL_PRESSURE'
  | 'INSUFFICIENT_SPECIAL_PRESSURE'
  | 'LIMITED_STAB_COVERAGE'
  | 'PHYSICAL_SPECIAL_ASYMMETRY'
  | 'INSUFFICIENT_SPREAD_DAMAGE'
  | 'INSUFFICIENT_COVERAGE'
  | 'INSUFFICIENT_STRATEGY_CONVERSION'
  | 'NO_OUTSIDE_STRATEGY_PLAN'
  | 'EXCESSIVE_SETUP_DEPENDENCY';

export interface ComprehensiveOffensiveScoreDiagnostics {
  breakdown: OffensiveScoreBreakdown;
  contributions: Record<string, OffensiveScoreContribution>;
  reasons: StrategyQualityReason[];
}

const ALL_TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Ghost', 'Psychic', 'Bug',
  'Rock', 'Dragon', 'Dark', 'Steel', 'Fairy',
];

/**
 * Calcula o breakdown determinístico do score ofensivo preservando EXATAMENTE
 * a mesma fórmula canônica de FullTeamEvaluator.ts para paridade matemática total.
 */
export function diagnoseOffensiveScore(
  team: PokemonData[],
  format: string,
): ComprehensiveOffensiveScoreDiagnostics {
  const offensiveTypes = new Set<string>();
  for (const pokemon of team) {
    const types = getPokemonTypes(pokemon, format);
    for (const type of types) {
      offensiveTypes.add(type);
    }
  }

  const coverageRatio = offensiveTypes.size / 18.0;
  const coverageBreadth = Math.round(coverageRatio * 100);

  let physicalAttackers = 0;
  let specialAttackers = 0;
  let physicalPressureTotal = 0;
  let specialPressureTotal = 0;

  for (const pokemon of team) {
    const variant = getVariant(pokemon, format);
    const atk = Number(variant?.baseStats?.atk ?? 0);
    const spa = Number(variant?.baseStats?.spa ?? 0);

    if (atk >= 100) physicalAttackers++;
    if (spa >= 100) specialAttackers++;

    physicalPressureTotal += atk;
    specialPressureTotal += spa;
  }

  let balancePenalty = 0;
  const reasons: StrategyQualityReason[] = [];

  if (physicalAttackers === 0) {
    reasons.push('INSUFFICIENT_PHYSICAL_PRESSURE');
  }
  if (specialAttackers === 0) {
    reasons.push('INSUFFICIENT_SPECIAL_PRESSURE');
  }

  if (physicalAttackers === 0 || specialAttackers === 0) {
    balancePenalty = 25;
    reasons.push('PHYSICAL_SPECIAL_ASYMMETRY');
  } else {
    const ratio = Math.min(physicalAttackers, specialAttackers) /
      Math.max(physicalAttackers, specialAttackers);
    balancePenalty = Math.round((1 - ratio) * 15);
    if (balancePenalty > 5) {
      reasons.push('PHYSICAL_SPECIAL_ASYMMETRY');
    }
  }

  if (coverageRatio < 0.6) {
    reasons.push('LIMITED_STAB_COVERAGE');
    reasons.push('INSUFFICIENT_COVERAGE');
  }

  const rawScore = coverageRatio * 100 - balancePenalty;
  const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  const breakdown: OffensiveScoreBreakdown = {
    physicalPressure: Math.min(100, Math.round((physicalPressureTotal / (team.length * 120)) * 100)),
    specialPressure: Math.min(100, Math.round((specialPressureTotal / (team.length * 120)) * 100)),
    spreadDamage: 50,
    priorityPressure: 50,
    coverageBreadth,
    strategyConversion: 50,
    outsideStrategyPlan: 50,
    setupDependencyPenalty: 0,
    finalScore,
  };

  const contributions: Record<string, OffensiveScoreContribution> = {
    coverageRatio: {
      rawValue: coverageRatio,
      normalizedValue: coverageBreadth,
      weight: 1.0,
      weightedValue: coverageRatio * 100,
    },
    balancePenalty: {
      rawValue: balancePenalty,
      normalizedValue: balancePenalty,
      weight: -1.0,
      weightedValue: -balancePenalty,
    },
  };

  return {
    breakdown,
    contributions,
    reasons,
  };
}
