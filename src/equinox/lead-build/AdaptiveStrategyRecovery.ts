import { PokemonData } from '../core/AnalysisContext';
import { systemMonotonicClock } from './MonotonicClock';
import { LeadCompletionSearchInput, LeadStrategyCandidate } from '../vgc/LeadBuildTypes';
import { filterCandidatePool } from './filterCandidatePool';
import { createCandidateSearchContext } from './CandidateSearchContext';
import { CandidateCapabilityClassifier, classifyCoverageBreadth } from './CandidateCapabilityClassifier';
import { LeadBuildRequestContext } from './LeadBuildRequestContext';
import { RecoveryCapabilityPlan } from './RecoveryCapabilityPlanner';
import { RecoveryCandidateSource } from './ProductionRecoveryCandidateSource';
import { CandidatePageCursor } from '../recommendation/ProgressiveCandidateFetcher';
import { executePrimaryStrategySearch, PrimaryStrategySearchResult } from './PrimaryStrategySearch';
import { RecoveryStrategyDiagnostic, RecoveryStrategyStopReason } from './RecoveryDiagnostics';

/**
 * Estado mutável de uma tentativa de recovery para UMA estratégia,
 * preservado entre chamadas sucessivas a `execute()`.
 *
 * Existe para permitir que o orquestrador dê passes de 1 em 1 a várias
 * estratégias intercaladamente (rodada justa + redistribuição), em vez de uma
 * única chamada esgotar sozinha o orçamento global de passes — o mecanismo
 * exato da starvation confirmada na investigação 087-D.
 */
export interface RecoverySessionState {
  accumulated: Map<string, PokemonData>;
  cursor: CandidatePageCursor | null;
  rawCandidatesFetched: number;
  usableCandidatesAdded: number;
  passesConsumed: number;
  candidatesExamined: number;
  candidatesMatched: number;
  builderAttemptCount: number;
  completeTeamsBuilt: number;
  acceptanceDecisionCount: number;
  acceptanceAcceptedCount: number;
  acceptanceRejectionReasons: string[];
  everExecuted: boolean;
  done: boolean;
  lastSearchResult?: PrimaryStrategySearchResult;
}

export function createRecoverySessionState(primaryCandidates: PokemonData[]): RecoverySessionState {
  const accumulated = new Map<string, PokemonData>();

  for (const candidate of primaryCandidates) {
    const setId = candidate.competitiveSet?.setId ?? candidate.name;
    accumulated.set(`${candidate.name}:${setId}`, candidate);
  }

  return {
    accumulated,
    cursor: null,
    rawCandidatesFetched: 0,
    usableCandidatesAdded: 0,
    passesConsumed: 0,
    candidatesExamined: 0,
    candidatesMatched: 0,
    builderAttemptCount: 0,
    completeTeamsBuilt: 0,
    acceptanceDecisionCount: 0,
    acceptanceAcceptedCount: 0,
    acceptanceRejectionReasons: [],
    everExecuted: false,
    done: false,
  };
}

export interface AdaptiveRecoveryResult {
  executed: boolean;
  passesExecuted: number;
  rawCandidatesFetched: number;
  usableCandidatesAdded: number;
  accepted: PrimaryStrategySearchResult['accepted'];
  searchResult?: PrimaryStrategySearchResult;
  stopReason: RecoveryStrategyStopReason;
  diagnostic: RecoveryStrategyDiagnostic;
  state: RecoverySessionState;
}

function candidateMatchesPlan(
  candidate: PokemonData,
  plan: RecoveryCapabilityPlan,
  classifier: CandidateCapabilityClassifier,
): boolean {
  const set = candidate.competitiveSet;
  const candidateTypes = (set?.types ?? candidate.types ?? []) as string[];

  const profile = classifier.classify({
    candidateId: set?.setId ?? `${candidate.name}:${candidate.item}`,
    species: candidate.name,
    canonicalSpecies: candidate.name,
    setId: set?.setId ?? set?.setSource ?? `${candidate.name}-recovery`,
    types: candidateTypes as never,
    item: set?.item ?? candidate.item,
    ability: set?.ability ?? candidate.ability,
    moves: set?.moves ?? candidate.moves,
  });

  const capabilities = [...profile.defensiveCapabilities, ...profile.strategicCapabilities];

  return plan.requests.some(request => {
    if ('kind' in request) {
      return classifyCoverageBreadth(
        candidateTypes,
        request.offensiveTypesPresent,
        request.minimumAdditionalTypes,
        request.minimumCoverageBreadth,
      ).matched;
    }

    return capabilities.some(capability => {
      if (capability.capability !== request.capability) {
        return false;
      }

      if (request.attackType && capability.attackType !== request.attackType) {
        return false;
      }

      return true;
    });
  });
}

function formatCapabilityRequest(request: RecoveryCapabilityPlan['requests'][number]): string {
  if ('kind' in request) {
    return 'COVERAGE_BREADTH';
  }
  return request.attackType ? `${request.capability}:${request.attackType}` : request.capability;
}

export class AdaptiveStrategyRecovery {
  private readonly classifier = new CandidateCapabilityClassifier();

  public constructor(private readonly source: RecoveryCandidateSource) {}

  /**
   * Executa até `maxPassesThisCall` passes de recovery para uma estratégia.
   *
   * Cada chamada é autocontida em termos de orçamento — debita
   * `context.recoveryBudget` diretamente, o mesmo objeto compartilhado entre
   * estratégias na mesma requisição — mas o progresso da varredura
   * (candidatos acumulados, cursor, contadores) é preservado via
   * `priorState`/`state`, para que chamadas sucessivas continuem de onde a
   * anterior parou em vez de recomeçar.
   *
   * Sem `maxPassesThisCall`/`priorState`, o comportamento é idêntico ao de
   * antes desta mudança: uma única chamada consome sozinha até
   * `plan.maximumPasses` (no máximo 2) passes do orçamento.
   */
  public async execute(params: {
    plan: RecoveryCapabilityPlan;
    strategy: LeadStrategyCandidate;
    lead: [PokemonData, PokemonData];
    primaryCandidates: PokemonData[];
    format: string;
    context: LeadBuildRequestContext;
    resolveCompetitiveTeam: (team: PokemonData[], format: string) => PokemonData[];
    maxPassesThisCall?: number;
    priorState?: RecoverySessionState;
  }): Promise<AdaptiveRecoveryResult> {
    const { plan, strategy, lead, primaryCandidates, format, context, resolveCompetitiveTeam } = params;

    const state = params.priorState ?? createRecoverySessionState(primaryCandidates);

    const capabilityRequests = plan.requests.map(formatCapabilityRequest);

    const buildDiagnostic = (
      stopReason: RecoveryStrategyStopReason,
    ): RecoveryStrategyDiagnostic => ({
      strategyId: strategy.id,
      planEligible: plan.eligible,
      capabilityRequestCount: plan.requests.length,
      capabilityRequests,
      ineligibilityReasons: [...plan.ineligibilityReasons],
      passesAvailableAtStart: context.recoveryBudget.passesRemaining + state.passesConsumed,
      passesConsumed: state.passesConsumed,
      candidatesExamined: state.candidatesExamined,
      candidatesMatched: state.candidatesMatched,
      builderAttemptCount: state.builderAttemptCount,
      completeTeamsBuilt: state.completeTeamsBuilt,
      acceptanceDecisionCount: state.acceptanceDecisionCount,
      acceptanceAcceptedCount: state.acceptanceAcceptedCount,
      acceptanceRejectionReasons: [...state.acceptanceRejectionReasons],
      recoveryExecuted: state.everExecuted,
      stopReason,
    });

    const stopHere = (
      stopReason: RecoveryStrategyStopReason,
      passesExecutedThisCall: number,
    ): AdaptiveRecoveryResult => ({
      executed: state.everExecuted,
      passesExecuted: passesExecutedThisCall,
      rawCandidatesFetched: state.rawCandidatesFetched,
      usableCandidatesAdded: state.usableCandidatesAdded,
      accepted: state.lastSearchResult?.accepted.length ? state.lastSearchResult.accepted : [],
      searchResult: state.lastSearchResult,
      stopReason,
      diagnostic: buildDiagnostic(stopReason),
      state,
    });

    // Plano incoerente ou fatalmente inelegível: nenhum candidato pode chegar
    // ao builder, então nenhum passe é gasto. Ver RecoveryCapabilityPlanner —
    // a invariante `eligible => requests.length > 0` garante que, quando
    // `eligible` é `true`, sempre há ao menos uma capability request real.
    if (!plan.eligible) {
      state.done = true;
      const reason: RecoveryStrategyStopReason = plan.ineligibilityReasons.includes(
        'NO_CAPABILITY_REQUESTS_DERIVED',
      )
        ? 'NO_CAPABILITY_REQUESTS_DERIVED'
        : 'PLAN_NOT_ELIGIBLE';
      return stopHere(reason, 0);
    }

    if (
      context.recoveryBudget.passesRemaining <= 0 ||
      context.recoveryBudget.rawCandidatesRemaining <= 0
    ) {
      state.done = true;
      return stopHere('PASS_BUDGET_EXHAUSTED', 0);
    }

    if (context.invocationCounters) {
      context.invocationCounters.incompleteRecoveryPlannerInvocationCount = 1;
      context.invocationCounters.anytimeRecoveryCoordinatorInvocationCount = 1;
    }

    // Teto por SESSÃO (não por chamada): sem isso, chamadas repetidas com
    // `maxPassesThisCall: 1` (o mecanismo da rodada justa) poderiam ultrapassar
    // `plan.maximumPasses` cumulativamente, já que cada chamada isolada não
    // sabe quantos passes as chamadas anteriores já gastaram.
    const passesAllowedRemainingInSession = Math.max(0, plan.maximumPasses - state.passesConsumed);

    if (passesAllowedRemainingInSession <= 0) {
      state.done = true;
      return stopHere('PASS_BUDGET_EXHAUSTED', 0);
    }

    const maxPassesAllowed = Math.min(
      params.maxPassesThisCall ?? passesAllowedRemainingInSession,
      passesAllowedRemainingInSession,
      context.recoveryBudget.passesRemaining,
      2,
    );

    let passesExecutedThisCall = 0;

    for (let i = 0; i < maxPassesAllowed; i += 1) {
      if (context.recoveryBudget.passesRemaining <= 0) {
        return stopHere('PASS_BUDGET_EXHAUSTED', passesExecutedThisCall);
      }

      context.recoveryBudget.passesRemaining -= 1;
      state.passesConsumed += 1;
      passesExecutedThisCall += 1;
      state.everExecuted = true;

      const remaining = context.phaseBudget
        ? Math.max(0, context.phaseBudget.requestDeadlineAtMs - systemMonotonicClock.now())
        : context.timeBudget.totalBudgetMs - (Date.now() - context.startedAtMs);

      if (remaining <= context.timeBudget.finalizationReserveMs) {
        state.done = true;
        return stopHere('DEADLINE_REACHED', passesExecutedThisCall);
      }

      const excludedSpecies = [
        ...new Set([
          ...lead.map(member => member.name),
          ...Array.from(state.accumulated.values()).map(candidate => candidate.name),
        ]),
      ];

      const excludedSetIds = Array.from(state.accumulated.values())
        .map(candidate => candidate.competitiveSet?.setId)
        .filter((value): value is string => Boolean(value));

      const rawLimit = Math.min(
        plan.maximumAdditionalRawCandidates,
        context.recoveryBudget.rawCandidatesRemaining,
      );

      const sourceResult = await this.source.fetch({
        format,
        requestedCapabilities: plan.requests,
        excludedSpecies,
        excludedSetIds,
        maximumRawCandidates: rawLimit,
        startCursor: state.cursor,
      });

      state.cursor = sourceResult.endCursor ?? state.cursor;

      state.rawCandidatesFetched += sourceResult.rawCount;
      state.candidatesExamined += sourceResult.rawCount;
      context.recoveryBudget.rawCandidatesRemaining = Math.max(
        0,
        context.recoveryBudget.rawCandidatesRemaining - sourceResult.rawCount,
      );

      const capabilityMatches = sourceResult.candidates.filter(candidate =>
        candidateMatchesPlan(candidate, plan, this.classifier),
      );

      state.candidatesMatched += capabilityMatches.length;

      if (capabilityMatches.length === 0) {
        if (sourceResult.sourceExhausted) {
          state.done = true;
          return stopHere('CANDIDATE_SOURCE_EXHAUSTED', passesExecutedThisCall);
        }

        continue;
      }

      const searchContext = createCandidateSearchContext(lead, format, strategy.id);
      const filtered = filterCandidatePool(capabilityMatches, searchContext);

      const usableLimit = Math.min(
        plan.maximumAdditionalUsableCandidates,
        context.recoveryBudget.usableCandidatesRemaining,
      );

      const usable = filtered.accepted.slice(0, usableLimit);

      for (const candidate of usable) {
        const setId = candidate.competitiveSet?.setId ?? candidate.name;
        const key = `${candidate.name}:${setId}`;

        if (!state.accumulated.has(key)) {
          state.accumulated.set(key, candidate);
          state.usableCandidatesAdded += 1;
          context.recoveryBudget.usableCandidatesRemaining = Math.max(
            0,
            context.recoveryBudget.usableCandidatesRemaining - 1,
          );
        }
      }

      if (usable.length === 0) {
        continue;
      }

      const recoveryCandidates = Array.from(state.accumulated.values());

      const input: LeadCompletionSearchInput = {
        lead,
        strategy,
        candidates: recoveryCandidates,
        maxCandidatesPerStage: Math.min(recoveryCandidates.length, 20),
        format,
      };

      const searchResult = await executePrimaryStrategySearch({
        input,
        strategy,
        context,
        resolveCompetitiveTeam,
      });

      state.lastSearchResult = searchResult;
      state.builderAttemptCount += searchResult.completionsGenerated;
      state.completeTeamsBuilt += searchResult.evaluated.length;
      state.acceptanceDecisionCount += searchResult.traces.length;
      state.acceptanceAcceptedCount += searchResult.accepted.length;
      for (const trace of searchResult.traces) {
        if (!trace.valid) {
          state.acceptanceRejectionReasons.push(trace.primaryReason);
        }
      }

      if (searchResult.accepted.length > 0) {
        state.done = true;
        return stopHere('TEAM_ACCEPTED', passesExecutedThisCall);
      }
    }

    // A cota de passes DESTA chamada terminou sem aceitar, esgotar a fonte ou
    // estourar o prazo. `state.done` continua `false` de propósito: o
    // orçamento GLOBAL pode ainda ter passes para outras estratégias
    // rodarem antes de uma segunda rodada devolver mais passes a esta.
    const reason: RecoveryStrategyStopReason =
      state.builderAttemptCount > 0
        ? 'ALL_TEAMS_REJECTED'
        : state.candidatesMatched > 0
          ? 'NO_COMPLETE_TEAM'
          : 'NO_CAPABILITY_MATCH';

    return stopHere(reason, passesExecutedThisCall);
  }
}
