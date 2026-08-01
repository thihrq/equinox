import { MonotonicClock, systemMonotonicClock } from './MonotonicClock';

export type LeadBuildPhase =
  | 'HYDRATION'
  | 'CANDIDATE_FETCH'
  | 'PRIMARY_SEARCH'
  | 'RECOVERY'
  | 'FINALIZATION'
  | 'COMPLETED';

export type LeadBuildPhaseStopReason =
  | 'ACCEPTED'
  | 'SOURCE_EXHAUSTED'
  | 'PRIMARY_TIME_BUDGET_REACHED'
  | 'PRIMARY_FINALIST_BUDGET_REACHED'
  | 'CANDIDATE_FETCH_TIME_BUDGET_REACHED'
  | 'UPSTREAM_PHASE_EXHAUSTED_PRIMARY_BUDGET'
  | 'RECOVERY_NOT_ELIGIBLE'
  | 'RECOVERY_TIME_BUDGET_REACHED'
  | 'RECOVERY_SOURCE_EXHAUSTED'
  | 'RECOVERY_SUCCEEDED'
  | 'FINALIZATION_RESERVE_REACHED';

export interface LeadBuildPhaseBudgetConfig {
  readonly totalBudgetMs: number;
  readonly candidateFetchMaximumMs: number;
  readonly primarySearchMaximumMs: number;
  readonly recoveryReserveMs: number;
  readonly finalizationReserveMs: number;
}

export const RENDER_FREE_PHASE_BUDGET_CONFIG: LeadBuildPhaseBudgetConfig = {
  totalBudgetMs: 10_000,
  candidateFetchMaximumMs: 3_500,
  primarySearchMaximumMs: 6_000,
  recoveryReserveMs: 3_000,
  finalizationReserveMs: 500,
};

export class LeadBuildPhaseBudget {
  private currentPhase: LeadBuildPhase = 'HYDRATION';
  private stopReason?: LeadBuildPhaseStopReason;

  public readonly requestDeadlineAtMs: number;
  public readonly recoveryMustStartByMs: number;
  public readonly finalizationMustStartByMs: number;

  /**
   * Prazo próprio da fase de Candidate Fetch, no mesmo relógio monotônico das
   * demais fases.
   *
   * Existe para que o fetch não possa consumir a reserva da busca primária:
   * passar `recoveryMustStartByMs` direto ao fetcher resolveria o starvation de
   * candidatos recriando o problema de orçamento. A invariante que este campo
   * garante é
   *
   *   candidateFetchDeadlineAtMs < recoveryMustStartByMs < finalizationMustStartByMs < requestDeadlineAtMs
   *
   * e é a mesma condição que `canContinueCandidateFetch()` já aplicava.
   */
  public readonly candidateFetchDeadlineAtMs: number;

  public constructor(
    private readonly startedAtMs: number,
    public readonly config: LeadBuildPhaseBudgetConfig = RENDER_FREE_PHASE_BUDGET_CONFIG,
    private readonly clock: MonotonicClock = systemMonotonicClock,
  ) {
    this.requestDeadlineAtMs = startedAtMs + config.totalBudgetMs;
    this.recoveryMustStartByMs = this.requestDeadlineAtMs - config.recoveryReserveMs - config.finalizationReserveMs;
    this.finalizationMustStartByMs = this.requestDeadlineAtMs - config.finalizationReserveMs;
    this.candidateFetchDeadlineAtMs = Math.min(
      startedAtMs + config.candidateFetchMaximumMs,
      this.recoveryMustStartByMs,
    );
  }

  public elapsedMs(now = this.clock.now()): number {
    return Math.max(0, now - this.startedAtMs);
  }

  public remainingMs(now = this.clock.now()): number {
    return Math.max(0, this.requestDeadlineAtMs - now);
  }

  public getPhase(): LeadBuildPhase {
    return this.currentPhase;
  }

  public setPhase(phase: LeadBuildPhase): void {
    this.currentPhase = phase;
  }

  public getStopReason(): LeadBuildPhaseStopReason | undefined {
    return this.stopReason;
  }

  public setStopReason(reason: LeadBuildPhaseStopReason): void {
    this.stopReason = reason;
  }

  public canContinueCandidateFetch(now = this.clock.now()): boolean {
    return now < (this.startedAtMs + this.config.candidateFetchMaximumMs) && now < this.recoveryMustStartByMs;
  }

  public canContinuePrimary(now = this.clock.now()): boolean {
    const primaryStartLimit = this.startedAtMs + this.config.primarySearchMaximumMs;
    return now < primaryStartLimit && now < this.recoveryMustStartByMs;
  }

  public canStartRecovery(now = this.clock.now()): boolean {
    return now < this.finalizationMustStartByMs && this.remainingMs(now) > this.config.finalizationReserveMs;
  }

  public canContinueRecovery(now = this.clock.now()): boolean {
    return now < this.finalizationMustStartByMs;
  }

  public mustFinalize(now = this.clock.now()): boolean {
    return now >= this.finalizationMustStartByMs;
  }

  public primaryTimeAvailableMs(now = this.clock.now()): number {
    return Math.max(0, this.recoveryMustStartByMs - now);
  }

  public recoveryTimeAvailableMs(now = this.clock.now()): number {
    return Math.max(0, this.finalizationMustStartByMs - now);
  }

  public totalTimeAvailableMs(now = this.clock.now()): number {
    return this.remainingMs(now);
  }
}
