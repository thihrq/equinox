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

/**
 * Teto de times COMPLETOS rejeitados transportados como evidência por
 * estratégia. `AnytimeSearchCoordinator` já limita tentativas a 5 por
 * estratégia (`for (let attempt = 0; attempt < 5...)`), então este valor
 * raramente é atingido na prática — ele é uma salvaguarda de memória caso
 * essa premissa mude, não um limite calibrado por medição de carga.
 */
const MAX_REJECTION_EVIDENCE_PER_STRATEGY = 12;

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
      weaknessPenaltyWeight: flags.weaknessPenaltyWeight,
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

    // Transporta a decisão de times COMPLETOS rejeitados (088-G) — corrige o
    // incidente PRE-FINALIST-REJECTION-EVIDENCE-LOSS (088-F): antes, só
    // `acceptedTeams` alimentava `traces`, e qualquer rejeição, mesmo de um
    // time completo já avaliado por `evaluateFullTeamCached` dentro do
    // coordinator, era descartada aqui, nunca chegando ao agregador de
    // rejeições nem ao planner de recovery. `rejection.cachedEvaluation` é o
    // objeto que o coordinator já produziu — nenhuma decisão é recalculada.
    //
    // Amostragem, não descarte: o corpo do loop do coordinator já limita
    // tentativas a 5 por estratégia (AnytimeSearchCoordinator.ts), então o
    // teto abaixo raramente é atingido em produção — ele existe para não
    // deixar a lista crescer sem limite caso essa premissa mude, sem
    // silenciar a contagem real (`totalRejectedCompleteTeams` abaixo
    // preserva o total mesmo quando a amostra é truncada).
    const rejectionSample = searchResult.result.rejectedTeams.slice(0, MAX_REJECTION_EVIDENCE_PER_STRATEGY);

    for (const rejection of rejectionSample) {
      const resolvedTeam = resolveCompetitiveTeam([...rejection.candidate.members], input.format);

      const trace = createFinalistDecisionTrace(
        strategy.id,
        rejection.cachedEvaluation.key,
        rejection.cachedEvaluation.decision.gates as any,
      );

      const completion: LeadCompletionResult = {
        fullTeam: [...rejection.candidate.members],
        strategy,
        fullTeamScore: 0,
        strategyCoverage: {
          fulfilledRequired: [],
          fulfilledPreferred: [],
          fulfilledOptional: [],
          unresolved: [],
          coverageScore: 0,
        },
        unresolvedRequirements: [],
      };

      evaluated.push({
        completion,
        resolvedTeam,
        cachedEvaluation: rejection.cachedEvaluation,
      });
      traces.push(trace);
      // Nunca entra em `accepted` — por construção, todo item de
      // `rejectedTeams` já tem `decision.accepted === false`.
    }

    return {
      strategyId: strategy.id,
      completionsGenerated: searchResult.result.acceptedTeams.length + searchResult.result.rejectedTeams.length,
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
