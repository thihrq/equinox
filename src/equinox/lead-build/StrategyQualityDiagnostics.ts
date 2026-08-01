import { PokemonData } from '../core/AnalysisContext';
import { getPokemonTypes, getVariant } from '../utils/PokemonUtils';
import { ALL_POKEMON_TYPES, PokemonType } from './TeamDefensiveProfile';

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
  /**
   * Tipos ofensivos realmente presentes no time (canônicos, ordenados,
   * sem duplicatas) — o mesmo Set já computado para `coverageBreadth`,
   * agora preservado em vez de descartado. Opcional para não quebrar
   * fixtures de teste pré-existentes que constroem o breakdown à mão;
   * `diagnoseOffensiveScore` sempre o popula.
   */
  offensiveTypesPresent?: PokemonType[];
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

// ─── Contrato estruturado de evidência de rejeição (104) ──────────────────
//
// Substitui `reasons: string[]` nos gates de decisão por um par
// reasonCode+metadata tipado por reasonCode, para os dois reasons de
// OffensiveQuality que hoje chegam ao FinalistRejectionAggregator sem
// nenhum dado além do rótulo. Os demais reasonCodes (defensivos, de role,
// de legalidade etc.) continuam representados via o membro genérico da
// union (`ExistingGateReasonCode`), sem metadata obrigatória — nenhuma
// mudança de comportamento para eles.

export interface OffensivePressureMetadata {
  physicalPressure: number;
  specialPressure: number;
  minimumPrimaryPressure: number;
  primaryPressure: number;
  deficientSides: Array<'physical' | 'special'>;
  strongestSide: 'physical' | 'special' | 'balanced';
}

export interface OffensiveCoverageMetadata {
  coverageBreadth: number;
  minimumCoverageBreadth: number;
  offensiveTypesPresent: PokemonType[];
  uncoveredTypes: PokemonType[];
}

export type ExistingGateReasonCode = string;
export type ExistingGateReasonMetadata = undefined;

/**
 * União discriminada e fechada — impede que uma string arbitrária seja
 * combinada com metadata incompatível. Os dois reasonCodes ofensivos
 * exigem seu metadata específico; qualquer outro reasonCode cai no membro
 * genérico, sem metadata (`toStructuredGateReason` produz esse membro).
 */
export type StructuredGateReason =
  | {
      reasonCode: 'INSUFFICIENT_PRIMARY_PRESSURE';
      metadata: OffensivePressureMetadata;
    }
  | {
      reasonCode: 'INSUFFICIENT_COVERAGE';
      metadata: OffensiveCoverageMetadata;
    }
  | {
      reasonCode: ExistingGateReasonCode;
      metadata?: ExistingGateReasonMetadata;
    };

/**
 * Alias de compatibilidade — o reasonCode antigo nunca apareceu em
 * payload público (confirmado: `PublicFailClosedDiagnostic.ts` nunca o
 * mapeava, caía sempre no bucket genérico `QUALITY_GATES_NOT_SATISFIED`),
 * então a renomeação é uma substituição direta, não uma migração com dois
 * códigos ativos. Mantido só como documentação do nome anterior.
 */
export type LegacyReasonCode = 'INSUFFICIENT_PHYSICAL_PRESSURE';

/** Adapta um reasonCode simples (sem metadata) para o formato estruturado. */
export function toStructuredGateReason(reasonCode: string): StructuredGateReason {
  return { reasonCode };
}

/**
 * Fonte soberana única para "quantos tipos novos faltam para cruzar o
 * threshold de coverageBreadth" (106). Busca discreta, não fórmula fechada
 * — mais resistente a diferenças de arredondamento do que
 * `ceil(minimum * 18 / 100) - present`, e reproduz EXATAMENTE o mesmo
 * predicado usado pelo gate soberano em `diagnoseOffensiveScore`
 * (`Math.round((count / 18) * 100)`), nunca duplicado independentemente.
 */
export function calculateMinimumAdditionalTypes(
  presentTypeCount: number,
  minimumCoverageBreadth: number,
): number {
  const total = ALL_POKEMON_TYPES.length;
  for (let targetCount = presentTypeCount; targetCount <= total; targetCount += 1) {
    const projectedBreadth = Math.round((targetCount / total) * 100);
    if (projectedBreadth >= minimumCoverageBreadth) {
      return targetCount - presentTypeCount;
    }
  }
  return Math.max(0, total - presentTypeCount);
}

function sortCanonicalTypes(types: Iterable<string>): PokemonType[] {
  const unique = new Set(types);
  return (ALL_POKEMON_TYPES as readonly string[])
    .filter(type => unique.has(type)) as PokemonType[];
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
    // O mesmo Set já usado para calcular coverageBreadth — antes descartado
    // após virar só uma contagem, agora preservado como evidência (104).
    offensiveTypesPresent: sortCanonicalTypes(offensiveTypes),
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
