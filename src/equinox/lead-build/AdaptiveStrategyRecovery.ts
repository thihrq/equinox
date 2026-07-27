import { PokemonData } from '../core/AnalysisContext';
import { LeadCompletionSearchInput, LeadStrategyCandidate } from '../vgc/LeadBuildTypes';
import { filterCandidatePool } from './filterCandidatePool';
import { createCandidateSearchContext } from './CandidateSearchContext';
import { CandidateCapabilityClassifier } from './CandidateCapabilityClassifier';
import { LeadBuildRequestContext } from './LeadBuildRequestContext';
import { RecoveryCapabilityPlan } from './RecoveryCapabilityPlanner';
import { RecoveryCandidateSource } from './ProductionRecoveryCandidateSource';
import { executePrimaryStrategySearch, PrimaryStrategySearchResult } from './PrimaryStrategySearch';

export interface AdaptiveRecoveryResult {
  executed: boolean;
  passesExecuted: number;
  rawCandidatesFetched: number;
  usableCandidatesAdded: number;
  accepted: PrimaryStrategySearchResult['accepted'];
  searchResult?: PrimaryStrategySearchResult;
  stopReason:
    | 'NOT_ELIGIBLE'
    | 'NO_REMAINING_TIME_BUDGET'
    | 'SOURCE_EXHAUSTED'
    | 'NO_CAPABILITY_MATCH'
    | 'QUALITY_GATES_NOT_SATISFIED'
    | 'RECOVERY_SUCCEEDED';
}

function candidateMatchesPlan(
  candidate: PokemonData,
  plan: RecoveryCapabilityPlan,
  classifier: CandidateCapabilityClassifier,
): boolean {
  const set = candidate.competitiveSet;

  const profile = classifier.classify({
    candidateId: set?.setId ?? `${candidate.name}:${candidate.item}`,
    species: candidate.name,
    canonicalSpecies: candidate.name,
    setId: set?.setId ?? set?.setSource ?? `${candidate.name}-recovery`,
    types: (set?.types ?? candidate.types ?? []) as never,
    item: set?.item ?? candidate.item,
    ability: set?.ability ?? candidate.ability,
    moves: set?.moves ?? candidate.moves,
  });

  const capabilities = [...profile.defensiveCapabilities, ...profile.strategicCapabilities];

  return plan.requests.some(request =>
    capabilities.some(capability => {
      if (capability.capability !== request.capability) {
        return false;
      }

      if (request.attackType && capability.attackType !== request.attackType) {
        return false;
      }

      return true;
    }),
  );
}

export class AdaptiveStrategyRecovery {
  private readonly classifier = new CandidateCapabilityClassifier();

  public constructor(private readonly source: RecoveryCandidateSource) {}

  public async execute(params: {
    plan: RecoveryCapabilityPlan;
    strategy: LeadStrategyCandidate;
    lead: [PokemonData, PokemonData];
    primaryCandidates: PokemonData[];
    format: string;
    context: LeadBuildRequestContext;
    resolveCompetitiveTeam: (team: PokemonData[], format: string) => PokemonData[];
  }): Promise<AdaptiveRecoveryResult> {
    const { plan, strategy, lead, primaryCandidates, format, context, resolveCompetitiveTeam } = params;

    if (!plan.eligible) {
      return {
        executed: false,
        passesExecuted: 0,
        rawCandidatesFetched: 0,
        usableCandidatesAdded: 0,
        accepted: [],
        stopReason: 'NOT_ELIGIBLE',
      };
    }

    let rawCandidatesFetched = 0;
    let usableCandidatesAdded = 0;

    const accumulated = new Map<string, PokemonData>();

    for (const candidate of primaryCandidates) {
      const setId = candidate.competitiveSet?.setId ?? candidate.name;
      accumulated.set(`${candidate.name}:${setId}`, candidate);
    }

    for (let pass = 1; pass <= Math.min(plan.maximumPasses, 2); pass += 1) {
      const elapsed = Date.now() - context.startedAtMs;
      const remaining = context.timeBudget.totalBudgetMs - elapsed;

      if (remaining <= context.timeBudget.finalizationReserveMs) {
        return {
          executed: pass > 1,
          passesExecuted: pass - 1,
          rawCandidatesFetched,
          usableCandidatesAdded,
          accepted: [],
          stopReason: 'NO_REMAINING_TIME_BUDGET',
        };
      }

      const excludedSpecies = [
        ...new Set([
          ...lead.map(member => member.name),
          ...Array.from(accumulated.values()).map(candidate => candidate.name),
        ]),
      ];

      const excludedSetIds = Array.from(accumulated.values())
        .map(candidate => candidate.competitiveSet?.setId)
        .filter((value): value is string => Boolean(value));

      const sourceResult = await this.source.fetch({
        format,
        requestedCapabilities: plan.requests,
        excludedSpecies,
        excludedSetIds,
        maximumRawCandidates: plan.maximumAdditionalRawCandidates,
      });

      rawCandidatesFetched += sourceResult.rawCount;

      const capabilityMatches = sourceResult.candidates.filter(candidate =>
        candidateMatchesPlan(candidate, plan, this.classifier),
      );

      if (capabilityMatches.length === 0) {
        if (sourceResult.sourceExhausted) {
          return {
            executed: true,
            passesExecuted: pass,
            rawCandidatesFetched,
            usableCandidatesAdded,
            accepted: [],
            stopReason: 'SOURCE_EXHAUSTED',
          };
        }

        continue;
      }

      const searchContext = createCandidateSearchContext(lead, format, strategy.id);

      const filtered = filterCandidatePool(capabilityMatches, searchContext);

      const usable = filtered.accepted.slice(0, plan.maximumAdditionalUsableCandidates);

      for (const candidate of usable) {
        const setId = candidate.competitiveSet?.setId ?? candidate.name;
        const key = `${candidate.name}:${setId}`;

        if (!accumulated.has(key)) {
          accumulated.set(key, candidate);
          usableCandidatesAdded += 1;
        }
      }

      if (usable.length === 0) {
        continue;
      }

      const recoveryCandidates = Array.from(accumulated.values());

      const input: LeadCompletionSearchInput = {
        lead,
        strategy,
        candidates: recoveryCandidates,
        maxCandidatesPerStage: Math.min(recoveryCandidates.length, 20),
        format,
      };

      const searchResult = executePrimaryStrategySearch({
        input,
        strategy,
        context,
        resolveCompetitiveTeam,
      });

      if (searchResult.accepted.length > 0) {
        return {
          executed: true,
          passesExecuted: pass,
          rawCandidatesFetched,
          usableCandidatesAdded,
          accepted: searchResult.accepted,
          searchResult,
          stopReason: 'RECOVERY_SUCCEEDED',
        };
      }
    }

    return {
      executed: true,
      passesExecuted: Math.min(plan.maximumPasses, 2),
      rawCandidatesFetched,
      usableCandidatesAdded,
      accepted: [],
      stopReason: 'QUALITY_GATES_NOT_SATISFIED',
    };
  }
}
