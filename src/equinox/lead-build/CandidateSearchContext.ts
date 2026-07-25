import { PokemonData } from '../core/AnalysisContext';
import { getSpeciesClauseKey } from '../utils/PokemonUtils';
import { isMegaOption } from '../utils/VgcSetOptimizer';
import { ComprehensiveOffensiveScoreDiagnostics, OffensiveScoreBreakdown } from './StrategyQualityDiagnostics';

export interface CandidateSearchContext {
  existingSpecies: ReadonlySet<string>;
  existingItems: ReadonlySet<string>;
  megaAlreadyUsed: boolean;
  format: string;
  strategyId: string;
  preferredRoles: readonly string[];
  missingOffensiveDimensions: readonly string[];
}

/**
 * Cria o contexto de limites e restrições da busca a partir dos Pokémon da lead
 * e diagnósticos prévios.
 */
export function createCandidateSearchContext(
  lead: readonly PokemonData[],
  format: string,
  strategyId: string,
  diagnostics?: ComprehensiveOffensiveScoreDiagnostics | OffensiveScoreBreakdown,
): CandidateSearchContext {
  const existingSpecies = new Set<string>();
  const existingItems = new Set<string>();
  let megaAlreadyUsed = false;

  for (const pokemon of lead) {
    if (!pokemon) continue;
    const speciesKey = getSpeciesClauseKey(pokemon.name);
    existingSpecies.add(speciesKey);

    if (pokemon.item) {
      existingItems.add(pokemon.item);
    }

    if (isMegaOption(pokemon) || (pokemon.item && pokemon.item.toLowerCase().endsWith('ite'))) {
      megaAlreadyUsed = true;
    }
  }

  const missingOffensiveDimensions: string[] = [];

  const reasons = (diagnostics as ComprehensiveOffensiveScoreDiagnostics)?.reasons ?? [];
  if (reasons.includes('LIMITED_STAB_COVERAGE')) {
    missingOffensiveDimensions.push('stab_coverage');
  }
  if (reasons.includes('INSUFFICIENT_COVERAGE')) {
    missingOffensiveDimensions.push('offensive_coverage');
  }
  if (reasons.includes('INSUFFICIENT_PHYSICAL_PRESSURE')) {
    missingOffensiveDimensions.push('physical_pressure');
  }
  if (reasons.includes('INSUFFICIENT_SPECIAL_PRESSURE')) {
    missingOffensiveDimensions.push('special_pressure');
  }

  return {
    existingSpecies,
    existingItems,
    megaAlreadyUsed,
    format,
    strategyId,
    preferredRoles: [],
    missingOffensiveDimensions,
  };
}
