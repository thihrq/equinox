import type { PokemonData } from '../core/AnalysisContext';
import { StrategyRoundRobinScheduler, StrategyScheduleItem, StrategyRoundResult } from './StrategyRoundRobinScheduler';
import { FirstCompleteTeamBuilder } from './FirstCompleteTeamBuilder';
import { ProgressiveCandidateSelectionPolicy } from './ProgressiveCandidateSelectionPolicy';
import { ArchetypeCompositionRegistry } from './ArchetypeCompositionRegistry';
import { CandidateCapabilityIndex } from './CandidateCapabilityIndex';
import { evaluateFullTeamCached } from './LeadBuildCachedEvaluator';
import type { AnytimeSearchResult, CompleteTeamCandidate } from './AnytimeSearchResult';
import type { LeadBuildRequestContext } from './LeadBuildRequestContext';
import type { LeadStrategyCandidate } from '../vgc/LeadBuildTypes';

export interface AnytimeSearchCoordinatorInput {
  lead: readonly PokemonData[];
  strategies: readonly LeadStrategyCandidate[];
  candidates: readonly PokemonData[];
  format: string;
  requestContext: LeadBuildRequestContext;
  resolveCompetitiveTeam?: (team: PokemonData[], format: string) => PokemonData[];
  startedAtMs: number;
  globalDeadlineMs: number;
  nowMs: () => number;
}

export class AnytimeSearchCoordinator {
  private readonly scheduler = new StrategyRoundRobinScheduler();
  private readonly teamBuilder = new FirstCompleteTeamBuilder();
  private readonly candidatePolicy = new ProgressiveCandidateSelectionPolicy();
  private readonly registry = new ArchetypeCompositionRegistry();

  public async executeSearch(input: AnytimeSearchCoordinatorInput): Promise<{
    result: AnytimeSearchResult;
    roundResults: StrategyRoundResult[];
    allEligibleStrategiesReceivedFirstPass: boolean;
  }> {
    const { lead, strategies, candidates, format, requestContext, resolveCompetitiveTeam, globalDeadlineMs, nowMs } = input;

    if (requestContext?.invocationCounters) {
      requestContext.invocationCounters.anytimeCoordinatorInvocationCount += 1;
    }

    if (requestContext?.invocationCounters) {
      requestContext.invocationCounters.capabilityIndexBuildCount += 1;
    }
    const capabilityIndex = new CandidateCapabilityIndex(candidates);
    const initialBatch = this.candidatePolicy.selectDiverseBatch(candidates);

    const scheduleItems: StrategyScheduleItem[] = strategies.map(s => ({
      strategyId: s.id,
      eligible: true,
    }));

    if (requestContext?.invocationCounters) {
      requestContext.invocationCounters.roundRobinSchedulerInvocationCount += 1;
    }
    const scheduled = this.scheduler.scheduleFirstPass(scheduleItems);
    const roundResults: StrategyRoundResult[] = [];
    const acceptedTeams: CompleteTeamCandidate[] = [];
    const rejectedTeams: CompleteTeamCandidate[] = [];

    let firstCompleteTeamBuiltAtMs: number | undefined;

    for (const item of scheduled) {
      const currentNow = nowMs();
      if (currentNow >= globalDeadlineMs) {
        roundResults.push({
          strategyId: item.strategyId,
          eligibility: 'ELIGIBLE',
          attempted: false,
          completeTeamBuilt: false,
          stopReason: 'INTERRUPTED_BY_DEADLINE',
          timeUsedMs: 0,
        });
        continue;
      }

      const strategyObj = strategies.find(s => s.id === item.strategyId) ?? { id: item.strategyId, profileId: 'balanced' } as any;
      if (requestContext?.invocationCounters) {
        requestContext.invocationCounters.compositionPlannerInvocationCount += 1;
      }
      const archDef = this.registry.getArchetype(strategyObj.profileId ?? strategyObj.id) ?? this.registry.getArchetype('defensive_core');
      const compositionPlan = archDef?.plan;

      let strategyAccepted = false;
      const excludedCandidates = new Set<string>();

      for (let attempt = 0; attempt < 5; attempt += 1) {
        if (nowMs() >= globalDeadlineMs || strategyAccepted) break;

        const availableForAttempt = initialBatch.filter(c => !excludedCandidates.has(c.name));

        const candidateStruct = this.teamBuilder.build({
          lead,
          strategy: strategyObj,
          compositionPlan,
          candidateCapabilityIndex: capabilityIndex,
          candidates: availableForAttempt,
          requestContext,
        });

        if (!candidateStruct) break;

        if (!firstCompleteTeamBuiltAtMs) {
          firstCompleteTeamBuiltAtMs = nowMs();
        }

        if (requestContext?.invocationCounters) {
          requestContext.invocationCounters.fullTeamAcceptanceDecisionInvocationCount += 1;
        }

        let resolvedMembers = resolveCompetitiveTeam
          ? resolveCompetitiveTeam([...candidateStruct.members], format)
          : [...candidateStruct.members];

        // Garantir preservacao de tipos nos resolvedMembers a partir do candidateStruct original
        resolvedMembers = resolvedMembers.map((rm, idx) => {
          const orig = candidateStruct.members[idx];
          return {
            ...rm,
            types: rm.types ?? orig?.types ?? orig?.variants?.[0]?.types ?? ['normal'],
          };
        });

        const evalResult = evaluateFullTeamCached({
          team: resolvedMembers,
          strategy: strategyObj,
          format,
          cache: requestContext.evaluationCache,
        });

        if (evalResult.value.decision.accepted) {
          const acceptedCand: CompleteTeamCandidate = {
            ...candidateStruct,
            members: resolvedMembers,
          };
          acceptedTeams.push(acceptedCand);
          strategyAccepted = true;
          roundResults.push({
            strategyId: item.strategyId,
            eligibility: 'ELIGIBLE',
            attempted: true,
            completeTeamBuilt: true,
            stopReason: 'COMPLETE_TEAM_BUILT',
            timeUsedMs: Math.max(1, nowMs() - currentNow),
          });
          break;
        } else {
          rejectedTeams.push(candidateStruct);
          const lastAdded = candidateStruct.members[candidateStruct.members.length - 1];
          if (lastAdded) excludedCandidates.add(lastAdded.name);
        }
      }

      if (!strategyAccepted && rejectedTeams.length > 0) {
        roundResults.push({
          strategyId: item.strategyId,
          eligibility: 'ELIGIBLE',
          attempted: true,
          completeTeamBuilt: true,
          stopReason: 'TIME_SLICE_EXHAUSTED',
          timeUsedMs: Math.max(1, nowMs() - currentNow),
        });
      } else if (!strategyAccepted) {
        roundResults.push({
          strategyId: item.strategyId,
          eligibility: 'ELIGIBLE',
          attempted: true,
          completeTeamBuilt: false,
          stopReason: 'NO_CAPABLE_CANDIDATES',
          timeUsedMs: Math.max(1, nowMs() - currentNow),
        });
      }
    }

    const eligibleRounds = roundResults.filter(r => r.eligibility === 'ELIGIBLE');
    const allEligibleStrategiesReceivedFirstPass = eligibleRounds.length > 0 && eligibleRounds.every(r => r.attempted);

    return {
      result: {
        acceptedTeams,
        rejectedTeams,
        partialStates: [],
        stopReason: acceptedTeams.length > 0 ? 'ACCEPTED' : 'NO_COMPLETE_TEAM',
        strategiesAttemptedCount: roundResults.filter(r => r.attempted).length,
        firstCompleteTeamBuiltAtMs,
      },
      roundResults,
      allEligibleStrategiesReceivedFirstPass,
    };
  }
}
