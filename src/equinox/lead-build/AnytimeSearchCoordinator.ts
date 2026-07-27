import type { PokemonData } from '../core/AnalysisContext';
import { StrategyRoundRobinScheduler, StrategyScheduleItem, StrategyRoundResult } from './StrategyRoundRobinScheduler';
import { FirstCompleteTeamBuilder } from './FirstCompleteTeamBuilder';
import { ProgressiveCandidateSelectionPolicy } from './ProgressiveCandidateSelectionPolicy';
import type { AnytimeSearchResult, CompleteTeamCandidate } from './AnytimeSearchResult';

export interface AnytimeSearchCoordinatorInput {
  lead: readonly PokemonData[];
  strategies: readonly { id: string; profileId: string }[];
  candidates: readonly PokemonData[];
  startedAtMs: number;
  globalDeadlineMs: number;
  nowMs: () => number;
}

export class AnytimeSearchCoordinator {
  private readonly scheduler = new StrategyRoundRobinScheduler();
  private readonly teamBuilder = new FirstCompleteTeamBuilder();
  private readonly candidatePolicy = new ProgressiveCandidateSelectionPolicy();

  public async executeSearch(input: AnytimeSearchCoordinatorInput): Promise<{
    result: AnytimeSearchResult;
    roundResults: StrategyRoundResult[];
    allEligibleStrategiesReceivedFirstPass: boolean;
  }> {
    const { lead, strategies, candidates, startedAtMs, globalDeadlineMs, nowMs } = input;

    const initialBatch = this.candidatePolicy.selectDiverseBatch(candidates);
    const scheduleItems: StrategyScheduleItem[] = strategies.map(s => ({
      strategyId: s.id,
      eligible: true,
    }));

    const scheduled = this.scheduler.scheduleFirstPass(scheduleItems);
    const roundResults: StrategyRoundResult[] = [];
    const acceptedTeams: CompleteTeamCandidate[] = [];

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

      const team = this.teamBuilder.build({
        lead,
        candidates: initialBatch,
      });

      if (team) {
        if (!firstCompleteTeamBuiltAtMs) {
          firstCompleteTeamBuiltAtMs = nowMs();
        }
        acceptedTeams.push(team);
        roundResults.push({
          strategyId: item.strategyId,
          eligibility: 'ELIGIBLE',
          attempted: true,
          completeTeamBuilt: true,
          stopReason: 'COMPLETE_TEAM_BUILT',
          timeUsedMs: Math.max(1, nowMs() - currentNow),
        });
      } else {
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

    const allEligibleStrategiesReceivedFirstPass = roundResults.filter(r => r.attempted).length === scheduled.length;

    return {
      result: {
        acceptedTeams,
        rejectedTeams: [],
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
