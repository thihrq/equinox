import { PokemonData } from '../core/AnalysisContext';
import { LeadCompletionResult, LeadCompletionSearchInput, LeadStrategyCandidate } from '../vgc/LeadBuildTypes';
import { searchLeadCompletions } from '../vgc/LeadCompletionSearch';
import { createFinalistDecisionTrace } from './FinalistDecisionTrace';
import { CachedTeamEvaluation, evaluateFullTeamCached } from './LeadBuildCachedEvaluator';
import { LeadBuildRequestContext } from './LeadBuildRequestContext';
import { PrimarySearchGuard } from './PrimarySearchGuard';
import { resolvePrimaryFinalistPolicy } from './PrimaryFinalistPolicy';

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

  if (context.phaseBudget && !context.phaseBudget.canContinuePrimary()) {
    return {
      strategyId: strategy.id,
      completionsGenerated: 0,
      evaluated: [],
      accepted: [],
      traces: [],
    };
  }

  const policy = resolvePrimaryFinalistPolicy(context.runtimeProfile);
  const guard = context.phaseBudget ? new PrimarySearchGuard(context.phaseBudget, policy.maximumFinalistsPerStrategy) : undefined;

  const completions = searchLeadCompletions(input, guard);

  const evaluated: EvaluatedCompletion[] = [];
  const accepted: EvaluatedCompletion[] = [];
  const traces: ReturnType<typeof createFinalistDecisionTrace>[] = [];

  const maxToEvaluate = Math.min(
    completions.length,
    policy.maximumFinalistsPerStrategy,
    context.primaryFinalistBudgetRemaining ?? policy.maximumFinalistsPerRequest,
  );

  for (let i = 0; i < maxToEvaluate; i += 1) {
    if (context.phaseBudget && !context.phaseBudget.canContinuePrimary()) {
      context.phaseBudget.setStopReason('PRIMARY_TIME_BUDGET_REACHED');
      break;
    }

    const completion = completions[i];
    const resolvedTeam = resolveCompetitiveTeam(completion.fullTeam, input.format);

    const lookup = evaluateFullTeamCached({
      team: resolvedTeam,
      strategy,
      format: input.format,
      cache: context.evaluationCache,
    });

    if (context.primaryFinalistBudgetRemaining !== undefined) {
      context.primaryFinalistBudgetRemaining = Math.max(0, context.primaryFinalistBudgetRemaining - 1);
    }

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
      break; // Exit early once accepted strategy is found
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
