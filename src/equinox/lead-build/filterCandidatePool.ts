import { PokemonData } from '../core/AnalysisContext';
import { getSpeciesClauseKey } from '../utils/PokemonUtils';
import { isMegaOption } from '../utils/VgcSetOptimizer';
import { CandidateSearchContext } from './CandidateSearchContext';

import { evaluateSetCoherence } from './SetCoherenceEvaluator';

export type CandidateRejectionReason =
  | 'INVALID'
  | 'FORMAT_MISMATCH'
  | 'SPECIES_CLAUSE'
  | 'MEGA_LIMIT'
  | 'ITEM_CLAUSE'
  | 'SET_COHERENCE';

export interface CandidateFilterStats {
  rejectedInvalid: number;
  rejectedFormat: number;
  rejectedSpecies: number;
  rejectedMega: number;
  rejectedItem: number;
  rejectedSetCoherence: number;
}

export interface CandidateFilterResult {
  accepted: readonly PokemonData[];
  rejected: readonly {
    candidateId: string;
    reason: CandidateRejectionReason;
  }[];
  stats: CandidateFilterStats;
}

/**
 * Aplica os filtros rígidos determinísticos (Hard Constraints) aos candidatos
 * ANTES que ingressem na expansão do beam search.
 */
export function filterCandidatePool(
  candidates: readonly PokemonData[],
  context: CandidateSearchContext,
): CandidateFilterResult {
  const accepted: PokemonData[] = [];
  const rejected: { candidateId: string; reason: CandidateRejectionReason }[] = [];

  const stats: CandidateFilterStats = {
    rejectedInvalid: 0,
    rejectedFormat: 0,
    rejectedSpecies: 0,
    rejectedMega: 0,
    rejectedItem: 0,
    rejectedSetCoherence: 0,
  };

  for (const candidate of candidates) {
    const candidateId = candidate?.name ?? 'unknown';

    // 1. Validade básica
    if (!candidate || !candidate.name) {
      stats.rejectedInvalid++;
      rejected.push({ candidateId, reason: 'INVALID' });
      continue;
    }

    // 2. Species Clause
    const speciesKey = getSpeciesClauseKey(candidate.name);
    if (context.existingSpecies.has(speciesKey)) {
      stats.rejectedSpecies++;
      rejected.push({ candidateId, reason: 'SPECIES_CLAUSE' });
      continue;
    }

    // 3. Mega Limit
    const isMega = isMegaOption(candidate) ||
      candidate.name.includes('-Mega') ||
      (candidate.item && candidate.item.toLowerCase().endsWith('ite'));

    if (context.megaAlreadyUsed && isMega) {
      stats.rejectedMega++;
      rejected.push({ candidateId, reason: 'MEGA_LIMIT' });
      continue;
    }

    // 4. Item Clause (quando aplicável)
    if (candidate.item && context.existingItems.has(candidate.item)) {
      stats.rejectedItem++;
      rejected.push({ candidateId, reason: 'ITEM_CLAUSE' });
      continue;
    }

    // 5. Coerência interna do Set
    const setCoherence = evaluateSetCoherence(candidate);
    if (!setCoherence.valid) {
      stats.rejectedSetCoherence++;
      rejected.push({ candidateId, reason: 'SET_COHERENCE' });
      continue;
    }

    accepted.push(candidate);
  }

  console.log(
    `[CandidateFilter] input=${candidates.length} accepted=${accepted.length} ` +
    `rejectedInvalid=${stats.rejectedInvalid} rejectedFormat=${stats.rejectedFormat} ` +
    `rejectedSpecies=${stats.rejectedSpecies} rejectedMega=${stats.rejectedMega} ` +
    `rejectedItem=${stats.rejectedItem} rejectedSetCoherence=${stats.rejectedSetCoherence}`,
  );

  return {
    accepted,
    rejected,
    stats,
  };
}
