import { PokemonData } from '../core/AnalysisContext';
import { validateCompetitiveTeam, TeamLegalityResult } from '../competitive/CompetitiveTeamLegalityValidator';
import { evaluateFullTeam } from '../vgc/FullTeamEvaluator';
import { FullTeamEvaluation, LeadStrategyCandidate } from '../vgc/LeadBuildTypes';
import { createCanonicalTeamEvaluationKey, CanonicalPokemonBuildIdentity } from './CanonicalTeamEvaluationKey';
import { RequestScopedEvaluationCache } from './RequestScopedEvaluationCache';
import { decideFullTeamAcceptance, FullTeamAcceptanceDecision } from './FullTeamAcceptanceDecision';

export interface CachedTeamEvaluation {
  readonly key: string;
  readonly team: readonly PokemonData[];
  readonly legality: TeamLegalityResult;
  readonly evaluation: FullTeamEvaluation;
  readonly decision: FullTeamAcceptanceDecision;
}

export interface CachedEvaluationLookup {
  readonly value: CachedTeamEvaluation;
  readonly cacheStatus: 'HIT' | 'MISS';
}

function toCanonicalBuild(member: PokemonData): CanonicalPokemonBuildIdentity {
  const set = member.competitiveSet;

  return {
    canonicalSpecies: member.name.replace(/-Mega-[XY]$/i, '').replace(/-Mega$/i, ''),
    form: member.name,
    setId: set?.setId ?? set?.setSource ?? `${member.name}:${set?.item ?? member.item ?? 'none'}`,
    item: set?.item ?? member.item,
    ability: set?.ability ?? member.ability,
    nature: set?.nature ?? member.nature,
    evs: set?.evs as any,
    ivs: set?.ivs as any,
    moves: set?.moves ?? member.moves ?? [],
  };
}

export function evaluateFullTeamCached(params: {
  team: PokemonData[];
  strategy: LeadStrategyCandidate;
  format: string;
  cache: RequestScopedEvaluationCache<CachedTeamEvaluation>;
}): CachedEvaluationLookup {
  const { team, strategy, format, cache } = params;

  const key = createCanonicalTeamEvaluationKey(
    {
      format,
      strategyId: strategy.id,
      strategyProfileId: strategy.resolvedProfile?.profileId ?? strategy.id,
      weather: strategy.resolvedProfile?.weather,
      speedMode: strategy.resolvedProfile?.speedMode,
      evaluatorVersion: 'v1.1.4',
      qualityGateVersion: 'v1.1.2',
    },
    team.map(toCanonicalBuild),
  );

  const cached = cache.get(key);
  if (cached) {
    return {
      value: cached,
      cacheStatus: 'HIT',
    };
  }

  const legality = validateCompetitiveTeam(team, format);
  const evaluation = evaluateFullTeam(team, strategy, format);
  const decision = decideFullTeamAcceptance({ legality, evaluation });

  const value: CachedTeamEvaluation = {
    key,
    team,
    legality,
    evaluation,
    decision,
  };

  cache.set(key, value);
  return {
    value,
    cacheStatus: 'MISS',
  };
}
