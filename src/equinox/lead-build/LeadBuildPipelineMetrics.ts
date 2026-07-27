import { LeadBuildRequestContext } from './LeadBuildRequestContext';

export interface LeadBuildRuntimeDiagnostics {
  requestId: string;
  totalDurationMs: number;
  primarySearchMs: number;
  recoverySearchMs: number;
  totalBudgetMs: number;
  primaryBudgetMs: number;
  recoveryReserveMs: number;
  primaryCandidateFetchCount: number;
  primaryCandidatePoolSize: number;
  primaryCandidatePoolReused: boolean;
  primarySearchInterrupted: boolean;
  primarySearchStopReason: string;
  recoveryEligible: boolean;
  recoveryExecuted: boolean;
  recoveryStopReason?: string;
  recoveryTimeAvailableAtStartMs: number;
  recoverySkippedReason?: string;
  cache: {
    hits: number;
    misses: number;
    writes: number;
    duplicateEvaluationsAvoided: number;
  };
  parityValid: boolean;
}

export function buildLeadBuildRuntimeDiagnostics(
  context: LeadBuildRequestContext,
  strategyResultsCount: number,
  recoveryOutcome?: { executed: boolean; stopReason?: string },
): LeadBuildRuntimeDiagnostics {
  return {
    requestId: context.requestId,
    totalDurationMs: context.metrics.totalDurationMs,
    primarySearchMs: context.metrics.primarySearchMs,
    recoverySearchMs: context.metrics.recoverySearchMs,
    totalBudgetMs: context.phaseBudget.config.totalBudgetMs,
    primaryBudgetMs: context.phaseBudget.config.primarySearchMaximumMs,
    recoveryReserveMs: context.phaseBudget.config.recoveryReserveMs,
    primaryCandidateFetchCount: context.metrics.primaryCandidateFetchCount,
    primaryCandidatePoolSize: context.metrics.primaryCandidatePoolSize,
    primaryCandidatePoolReused: true,
    primarySearchInterrupted: context.phaseBudget.getStopReason() === 'PRIMARY_TIME_BUDGET_REACHED',
    primarySearchStopReason: context.phaseBudget.getStopReason() ?? (strategyResultsCount > 0 ? 'ACCEPTED' : 'EXHAUSTED'),
    recoveryEligible: recoveryOutcome?.executed !== undefined || strategyResultsCount === 0,
    recoveryExecuted: recoveryOutcome?.executed ?? false,
    recoveryStopReason: recoveryOutcome?.stopReason,
    recoveryTimeAvailableAtStartMs: context.phaseBudget.recoveryTimeAvailableMs(),
    recoverySkippedReason: recoveryOutcome?.executed === false ? (recoveryOutcome?.stopReason ?? 'NO_REMAINING_TIME_BUDGET') : undefined,
    cache: context.metrics.cacheMetrics,
    parityValid: context.parityResult?.valid ?? true,
  };
}
