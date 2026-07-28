import { PokemonData } from '../core/AnalysisContext';
import { LeadCompletionResult, LeadCompletionSearchInput, LeadStrategyCandidate } from '../vgc/LeadBuildTypes';
import { searchLeadCompletions } from '../vgc/LeadCompletionSearch';
import { createFinalistDecisionTrace } from './FinalistDecisionTrace';
import { CachedTeamEvaluation, evaluateFullTeamCached } from './LeadBuildCachedEvaluator';
import { LeadBuildRequestContext } from './LeadBuildRequestContext';
import { PrimarySearchGuard } from './PrimarySearchGuard';
import { resolvePrimaryFinalistPolicy } from './PrimaryFinalistPolicy';
import { AnytimeSearchCoordinator } from './AnytimeSearchCoordinator';
import { getLeadBuildRuntimeFlags } from './LeadBuildRuntimeFlags';
import { systemMonotonicClock } from './MonotonicClock';

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

const anytimeCoordinator = new AnytimeSearchCoordinator();

export async function executePrimaryStrategySearch(params: {
  input: LeadCompletionSearchInput;
  strategy: LeadStrategyCandidate;
  context: LeadBuildRequestContext;
  resolveCompetitiveTeam: (team: PokemonData[], format: string) => PokemonData[];
}): Promise<PrimaryStrategySearchResult> {
  const { input, strategy, context, resolveCompetitiveTeam } = params;
  const flags = getLeadBuildRuntimeFlags();

  if (context.phaseBudget && !context.phaseBudget.canContinuePrimary()) {
    return {
      strategyId: strategy.id,
      completionsGenerated: 0,
      evaluated: [],
      accepted: [],
      traces: [],
    };
  }

  if (flags.anytimeCompositionSearchEnabled) {
    const searchResult = await anytimeCoordinator.executeSearch({
      lead: input.lead,
      strategies: [strategy],
      candidates: input.candidates,
      format: input.format,
      requestContext: context,
      resolveCompetitiveTeam,
      startedAtMs: context.startedAtMs,
      globalDeadlineMs: context.phaseBudget ? context.phaseBudget.recoveryMustStartByMs : Date.now() + 6000,
      nowMs: () => systemMonotonicClock.now(),
    });

    const evaluated: EvaluatedCompletion[] = [];
    const accepted: EvaluatedCompletion[] = [];
    const traces: ReturnType<typeof createFinalistDecisionTrace>[] = [];

    for (const cand of searchResult.result.acceptedTeams) {
      const resolvedTeam = resolveCompetitiveTeam([...cand.members], input.format);
      const evalResult = evaluateFullTeamCached({
        team: resolvedTeam,
        strategy,
        format: input.format,
        cache: context.evaluationCache,
      });

      const trace = createFinalistDecisionTrace(
        strategy.id,
        evalResult.value.key,
        evalResult.value.decision.gates as any,
      );

      const completion: LeadCompletionResult = {
        fullTeam: [...cand.members],
        strategy,
        fullTeamScore: (evalResult.value.decision as any).overallScore ?? 80,
        strategyCoverage: {
          fulfilledRequired: [],
          fulfilledPreferred: [],
          fulfilledOptional: [],
          unresolved: [],
          coverageScore: 100,
        },
        unresolvedRequirements: [],
      };

      const entry: EvaluatedCompletion = {
        completion,
        resolvedTeam,
        cachedEvaluation: evalResult.value,
      };

      evaluated.push(entry);
      traces.push(trace);
      if (evalResult.value.decision.accepted) {
        accepted.push(entry);
      }
    }

    return {
      strategyId: strategy.id,
      completionsGenerated: searchResult.result.acceptedTeams.length,
      evaluated,
      accepted,
      traces,
    };
  }

  if (!flags.legacySearchFallbackEnabled) {
    throw new Error('NO_PRIMARY_SEARCH_PIPELINE_ENABLED');
  }

  // Pipeline legado fallback
  const policy = resolvePrimaryFinalistPolicy(context.runtimeProfile);
  const guard = context.phaseBudget ? new PrimarySearchGuard(context.phaseBudget, policy.maximumFinalistsPerStrategy) : undefined;
  if (guard) {
    (guard as any).requestContext = context;
  }

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
      break;
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
