import { RecoveryCapabilityRequest } from './RecoveryCapabilityPlanner';
import { CandidateCapabilityClassifier } from './CandidateCapabilityClassifier';

export interface RecoveryCandidateQuery {
  format: string;
  strategyId: string;
  leadCandidateIds: readonly string[];

  requiredCapabilities: readonly RecoveryCapabilityRequest[];

  excludedCandidateIds: readonly string[];
  excludedCapabilityKeys: readonly string[];

  maximumRawCandidates: number;
  maximumUsableCandidates: number;
}

export interface RecoveryFetchResult {
  rawFetched: number;
  usableCandidates: readonly any[];
  fetchedCandidateIds: readonly string[];
  sourceExhausted: boolean;
}

export class RecoveryCandidateFetcher {
  private readonly classifier = new CandidateCapabilityClassifier();

  async fetchTargetedRecoveryCandidates(
    query: RecoveryCandidateQuery,
    availableUniverse: readonly any[],
  ): Promise<RecoveryFetchResult> {
    const excludedIds = new Set(query.excludedCandidateIds);
    const excludedKeys = new Set(query.excludedCapabilityKeys);

    const candidatesToFilter = availableUniverse.filter(c => {
      const id = c._id || c.id || c.candidateId || c.species;
      return !excludedIds.has(id);
    });

    const matchingCandidates: any[] = [];
    const fetchedIds: string[] = [];

    for (const cand of candidatesToFilter) {
      if (matchingCandidates.length >= query.maximumUsableCandidates) break;

      const profile = this.classifier.classify({
        candidateId: cand.candidateId || cand.species,
        species: cand.species,
        setId: cand.setId || `${cand.species}-set`,
        types: cand.types || ['Normal'],
        item: cand.item,
        ability: cand.ability,
        moves: cand.moves,
      });

      // Verificar se satisfaz ao menos uma capacidade solicitada no plano
      const satisfiesRequest = query.requiredCapabilities.some(req => {
        const allCaps = [...profile.defensiveCapabilities, ...profile.strategicCapabilities];
        return allCaps.some(cap => {
          if (cap.capability === req.capability) {
            if (req.attackType) return cap.attackType === req.attackType;
            return true;
          }
          return false;
        });
      });

      if (satisfiesRequest) {
        // Garantir deduplicação por chave de diversidade
        const hasNewDiversityKey = profile.diversityKeys.some(k => !excludedKeys.has(k));
        if (hasNewDiversityKey) {
          matchingCandidates.push(cand);
          fetchedIds.push(cand.candidateId || cand.species);
          for (const dKey of profile.diversityKeys) {
            excludedKeys.add(dKey);
          }
        }
      }
    }

    return {
      rawFetched: candidatesToFilter.length,
      usableCandidates: matchingCandidates,
      fetchedCandidateIds: fetchedIds,
      sourceExhausted: true,
    };
  }
}
