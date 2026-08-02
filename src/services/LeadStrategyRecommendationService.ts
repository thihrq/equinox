// src/services/LeadStrategyRecommendationService.ts
// Orquestrador do pipeline Build-Around-Lead para Champions Doubles

import { PokemonService } from './PokemonService';
import { Pokemon } from '../models/Pokemon';
import { PokemonSet } from '../models/PokemonSet';
import { generateBasicKit, getMegaBaseName, getMegaStone, getSpeciesClauseKey, getPokemonTypes } from '../equinox/utils/PokemonUtils';
import { CompetitiveKitGenerator } from '../equinox/utils/CompetitiveKitGenerator';
import { PokemonData } from '../equinox/core/AnalysisContext';
import { CandidateSelector } from '../equinox/recommendation/CandidateSelector';
import { ProgressiveCandidateFetcher, PrimaryCandidateFetcher } from '../equinox/recommendation/ProgressiveCandidateFetcher';
import { CandidateScoreEngine, type TeamIdentity, type CandidateScoreResult } from '../equinox/recommendation/CandidateScoreEngine';
import { DiversityCandidateSelector } from '../equinox/recommendation/DiversityCandidateSelector';
import { FormatSolverRegistry } from '../equinox/format-solvers/FormatSolverRegistry';
import { resolveFormatPlan } from '../equinox/format-solvers/FormatPlanResolver';
import { FormatPerformanceProfileRegistry } from '../equinox/performance/FormatPerformanceProfile';
import { FormatLegalityRules } from '../equinox/recommendation/FormatLegalityRules';
import { evaluateSetCoherence } from '../equinox/lead-build/SetCoherenceEvaluator';
import { appConfig } from '../config/env';

import type {
  SuggestFromLeadRequest,
  LeadSuggestionResult,
  LeadStrategyResult,
  LeadCapabilityProfile,
  LeadStrategyCandidate,
  LeadCompletionResult,
  LeadCompletionSearchInput,
} from '../equinox/vgc/LeadBuildTypes';

import { analyzeLeadCapabilities } from '../equinox/vgc/LeadCapabilityAnalyzer';
import { generateLeadStrategies } from '../equinox/vgc/LeadStrategyGenerator';
import { searchLeadCompletions } from '../equinox/vgc/LeadCompletionSearch';
import { evaluateFullTeam } from '../equinox/vgc/FullTeamEvaluator';
import { evaluateLeadLockedQuartets } from '../equinox/vgc/LeadLockedQuartetEvaluator';
import { generateLeadPlaybook } from '../equinox/vgc/LeadPlaybookGenerator';
import { TeamSuggestionInputError } from './TeamService';
import { validateCompetitiveTeam } from '../equinox/competitive/CompetitiveTeamLegalityValidator';
import { CompetitivePokemonSet, withCompetitiveSet } from '../equinox/competitive/CompetitivePokemonSet';
import { calculateTeamDataCoverage } from '../equinox/competitive/TeamDataCoverage';
import { compareLegacyAndV2Sets } from '../equinox/competitive/CompetitiveSetShadowComparator';
import pilotCompetitiveSets from '../equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json';
import { enforceUniqueVgcHeldItems, isMegaOption } from '../equinox/utils/VgcSetOptimizer';
import { CompetitiveSetValidationInput } from '../equinox/data-validation/CompetitiveValidationTypes';
import { randomUUID } from 'crypto';
import { createLeadBuildRequestContext, LeadBuildRequestContext } from '../equinox/lead-build/LeadBuildRequestContext';
import { executePrimaryStrategySearch } from '../equinox/lead-build/PrimaryStrategySearch';
import { aggregateFinalistRejections } from '../equinox/lead-build/FinalistRejectionAggregator';
import { deriveRecoveryCapabilityPlan, RecoveryCapabilityPlan } from '../equinox/lead-build/RecoveryCapabilityPlanner';
import { AdaptiveStrategyRecovery, AdaptiveRecoveryResult, RecoverySessionState } from '../equinox/lead-build/AdaptiveStrategyRecovery';
import { ProductionRecoveryCandidateSource } from '../equinox/lead-build/ProductionRecoveryCandidateSource';
import { projectPublicFailClosedMetadata } from '../equinox/lead-build/PublicFailClosedDiagnostic';
import { RENDER_FREE_PHASE_BUDGET_CONFIG } from '../equinox/lead-build/LeadBuildPhaseBudget';
import { systemMonotonicClock } from '../equinox/lead-build/MonotonicClock';
import { buildAggregateRecoveryDiagnostic, RecoveryStrategyDiagnostic } from '../equinox/lead-build/RecoveryDiagnostics';

/**
 * Estado de UMA estratégia atravessando a rodada justa de recovery
 * (`runFairRecoveryRounds`). `state`/`result` começam indefinidos e são
 * preenchidos incrementalmente, uma chamada de `AdaptiveStrategyRecovery.execute()`
 * por rodada.
 */
interface RecoveryTask {
  strategy: LeadStrategyCandidate;
  lead: [PokemonData, PokemonData];
  primaryCandidates: PokemonData[];
  format: string;
  plan: RecoveryCapabilityPlan;
  state: RecoverySessionState | undefined;
  result: AdaptiveRecoveryResult;
}


// ─── Service ──────────────────────────────────────────────────────────────────

export class LeadStrategyRecommendationService {
  private readonly formatSolverRegistry = new FormatSolverRegistry();
  private readonly formatLegalityRules = new FormatLegalityRules();
  private readonly adaptiveRecovery = new AdaptiveStrategyRecovery(
    new ProductionRecoveryCandidateSource(),
  );
  // Wiring de produção por padrão. Testes de integração (088-B) substituem
  // esta instância por uma fonte determinística via
  // `(service as any).primaryCandidateFetcher = ...`, o mesmo padrão já usado
  // para `adaptiveRecovery` acima — nenhum condicional de ambiente na lógica
  // de domínio, nenhuma ativação de mock por variável global.
  private readonly primaryCandidateFetcher: PrimaryCandidateFetcher = new ProgressiveCandidateFetcher();


  public async execute(input: SuggestFromLeadRequest): Promise<any> {
    console.time('LeadBuildTotal');
    const { lead, format, allowLegendaries, teamIdentity } = input;
    const requestId = crypto.randomUUID();
    const requestContext = createLeadBuildRequestContext(requestId, format, 'production');

    // 1. Resolver formato
    const formatSolver = this.formatSolverRegistry.getSolver(format);
    if (formatSolver.mode !== 'champions_doubles') {
      throw new TeamSuggestionInputError(
        'FORMAT_RULE_INCOMPATIBLE',
        'O modo Build-Around-Lead está disponível apenas para Champions Doubles.',
        { format },
      );
    }

    console.log(`[LeadBuild] Iniciando pipeline para ${lead[0].name} + ${lead[1].name} | format=${format}`);

    // 2. Hidratar Pokémon da lead
    console.time('LeadHydrate');
    const hydratedLead = await this.hydrateLeadPokemon(lead, format, formatSolver);
    console.timeEnd('LeadHydrate');

    // 3. Verificar legalidade da lead
    for (const pokemon of hydratedLead) {
      if (!this.formatLegalityRules.isEligible({ pokemon, format })) {
        throw new TeamSuggestionInputError(
          'FORMAT_RULE_INCOMPATIBLE',
          `${pokemon.name} não é compatível com as regras de ${format}.`,
          { pokemonNames: [pokemon.name], format },
        );
      }
    }

    // 4. Analisar capacidades da lead
    console.time('LeadAnalysis');
    const leadProfile = analyzeLeadCapabilities(hydratedLead[0], hydratedLead[1], format);
    console.timeEnd('LeadAnalysis');

    console.log(`[LeadBuild] Perfil: weather=${leadProfile.weather.map(w => w.family).join(',')} speedControl=${leadProfile.speedControl.map(s => s.type).join(',')}`);

    // 5. Gerar estratégias
    console.time('StrategyGeneration');
    const strategies = generateLeadStrategies(hydratedLead as [PokemonData, PokemonData], leadProfile, format);
    console.timeEnd('StrategyGeneration');

    console.log(`[LeadBuild] Estratégias geradas: ${strategies.length} → ${strategies.map(s => s.id).join(', ')}`);

    if (strategies.length === 0) {
      console.timeEnd('LeadBuildTotal');
      return {
        lead: [hydratedLead[0].name, hydratedLead[1].name],
        leadProfile,
        strategies: [],
        bestOverallTeam: hydratedLead,
        warnings: ['Nenhuma estratégia viável identificada para esta lead.'],
      };
    }

    // 6. Buscar candidatos (reutiliza infraestrutura existente)
    console.time('CandidateFetch');
    const candidates = await this.fetchAndScoreCandidates(
      hydratedLead,
      format,
      allowLegendaries,
      teamIdentity as TeamIdentity,
      formatSolver,
      requestContext,
    );
    console.timeEnd('CandidateFetch');

    console.log(`[LeadBuild] Candidatos disponíveis: ${candidates.length}`);

    if (candidates.length < 4) {
      console.timeEnd('LeadBuildTotal');
      return {
        lead: [hydratedLead[0].name, hydratedLead[1].name],
        leadProfile,
        strategies: [],
        bestOverallTeam: hydratedLead,
        warnings: ['Candidatos insuficientes para completar o time (mínimo 4 necessários).'],
        runtimeDiagnostics: {
          requestId: requestContext.requestId,
          invocationCounters: requestContext.invocationCounters,
          metrics: requestContext.metrics,
        },
      };
    }

    // 7. Para cada estratégia, completar time, avaliar e gerar playbook
    console.time('StrategyPipeline');
    requestContext.metrics.primaryCandidateFetchCount = 1;
    requestContext.metrics.primaryCandidatePoolSize = candidates.length;

    const strategyResults: LeadStrategyResult[] = [];
    const rejectedResults: any[] = [];
    const recoveryDiagnosticsByStrategy: RecoveryStrategyDiagnostic[] = [];

    const primaryStartedAt = Date.now();

    // Fase 1: busca primária para TODAS as estratégias antes de qualquer
    // recovery. Isolar isso é o que torna a fase 2 (recovery) capaz de
    // distribuir o orçamento de passes de forma justa entre estratégias, em
    // vez de a primeira estratégia processada esgotar sozinha o orçamento
    // global antes das demais serem sequer avaliadas — a starvation
    // confirmada na investigação 087-D.
    const primaryOutcomes: Array<{
      strategy: LeadStrategyCandidate;
      primary: Awaited<ReturnType<typeof executePrimaryStrategySearch>>;
    }> = [];

    for (const strategy of strategies.slice(0, 5)) { // Máximo de 5 estratégias
      try {
        const primary = await this.runPrimarySearchOnly(
          strategy,
          hydratedLead as [PokemonData, PokemonData],
          candidates,
          format,
          requestContext,
        );
        primaryOutcomes.push({ strategy, primary });
      } catch (error) {
        console.warn(`[LeadBuild] Falha na busca primária da estratégia ${strategy.id}:`, error);
      }
    }

    // Fase 2: recovery justo, só para quem a fase 1 não resolveu.
    const recoveryTasks = this.buildRecoveryTasks(
      primaryOutcomes,
      hydratedLead as [PokemonData, PokemonData],
      candidates,
      format,
      requestContext,
    );

    await this.runFairRecoveryRounds(recoveryTasks, format, requestContext);

    for (const task of recoveryTasks) {
      recoveryDiagnosticsByStrategy.push(task.result.diagnostic);
    }

    // Fase 3: finalizar cada estratégia com o que a fase 1 ou 2 produziu.
    for (const { strategy, primary } of primaryOutcomes) {
      try {
        const task = recoveryTasks.find(t => t.strategy.id === strategy.id);
        const outcome = this.finalizeStrategyOutcome(
          strategy,
          hydratedLead as [PokemonData, PokemonData],
          format,
          primary,
          task?.result,
        );

        if (outcome.status === 'ACCEPTED') {
          strategyResults.push(outcome.result);
        } else {
          rejectedResults.push(outcome);
        }
      } catch (error) {
        console.warn(`[LeadBuild] Falha ao finalizar estratégia ${strategy.id}:`, error);
      }
    }

    if (requestContext.invocationCounters.anytimeCoordinatorInvocationCount > 0) {
      requestContext.invocationCounters.anytimeCoordinatorInvocationCount = 1;
    }
    console.timeEnd('StrategyPipeline');

    const recoveryDiagnostics = buildAggregateRecoveryDiagnostic(recoveryDiagnosticsByStrategy);

    requestContext.metrics.totalDurationMs = Date.now() - requestContext.startedAtMs;
    requestContext.metrics.cacheMetrics = requestContext.evaluationCache.getMetrics();

    strategyResults.sort((a, b) => b.teamEvaluation.overallScore - a.teamEvaluation.overallScore);

    const bestOverallTeam = strategyResults[0]?.completions[0]?.fullTeam ?? hydratedLead;
    const dataCoverage = calculateTeamDataCoverage(bestOverallTeam);
    const warnings = strategyResults.length > 0
      ? strategyResults.flatMap(result => [
          ...result.teamEvaluation.warnings,
          ...(result.dataCoverage?.notes ?? []),
          ...result.quartets.flatMap(quartet => [
            ...quartet.assessment.warnings.map(issue => issue.message),
            ...quartet.assessment.matchupRisks.map(issue => issue.message),
          ]),
        ])
      : ['Nenhuma das estratégias candidatas produziu um time completo que passasse nos critérios de qualidade (score geral, cobertura de roles e balanço ofensivo mínimos).'];

    const response: LeadSuggestionResult = {
      lead: [hydratedLead[0].name, hydratedLead[1].name],
      leadProfile,
      strategies: strategyResults,
      bestOverallTeam,
      dataCoverage,
      warnings: [...new Set(warnings)].slice(0, 12),
    };

    if (strategyResults.length === 0 && rejectedResults.length > 0) {
      const primaryDiagnostic = rejectedResults[0].diagnostic;
      (response as any).noStrategy = primaryDiagnostic;
    }

    // Só para compatibilidade retroativa de campos legados (stopReason de UMA
    // estratégia). A fonte de verdade é `recoveryDiagnostics`, calculada
    // acima a partir de TODAS as estratégias que precisaram de recovery — o
    // agregado anterior refletia só a última estratégia processada, o que
    // escondeu, na investigação 087-D, que a primeira estratégia já havia
    // executado e consumido o orçamento inteiro.
    const lastOutcome = rejectedResults[rejectedResults.length - 1];
    const recoveryOutcome = lastOutcome?.recovery;

    (response as any).generatedStrategies = strategies;
    (response as any).metrics = {
      strategyCount: strategies.length,
      profileResolutionCount: strategies.length,
      knownProfileFallbackCount: strategies.filter(s => s.resolvedProfile?.fallbackUsed && s.resolvedProfile?.reason !== 'UNKNOWN_STRATEGY_PROFILE_FALLBACK').length,
      unknownProfileFallbackCount: strategies.filter(s => s.resolvedProfile?.fallbackUsed && s.resolvedProfile?.reason === 'UNKNOWN_STRATEGY_PROFILE_FALLBACK').length,
    };

    (response as any).runtimeDiagnostics = {
      requestId: requestContext.requestId,
      totalDurationMs: requestContext.metrics.totalDurationMs,
      primarySearchMs: requestContext.metrics.primarySearchMs,
      recoverySearchMs: requestContext.metrics.recoverySearchMs,
      totalBudgetMs: requestContext.phaseBudget.config.totalBudgetMs,
      primaryBudgetMs: requestContext.phaseBudget.config.primarySearchMaximumMs,
      recoveryReserveMs: requestContext.phaseBudget.config.recoveryReserveMs,
      primaryCandidateFetchCount: requestContext.metrics.primaryCandidateFetchCount,
      primaryCandidatePoolSize: requestContext.metrics.primaryCandidatePoolSize,
      primaryCandidatePoolReused: true,
      phaseBudgetInstanceCount: requestContext.metrics.phaseBudgetInstanceCount,
      allEligibleStrategiesReceivedFirstPass: requestContext.invocationCounters.anytimeCoordinatorInvocationCount > 0,
      invocationCounters: requestContext.invocationCounters,
      primarySearchInterrupted: requestContext.phaseBudget.getStopReason() === 'PRIMARY_TIME_BUDGET_REACHED',
      primarySearchStopReason: requestContext.phaseBudget.getStopReason() ?? (strategyResults.length > 0 ? 'ACCEPTED' : 'EXHAUSTED'),
      recoveryEligible: recoveryDiagnostics.recoveryEligibleAny || strategyResults.length === 0,
      // `recoveryExecutedAny`/`recoveryExecutedCount`: derivados de TODAS as
      // estratégias, nunca sobrescritos pela última processada.
      recoveryExecuted: recoveryDiagnostics.recoveryExecutedAny,
      recoveryStopReason: recoveryOutcome?.stopReason,
      recoveryTimeAvailableAtStartMs: requestContext.phaseBudget.recoveryTimeAvailableMs(),
      recoverySkippedReason: recoveryOutcome?.executed === false ? (recoveryOutcome?.stopReason ?? 'DEADLINE_REACHED') : undefined,
      recoveryDiagnostics,
      cache: requestContext.metrics.cacheMetrics,
      parityValid: requestContext.parityResult?.valid ?? true,
    };

    console.log(
      `[LeadBuildRuntime] ` +
        `requestId=${requestContext.requestId} ` +
        `totalMs=${requestContext.metrics.totalDurationMs} ` +
        `primaryMs=${requestContext.metrics.primarySearchMs} ` +
        `recoveryMs=${requestContext.metrics.recoverySearchMs} ` +
        `cacheHits=${requestContext.metrics.cacheMetrics.hits} ` +
        `cacheMisses=${requestContext.metrics.cacheMetrics.misses} ` +
        `duplicateEvaluationsAvoided=${requestContext.metrics.cacheMetrics.duplicateEvaluationsAvoided}`,
    );

    console.log(`[LeadBuild] Resultados: ${response.strategies.length} estratégias nativas processadas com sucesso`);
    console.timeEnd('LeadBuildTotal');

    return response;
  }

  // ─── Pipeline de Processamento por Estratégia ──────────────────────────────

  private async runPrimarySearchOnly(
    strategy: LeadStrategyCandidate,
    lead: [PokemonData, PokemonData],
    candidates: PokemonData[],
    format: string,
    requestContext: LeadBuildRequestContext,
  ) {
    const completionInput: LeadCompletionSearchInput = {
      lead,
      strategy,
      candidates,
      maxCandidatesPerStage: 40,
      format,
    };

    const primaryStartedAt = Date.now();

    const primary = await executePrimaryStrategySearch({
      input: completionInput,
      strategy,
      context: requestContext,
      resolveCompetitiveTeam: this.resolveCompetitiveTeam.bind(this),
    });

    requestContext.metrics.primarySearchMs += Date.now() - primaryStartedAt;

    return primary;
  }

  /**
   * Deriva um plano de recovery para cada estratégia cuja busca primária não
   * aceitou nenhum time, preservando a ordem original das estratégias — essa
   * ordem é a ordem de prioridade usada pela rodada justa em
   * `runFairRecoveryRounds`.
   */
  private buildRecoveryTasks(
    primaryOutcomes: Array<{
      strategy: LeadStrategyCandidate;
      primary: Awaited<ReturnType<typeof executePrimaryStrategySearch>>;
    }>,
    lead: [PokemonData, PokemonData],
    candidates: PokemonData[],
    format: string,
    requestContext: LeadBuildRequestContext,
  ): RecoveryTask[] {
    const tasks: RecoveryTask[] = [];

    for (const { strategy, primary } of primaryOutcomes) {
      if (primary.accepted.length > 0) continue;

      const rejectionAggregate = aggregateFinalistRejections(strategy.id, primary.traces);
      const plan = deriveRecoveryCapabilityPlan(rejectionAggregate, {
        parityValid: requestContext.parityResult?.valid ?? true,
        hasIllegalLead: false,
        hasInvalidFormat: false,
      });

      tasks.push({ strategy, lead, primaryCandidates: candidates, format, plan, state: undefined, result: undefined as any });
    }

    return tasks;
  }

  /**
   * Rodada 1: até 1 passe para cada estratégia elegível, na ordem de
   * prioridade. Rodada 2+: redistribui o orçamento restante, 1 passe por vez,
   * só para quem ainda não terminou (aceitou, esgotou a fonte, bateu o
   * prazo ou já consumiu o teto de passes do próprio plano).
   *
   * Sem isso, a primeira estratégia elegível processada por
   * `AdaptiveStrategyRecovery.execute()` consumia sozinha o orçamento inteiro
   * antes de as demais serem sequer tentadas — a starvation confirmada na
   * investigação 087-D.
   */
  private async runFairRecoveryRounds(
    tasks: RecoveryTask[],
    format: string,
    requestContext: LeadBuildRequestContext,
  ): Promise<void> {
    if (tasks.length === 0) return;

    const recoveryStartedAt = Date.now();
    const resolveCompetitiveTeam = this.resolveCompetitiveTeam.bind(this);

    const isTaskDone = (task: RecoveryTask): boolean =>
      task.state !== undefined && task.state.done;

    let round = 0;
    // Teto de segurança: nenhuma estratégia pode consumir mais que
    // `plan.maximumPasses` passes (hoje 2), então nenhum cenário legítimo
    // precisa de mais rodadas que isso.
    const maxRounds = Math.max(...tasks.map(t => t.plan.maximumPasses), 1);

    while (round < maxRounds) {
      round += 1;
      let madeProgressThisRound = false;

      for (const task of tasks) {
        if (isTaskDone(task)) continue;
        if (requestContext.recoveryBudget.passesRemaining <= 0) break;

        const result = await this.adaptiveRecovery.execute({
          plan: task.plan,
          strategy: task.strategy,
          lead: task.lead,
          primaryCandidates: task.primaryCandidates,
          format,
          context: requestContext,
          resolveCompetitiveTeam,
          maxPassesThisCall: 1,
          priorState: task.state,
        });

        task.result = result;
        task.state = result.state;

        if (result.passesExecuted > 0) {
          madeProgressThisRound = true;
        }
      }

      if (!madeProgressThisRound) break;
      if (requestContext.recoveryBudget.passesRemaining <= 0) break;
    }

    // Estratégias que nunca chegaram a rodar (plano inelegível, ou orçamento
    // já esgotado antes de sua vez) precisam de um resultado terminal para
    // que o diagnóstico agregado as contabilize corretamente.
    for (const task of tasks) {
      if (!task.result) {
        task.result = await this.adaptiveRecovery.execute({
          plan: task.plan,
          strategy: task.strategy,
          lead: task.lead,
          primaryCandidates: task.primaryCandidates,
          format,
          context: requestContext,
          resolveCompetitiveTeam,
          maxPassesThisCall: 1,
          priorState: task.state,
        });
        task.state = task.result.state;
      }
    }

    requestContext.metrics.recoverySearchMs += Date.now() - recoveryStartedAt;
  }

  private finalizeStrategyOutcome(
    strategy: LeadStrategyCandidate,
    lead: [PokemonData, PokemonData],
    format: string,
    primary: Awaited<ReturnType<typeof executePrimaryStrategySearch>>,
    recoveryResult: AdaptiveRecoveryResult | undefined,
  ):
    | { status: 'ACCEPTED'; result: LeadStrategyResult; recovery?: any }
    | { status: 'REJECTED'; strategyId: string; traces: any[]; diagnostic: any; recovery?: any } {
    const accepted = primary.accepted.length > 0 ? primary.accepted : (recoveryResult?.accepted ?? []);

    if (accepted.length === 0) {
      const aggregate = aggregateFinalistRejections(strategy.id, [
        ...primary.traces,
        ...(recoveryResult?.searchResult?.traces ?? []),
      ]);

      // Diagnóstico temporário: identificar o(s) reasonCode(s) interno(s)
      // reais por trás do fallback público genérico QUALITY_GATES_NOT_SATISFIED.
      // Remover após identificar a causa real em produção.
      for (const r of aggregate.failuresByReason) {
        console.log(
          '[DEBUG_QUALITY_GATE] strategyId=' + strategy.id +
          ' reasonCode=' + r.reasonCode +
          ' gate=' + r.gate +
          ' count=' + r.count +
          ' metadata=' + JSON.stringify(r.metadata),
        );
      }

      const publicDiagnostic = projectPublicFailClosedMetadata(
        aggregate.failuresByReason,
        recoveryResult?.executed ?? false,
        recoveryResult?.stopReason !== 'TEAM_ACCEPTED',
        recoveryResult?.stopReason === 'CANDIDATE_SOURCE_EXHAUSTED',
      );

      return {
        status: 'REJECTED',
        strategyId: strategy.id,
        traces: [...primary.traces, ...(recoveryResult?.searchResult?.traces ?? [])],
        diagnostic: publicDiagnostic,
        recovery: recoveryResult,
      };
    }

    const best = accepted[0];
    const teamEvaluation = best.cachedEvaluation.evaluation;
    const dataCoverage = calculateTeamDataCoverage(best.resolvedTeam);

    const quartets = evaluateLeadLockedQuartets({
      fullTeam: best.resolvedTeam,
      lead,
      strategy,
      format,
    });

    const playbooks = quartets
      .filter(q => q.contractValid)
      .slice(0, 6)
      .map(quartet => generateLeadPlaybook({
        quartet,
        strategy,
        fullTeam: best.resolvedTeam,
        format,
      }));

    return {
      status: 'ACCEPTED',
      result: {
        strategy,
        completions: accepted.slice(0, 3).map(entry => ({
          ...entry.completion,
          fullTeam: entry.resolvedTeam,
          dataCoverage: calculateTeamDataCoverage(entry.resolvedTeam),
        })),
        quartets,
        playbooks,
        teamEvaluation,
        dataCoverage,
        recoveryState: recoveryResult,
      } as LeadStrategyResult,
      recovery: recoveryResult,
    };
  }

  private resolveCompetitiveTeam(team: PokemonData[], format: string): PokemonData[] {
    const generatedSets = team.map(member => withCompetitiveSet(member, format, member.competitiveSet?.setSource ?? 'generated'));
    const shadowSets = this.applyV2ShadowSetSelection(generatedSets, format);
    return enforceUniqueVgcHeldItems(shadowSets, format)
      .map(member => {
        if (!member.competitiveSet) return withCompetitiveSet(member, format, 'generated');
        if (member.item !== member.competitiveSet.item) {
          return {
            ...member,
            competitiveSet: {
              ...member.competitiveSet,
              item: member.item ?? member.competitiveSet.item,
            },
          };
        }
        return member;
      });
  }

  private applyV2ShadowSetSelection(team: PokemonData[], format: string): PokemonData[] {
    if (!appConfig.useCompetitiveSetsV2 || format !== 'champions_reg_m_b_doubles') {
      return team;
    }

    return team.map(member => {
      const requiredRole = inferRequiredRole(member);
      const v2Set = findPilotSetForPokemon(member, requiredRole);
      if (!v2Set) return member;

      const comparison = compareLegacyAndV2Sets({
        legacySets: member.competitiveSet ? [competitiveSetToValidationInput(member, format)] : [],
        v2Sets: [v2Set],
      })[0];

      console.log(
        `[SET SELECTION SHADOW] pokemon=${member.name} requiredRole=${requiredRole} legacySet=${member.competitiveSet?.setId ?? member.competitiveSet?.setSource ?? 'none'} v2Set=${v2Set.setId} preferred=${comparison.preferred} writes=0 reasons=${comparison.reasons.join(' | ')}`,
      );

      if (comparison.preferred !== 'v2') return member;

      const competitiveSet = pilotSetToCompetitivePokemonSet(member, v2Set);
      return {
        ...member,
        ability: competitiveSet.ability,
        item: competitiveSet.item,
        nature: competitiveSet.nature,
        moves: competitiveSet.moves,
        role: competitiveSet.role ?? member.role,
        competitiveSet,
      };
    });
  }

  private calculateFinalCompletionScore(
    searchScore: number,
    evaluation: ReturnType<typeof evaluateFullTeam>,
    legal: boolean,
  ): number {
    if (!legal) return 0;
    return Math.round(
      evaluation.overallScore * 0.35 +
      evaluation.roleCoverageScore * 0.25 +
      100 * 0.15 +
      evaluation.offensiveBalanceScore * 0.15 +
      evaluation.matchupFlexibilityScore * 0.10 +
      Math.min(5, searchScore / 100),
    );
  }

  // ─── Hidratação da Lead ────────────────────────────────────────────────────

  private async hydrateLeadPokemon(
    leadInputs: SuggestFromLeadRequest['lead'],
    format: string,
    formatSolver: ReturnType<FormatSolverRegistry['getSolver']>,
  ): Promise<PokemonData[]> {
    const result: PokemonData[] = [];

    for (const input of leadInputs) {
      const pokemon = await PokemonService.getPokemonByName(input.name, format);
      if (!pokemon) {
        throw new TeamSuggestionInputError(
          'POKEMON_NOT_FOUND',
          `Pokémon não encontrado: ${input.name}.`,
          { pokemonNames: [input.name] },
        );
      }

      const baseName = getMegaBaseName(pokemon.name);
      let set = await PokemonSet.findOne({ pokemonName: pokemon.name, formatId: format }).lean();
      if (!set && baseName !== pokemon.name) {
        set = await PokemonSet.findOne({ pokemonName: baseName, formatId: format }).lean();
      }
      if (!set) {
        set = await PokemonSet.findOne({ pokemonName: pokemon.name }).lean();
      }
      if (!set && baseName !== pokemon.name) {
        set = await PokemonSet.findOne({ pokemonName: baseName }).lean();
      }

      const defaultKit = set || !formatSolver.usesDoublesMechanicContracts
        ? null
        : CompetitiveKitGenerator.generate(pokemon, format);
      const basicKit = generateBasicKit(pokemon, format);
      const megaStone = getMegaStone(pokemon.name);

      const resolved = formatSolver.normalizePokemonSet({
        pokemon: {
          ...pokemon,
          ability: input.ability || pokemon.ability || set?.ability || defaultKit?.ability,
          item: megaStone || input.item || pokemon.item || set?.item || defaultKit?.item,
          moves: (input.moves && input.moves.length > 0)
            ? input.moves
            : (pokemon.moves && pokemon.moves.length > 0 ? pokemon.moves : (set?.moves || defaultKit?.moves)),
          nature: input.nature || pokemon.nature || set?.nature || basicKit.nature,
          role: pokemon.role || set?.role || basicKit.role,
        },
        format,
        savedSet: set,
        defaultKit,
        basicKit,
        preferCurated: true,
      });

      result.push(resolved);
    }

    return formatSolver.normalizeFinalTeam(result, format);
  }

  // ─── Busca e Score de Candidatos ───────────────────────────────────────────

  // Achado real 2026-07-18: o beam search de LeadCompletionSearch.ts monta
  // o time em 4 estágios (2->3->4->5->6), e no estágio final (adicionar o
  // 6º membro) 76% de todas as tentativas eram rejeitadas só por "mais de
  // uma opção Mega no time" (rejectedMega=1000 de 1320), zerando o beam
  // inteiro pra leads sem sinal de clima forte o bastante pra dominar o
  // ranking (ex.: Incineroar+Amoonguss). Causa: candidatos Mega tendem a
  // pontuar mais alto (stats maiores), então o pool diversificado ficava
  // com muitas opções de Mega de espécies diferentes -- como só 1 Mega é
  // permitido por time, assim que uma branch do beam trava seu Mega, a
  // maior parte do pool vira inútil pra ela, e no estágio final quase não
  // sobra candidato não-Mega pras poucas vagas restantes de cada branch.
  // Reserva aqui um piso de 70% de candidatos não-Mega no pool final,
  // resgatando do pool mais amplo (scoredCandidates, pré-diversidade) e
  // trocando pelos Mega de menor score -- mantém boas opções de Mega
  // disponíveis (as de maior score sobrevivem) sem deixar o pool inteiro
  // refém de uma única vaga por time.
  private reserveNonMegaCandidates(
    diversifiedResults: CandidateScoreResult[],
    scoredCandidates: CandidateScoreResult[],
  ): CandidateScoreResult[] {
    const pool = [...diversifiedResults];
    const nonMegaFloor = Math.ceil(pool.length * 0.7);
    let nonMegaCount = pool.filter(result => !isMegaOption(result.pokemon)).length;
    if (nonMegaCount >= nonMegaFloor) return pool;

    const inPool = new Set(pool.map(result => result.pokemon));
    const rescueCandidates = scoredCandidates
      .filter(result => !inPool.has(result.pokemon) && !isMegaOption(result.pokemon))
      .sort((a, b) => b.score - a.score);

    for (const rescue of rescueCandidates) {
      if (nonMegaCount >= nonMegaFloor) break;

      let evictIndex = -1;
      let evictScore = Infinity;
      for (let i = 0; i < pool.length; i++) {
        if (isMegaOption(pool[i].pokemon) && pool[i].score < evictScore) {
          evictScore = pool[i].score;
          evictIndex = i;
        }
      }

      if (evictIndex === -1) break;

      pool.splice(evictIndex, 1, rescue);
      nonMegaCount++;
    }

    return pool.sort((a, b) => b.score - a.score);
  }

  private async fetchAndScoreCandidates(
    baseTeam: PokemonData[],
    format: string,
    allowLegendaries: boolean,
    teamIdentity: TeamIdentity,
    formatSolver: ReturnType<FormatSolverRegistry['getSolver']>,
    requestContext?: LeadBuildRequestContext,
  ): Promise<PokemonData[]> {
    const currentMembers = baseTeam.map(p => p.name);
    const fetcher = this.primaryCandidateFetcher;
    // Prazo da FASE de candidate fetch, não o da busca primária.
    // `recoveryMustStartByMs` é o limite do primary; usá-lo aqui deixaria o
    // fetch consumir todo o orçamento da busca combinatória.
    // O fallback usa o mesmo relógio monotônico do fetcher — `Date.now()`
    // pertence a outra base temporal e a comparação seria sem sentido.
    const candidateFetchDeadlineAtMs = requestContext?.phaseBudget?.candidateFetchDeadlineAtMs
      ?? (systemMonotonicClock.now() + RENDER_FREE_PHASE_BUDGET_CONFIG.candidateFetchMaximumMs);

    const progressiveResult = await fetcher.fetchProgressiveCandidates({
      leadNames: currentMembers,
      baseTeam,
      format,
      allowLegendaries,
      targetUsableCount: 24,
      rawPageSize: 30,
      maxDocumentsExamined: 300,
      candidateFetchDeadlineAtMs,
      requestContext,
    });

    const validCandidates = progressiveResult.usableCandidates;

    const scoredCandidates = new CandidateScoreEngine().scoreCandidates({
      baseTeam,
      candidates: validCandidates,
      format,
      teamIdentity,
      formatSolver,
    });

    const diversifiedResults = new DiversityCandidateSelector().select(
      scoredCandidates,
      formatSolver.getDiversityOptions(),
      formatSolver.getMandatoryMechanicCoverage(baseTeam, format),
    );

    const rebalancedResults = this.reserveNonMegaCandidates(diversifiedResults, scoredCandidates);
    const diversifiedCandidates = rebalancedResults.map(r => r.pokemon);
    const lockedFormatPlan = resolveFormatPlan(baseTeam, format, formatSolver.mode);

    // Hidratar candidatos com sets competitivos
    const candidateNames = diversifiedCandidates.map(c => c.name);
    const candidateSetNames = [...new Set([
      ...candidateNames,
      ...candidateNames.map(name => getMegaBaseName(name)),
    ])];
    const candidateSets = await PokemonSet.find({
      pokemonName: { $in: candidateSetNames },
    }).lean();

    const finalCandidates: PokemonData[] = [];
    for (const candidate of diversifiedCandidates) {
      const baseCandidateName = getMegaBaseName(candidate.name);
      let sets = candidateSets.filter(s => s.pokemonName === candidate.name && s.formatId === format);
      if (sets.length === 0 && baseCandidateName !== candidate.name) {
        sets = candidateSets.filter(s => s.pokemonName === baseCandidateName && s.formatId === format);
      }
      if (sets.length === 0) {
        sets = candidateSets.filter(s => s.pokemonName === candidate.name);
      }
      if (sets.length === 0 && baseCandidateName !== candidate.name) {
        sets = candidateSets.filter(s => s.pokemonName === baseCandidateName);
      }

      const megaStone = getMegaStone(candidate.name);
      if (sets.length > 0) {
        const bestSet = sets[0];

        // Validar coerência interna do set ARMAZENADO antes de aceitá-lo no
        // pool primário. `evaluateSetCoherence` precisa dos EVs/IVs reais do
        // set (ex.: Nature que reduz o stat usado pelo movimento principal)
        // — `normalizePokemonSet`, chamado logo abaixo, não propaga
        // `evs`/`ivs` para o `PokemonData` resultante (eles só são atribuídos
        // depois, na etapa de composição do time), então a checagem precisa
        // ocorrer aqui, sobre `bestSet`, e não sobre o candidato já
        // normalizado. Achado real de produção: lead Charizard-Mega-Y +
        // Whimsicott, set armazenado de Sandslash-Alola com Nature Adamant
        // (-SpA) + 124 EVs em SpA + Blizzard (movimento especial) — um
        // candidato assim pontua bem o suficiente para ser escolhido em
        // praticamente toda tentativa do builder, reprovando o time inteiro
        // em SetCoherence de forma sistemática e impossível de contornar via
        // recovery.
        if (!evaluateSetCoherence(bestSet).valid) {
          continue;
        }

        finalCandidates.push(formatSolver.normalizePokemonSet({
          pokemon: {
            ...candidate,
            ability: bestSet.ability,
            item: megaStone ?? bestSet.item,
            moves: bestSet.moves,
            nature: bestSet.nature,
            role: bestSet.role,
          },
          format,
          savedSet: bestSet,
          preferCurated: true,
          formatPlan: lockedFormatPlan,
        }));
      } else {
        const defaultKit = formatSolver.usesDoublesMechanicContracts
          ? CompetitiveKitGenerator.generate(candidate, format)
          : null;
        const basicKit = generateBasicKit(candidate, format);
        finalCandidates.push(formatSolver.normalizePokemonSet({
          pokemon: {
            ...candidate,
            ability: defaultKit?.ability,
            item: megaStone ?? defaultKit?.item,
            moves: defaultKit?.moves,
            nature: basicKit.nature,
            role: basicKit.role,
          },
          format,
          defaultKit,
          basicKit,
          preferCurated: true,
          formatPlan: lockedFormatPlan,
        }));
      }
    }

    // Deduplicar por Species Clause
    const selected = new Map<string, PokemonData>();
    for (const candidate of finalCandidates) {
      const key = getSpeciesClauseKey(candidate.name);
      if (!selected.has(key)) {
        selected.set(key, candidate);
      }
    }
    return [...selected.values()];
  }
}

type PilotCompetitiveSet = CompetitiveSetValidationInput & {
  setId: string;
  pokemonName: string;
  item: string;
  ability: string;
  nature: string;
  evs: Required<NonNullable<CompetitiveSetValidationInput['evs']>>;
  ivs: Required<NonNullable<CompetitiveSetValidationInput['ivs']>>;
  moves: [string, string, string, string] | string[];
};

const PILOT_SETS = (pilotCompetitiveSets as { sets: PilotCompetitiveSet[] }).sets;

function normalizeId(value?: string): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function inferRequiredRole(member: PokemonData): string {
  const role = String(member.role ?? member.competitiveSet?.role ?? '').toLowerCase();
  if (role.includes('trick room')) return 'trick-room-setter';
  if (role.includes('redirection')) return 'redirection-support';
  if (role.includes('fake out')) return 'fake-out-control';
  if (role.includes('body press') || role.includes('physical wall')) return 'physical-wall';
  if (role.includes('special wall')) return 'special-wall';
  if (role.includes('special')) return 'slow-special-breaker';
  if (role.includes('slow') || role.includes('physical')) return 'slow-physical-breaker';
  return member.competitiveSet?.role ?? 'bulky-pivot';
}

function findPilotSetForPokemon(member: PokemonData, requiredRole: string): PilotCompetitiveSet | undefined {
  const memberId = normalizeId(member.name);
  const baseId = normalizeId(getMegaBaseName(member.name));
  const speciesMatches = PILOT_SETS.filter(set => {
    const setName = normalizeId(set.pokemonName);
    const setForm = normalizeId(set.formId);
    const setPokemon = normalizeId(set.pokemonId);
    return setName === memberId || setForm === memberId || setPokemon === memberId || setPokemon === baseId;
  });

  return speciesMatches.find(set => set.primaryRole === requiredRole || set.secondaryRoles?.includes(requiredRole)) ??
    speciesMatches[0];
}

function pilotSetToCompetitivePokemonSet(member: PokemonData, set: PilotCompetitiveSet): CompetitivePokemonSet {
  const source = set.status === 'verified' || set.status === 'active'
    ? 'v2-verified'
    : set.status === 'reviewed'
      ? 'v2-reviewed'
      : 'v2-draft';
  return {
    name: set.pokemonName,
    types: member.types ?? [],
    item: set.item,
    ability: set.ability,
    nature: set.nature,
    evs: {
      hp: Number(set.evs.hp ?? 0),
      atk: Number(set.evs.atk ?? 0),
      def: Number(set.evs.def ?? 0),
      spa: Number(set.evs.spa ?? 0),
      spd: Number(set.evs.spd ?? 0),
      spe: Number(set.evs.spe ?? 0),
    },
    ivs: {
      hp: Number(set.ivs.hp ?? 31),
      atk: Number(set.ivs.atk ?? 31),
      def: Number(set.ivs.def ?? 31),
      spa: Number(set.ivs.spa ?? 31),
      spd: Number(set.ivs.spd ?? 31),
      spe: Number(set.ivs.spe ?? 31),
    },
    moves: set.moves.slice(0, 4) as [string, string, string, string],
    role: set.primaryRole,
    level: 50,
    setId: set.setId,
    confidence: set.confidence,
    status: set.status,
    sourceType: set.sourceType,
    setSource: source,
    validation: { legal: set.legal !== false, errors: [], warnings: [] },
  };
}

function competitiveSetToValidationInput(member: PokemonData, format: string): CompetitiveSetValidationInput {
  const set = member.competitiveSet;
  return {
    pokemonName: member.name,
    formatId: format,
    regulationId: format,
    battleStyle: 'doubles',
    setId: set?.setId,
    setName: set?.role ?? set?.setSource ?? 'legacy',
    item: set?.item,
    ability: set?.ability,
    nature: set?.nature,
    evs: set?.evs,
    ivs: set?.ivs,
    moves: set?.moves,
    primaryRole: set?.role,
    sourceType: set?.setSource,
    confidence: set?.confidence,
    legal: set?.validation.legal,
    status: set?.status === 'draft' || set?.status === 'active' || set?.status === 'quarantined' || set?.status === 'deprecated'
      ? set.status
      : undefined,
    coherenceScore: set?.setSource === 'generated' ? 45 : 60,
  };
}
