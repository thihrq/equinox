import { PokemonData } from '../core/AnalysisContext';
import { getSpeciesClauseKey } from '../utils/PokemonUtils';
import { isMegaOption } from '../utils/VgcSetOptimizer';
import { CandidateSearchContext } from './CandidateSearchContext';

export type CandidateRejectionReason =
  | 'INVALID'
  | 'FORMAT_MISMATCH'
  | 'SPECIES_CLAUSE'
  | 'MEGA_LIMIT'
  | 'ITEM_CLAUSE';

export interface CandidateFilterStats {
  rejectedInvalid: number;
  rejectedFormat: number;
  rejectedSpecies: number;
  rejectedMega: number;
  rejectedItem: number;
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
    const isMega = isMegaOption(candidate) || (candidate.item && candidate.item.toLowerCase().endsWith('ite'));
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

    accepted.push(candidate);
  }

  console.log(
    `[CandidateFilter] input=${candidates.length} accepted=${accepted.length} ` +
    `rejectedInvalid=${stats.rejectedInvalid} rejectedFormat=${stats.rejectedFormat} ` +
    `rejectedSpecies=${stats.rejectedSpecies} rejectedMega=${stats.rejectedMega} ` +
    `rejectedItem=${stats.rejectedItem}`,
  );

  return {
    accepted,
    rejected,
    stats,
  };
}
