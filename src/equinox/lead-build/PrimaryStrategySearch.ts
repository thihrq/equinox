import { PokemonData } from '../core/AnalysisContext';
import { LeadCompletionResult, LeadCompletionSearchInput, LeadStrategyCandidate } from '../vgc/LeadBuildTypes';
import { searchLeadCompletions } from '../vgc/LeadCompletionSearch';
import { createFinalistDecisionTrace } from './FinalistDecisionTrace';
import { CachedTeamEvaluation, evaluateFullTeamCached } from './LeadBuildCachedEvaluator';
import { LeadBuildRequestContext } from './LeadBuildRequestContext';

export interface EvaluatedCompletion {
  completion: LeadCompletionResult;
  resolvedTeam: PokemonData[];
  cachedEvaluation: CachedTeamEvaluation;
}

export interface PrimaryStrategySearchResult {
  strategyId: string;
  completionsGenerated: number;
  evaluated: EvaluatedCompletion[];
  accepted: EvaluatedCompletion[];
  traces: ReturnType<typeof createFinalistDecisionTrace>[];
}

export function executePrimaryStrategySearch(params: {
  input: LeadCompletionSearchInput;
  strategy: LeadStrategyCandidate;
  context: LeadBuildRequestContext;
  resolveCompetitiveTeam: (team: PokemonData[], format: string) => PokemonData[];
}): PrimaryStrategySearchResult {
  const { input, strategy, context, resolveCompetitiveTeam } = params;

  const completions = searchLeadCompletions(input);

  const evaluated: EvaluatedCompletion[] = [];
  const accepted: EvaluatedCompletion[] = [];
  const traces: ReturnType<typeof createFinalistDecisionTrace>[] = [];

  for (const completion of completions) {
    const resolvedTeam = resolveCompetitiveTeam(completion.fullTeam, input.format);

    const lookup = evaluateFullTeamCached({
      team: resolvedTeam,
      strategy,
      format: input.format,
      cache: context.evaluationCache,
    });

    const cachedEvaluation = lookup.value;
    const trace = createFinalistDecisionTrace(
      strategy.id,
      cachedEvaluation.key,
      cachedEvaluation.decision.gates as any,
    );

    const entry: EvaluatedCompletion = {
      completion,
      resolvedTeam,
      cachedEvaluation,
    };

    evaluated.push(entry);
    traces.push(trace);

    if (cachedEvaluation.decision.accepted) {
      accepted.push(entry);
    }
  }

  accepted.sort((a, b) => b.completion.fullTeamScore - a.completion.fullTeamScore);

  return {
    strategyId: strategy.id,
    completionsGenerated: completions.length,
    evaluated,
    accepted,
    traces,
  };
}
