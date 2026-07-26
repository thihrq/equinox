import { PokemonData } from '../core/AnalysisContext';
import { getSpeciesClauseKey } from '../utils/PokemonUtils';
import { CandidateSearchContext } from './CandidateSearchContext';
import { filterCandidatePool, CandidateFilterStats } from './filterCandidatePool';
import { stratifyCandidatePool } from './CandidatePoolStratifier';

export interface CandidatePoolOptions {
  targetUsableCandidates: number;
  maximumRawCandidates: number;
  batchSize: number;
}

export interface ReplenishedCandidatePool {
  usableCandidates: readonly PokemonData[];
  rawFetched: number;
  batchesFetched: number;
  exhausted: boolean;
  duplicateCount: number;
  rejectionStats: CandidateFilterStats;
}

const DEFAULT_OPTIONS: CandidatePoolOptions = {
  targetUsableCandidates: 40,
  maximumRawCandidates: 150,
  batchSize: 30,
};

function getCandidateDeduplicationKey(candidate: PokemonData): string {
  const speciesKey = getSpeciesClauseKey(candidate.name);
  const setKey = candidate.competitiveSet?.setId ?? candidate.competitiveSet?.setSource ?? candidate.name;
  return `${speciesKey}_${setKey}`;
}

/**
 * Reabastece e filtra o pool de candidatos utilizáveis até atingir targetUsableCandidates,
 * deduplicando por espécie e set, eliminando candidatos impossíveis (ex: Megas quando a lead já usa Mega)
 * e acumulando estatísticas observáveis sem risco de loop infinito.
 */
export function replenishCandidatePool(
  rawCandidates: readonly PokemonData[],
  context: CandidateSearchContext,
  options?: Partial<CandidatePoolOptions>,
): ReplenishedCandidatePool {
  const opts: CandidatePoolOptions = { ...DEFAULT_OPTIONS, ...options };

  const usableMap = new Map<string, PokemonData>();
  const seenRawKeys = new Set<string>();

  let rawFetched = 0;
  let batchesFetched = 0;
  let duplicateCount = 0;
  let exhausted = false;

  const accumulatedStats: CandidateFilterStats = {
    rejectedInvalid: 0,
    rejectedFormat: 0,
    rejectedSpecies: 0,
    rejectedMega: 0,
    rejectedItem: 0,
    rejectedSetCoherence: 0,
  };

  const totalRawAvailable = rawCandidates.length;

  while (
    usableMap.size < opts.targetUsableCandidates &&
    rawFetched < opts.maximumRawCandidates &&
    rawFetched < totalRawAvailable
  ) {
    batchesFetched++;
    const nextOffset = rawFetched;
    const batch = rawCandidates.slice(nextOffset, nextOffset + opts.batchSize);

    if (batch.length === 0) {
      exhausted = true;
      break;
    }

    rawFetched += batch.length;

    // Deduplicação inicial do batch
    const uniqueBatch: PokemonData[] = [];
    for (const candidate of batch) {
      const key = getCandidateDeduplicationKey(candidate);
      if (seenRawKeys.has(key)) {
        duplicateCount++;
      } else {
        seenRawKeys.add(key);
        uniqueBatch.push(candidate);
      }
    }

    // Filtragem rígida antecipada
    const filterResult = filterCandidatePool(uniqueBatch, context);

    accumulatedStats.rejectedInvalid += filterResult.stats.rejectedInvalid;
    accumulatedStats.rejectedFormat += filterResult.stats.rejectedFormat;
    accumulatedStats.rejectedSpecies += filterResult.stats.rejectedSpecies;
    accumulatedStats.rejectedMega += filterResult.stats.rejectedMega;
    accumulatedStats.rejectedItem += filterResult.stats.rejectedItem;
    accumulatedStats.rejectedSetCoherence += filterResult.stats.rejectedSetCoherence;

    for (const acceptedCandidate of filterResult.accepted) {
      const key = getCandidateDeduplicationKey(acceptedCandidate);
      if (!usableMap.has(key)) {
        usableMap.set(key, acceptedCandidate);
        if (usableMap.size >= opts.targetUsableCandidates) {
          break;
        }
      }
    }

    if (rawFetched >= totalRawAvailable) {
      exhausted = true;
    }
  }

  const rawUsable = Array.from(usableMap.values());
  const usableCandidates = stratifyCandidatePool(rawUsable, context);

  console.log(
    `[CandidateFetch] rawFetched=${rawFetched} batchesFetched=${batchesFetched} duplicates=${duplicateCount} ` +
    `rejectedMega=${accumulatedStats.rejectedMega} rejectedSpecies=${accumulatedStats.rejectedSpecies} ` +
    `rejectedFormat=${accumulatedStats.rejectedFormat} rejectedInvalid=${accumulatedStats.rejectedInvalid} ` +
    `rejectedItem=${accumulatedStats.rejectedItem} usable=${usableCandidates.length} target=${opts.targetUsableCandidates} exhausted=${exhausted}`,
  );

  return {
    usableCandidates,
    rawFetched,
    batchesFetched,
    exhausted,
    duplicateCount,
    rejectionStats: accumulatedStats,
  };
}
