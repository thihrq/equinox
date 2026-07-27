export type StrategyRoundEligibility = 'ELIGIBLE' | 'NOT_ELIGIBLE';

export type StrategyRoundStopReason =
  | 'COMPLETE_TEAM_BUILT'
  | 'TIME_SLICE_EXHAUSTED'
  | 'NO_CAPABLE_CANDIDATES'
  | 'INTERRUPTED_BY_DEADLINE';

export interface StrategyRoundResult {
  strategyId: string;
  eligibility: StrategyRoundEligibility;
  attempted: boolean;
  completeTeamBuilt: boolean;
  stopReason: StrategyRoundStopReason;
  timeUsedMs: number;
}

export interface StrategyScheduleItem {
  strategyId: string;
  eligible: boolean;
}

export class StrategyRoundRobinScheduler {
  private readonly maxFirstPassSliceMs: number;

  constructor(maxFirstPassSliceMs: number = 800) {
    this.maxFirstPassSliceMs = maxFirstPassSliceMs;
  }

  public scheduleFirstPass(strategies: readonly StrategyScheduleItem[]): StrategyScheduleItem[] {
    return strategies.filter(s => s.eligible);
  }

  public calculateTimeSlice(startedAtMs: number, globalDeadlineMs: number, nowMs: number): number {
    const remainingGlobalMs = Math.max(0, globalDeadlineMs - nowMs);
    return Math.min(this.maxFirstPassSliceMs, remainingGlobalMs);
  }
}
