export interface LeadBuildTimeBudget {
  totalBudgetMs: number;
  candidateFetchBudgetMs: number;
  primarySearchBudgetMs: number;
  configuredRecoveryBudgetMs: number;
  finalizationReserveMs: number;
}

export const DEFAULT_LEAD_BUILD_TIME_BUDGET: LeadBuildTimeBudget = {
  totalBudgetMs: 10000,
  candidateFetchBudgetMs: 4500,
  primarySearchBudgetMs: 3500,
  configuredRecoveryBudgetMs: 2500,
  finalizationReserveMs: 500,
};

export function calculateEffectiveRecoveryBudget(
  startTimeMs: number,
  budget: LeadBuildTimeBudget = DEFAULT_LEAD_BUILD_TIME_BUDGET,
): number {
  const elapsedMs = Date.now() - startTimeMs;
  const remainingTotalMs = budget.totalBudgetMs - elapsedMs;
  const availableMs = remainingTotalMs - budget.finalizationReserveMs;

  if (availableMs <= 0) return 0;
  return Math.min(budget.configuredRecoveryBudgetMs, availableMs);
}
