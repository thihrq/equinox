import { RecoveryCapabilityPlan, RecoveryCapabilityRequest } from './RecoveryCapabilityPlanner';
import { RecoveryCandidateFetcher } from './RecoveryCandidateFetcher';
import { calculateEffectiveRecoveryBudget, LeadBuildTimeBudget, DEFAULT_LEAD_BUILD_TIME_BUDGET } from './RecoverySearchBudget';

export interface StrategyRecoveryState {
  strategyId: string;
  primaryAccepted: boolean;
  eligible: boolean;
  executed: boolean;
  accepted: boolean;
  passesExecuted: number;
  requestedCapabilities: readonly string[];
  stopReason: string;
}

export interface LeadBuildRecoveryResult {
  executed: boolean;
  acceptedStrategies: number;
  recoveryState: StrategyRecoveryState;
  recoveredCandidatesCount: number;
  stopReason: string;
}

export class LeadBuildRecoverySearch {
  private readonly fetcher = new RecoveryCandidateFetcher();

  async executeRecoverySearch(
    plan: RecoveryCapabilityPlan,
    availableUniverse: readonly any[],
    startTimeMs: number,
    budget: LeadBuildTimeBudget = DEFAULT_LEAD_BUILD_TIME_BUDGET,
  ): Promise<LeadBuildRecoveryResult> {
    const effectiveBudget = calculateEffectiveRecoveryBudget(startTimeMs, budget);

    if (!plan.eligible) {
      return {
        executed: false,
        acceptedStrategies: 0,
        recoveryState: {
          strategyId: plan.strategyId,
          primaryAccepted: plan.ineligibilityReasons.includes('PRIMARY_SEARCH_SUCCEEDED'),
          eligible: false,
          executed: false,
          accepted: false,
          passesExecuted: 0,
          requestedCapabilities: [],
          stopReason: plan.ineligibilityReasons[0] || 'RECOVERY_NOT_ELIGIBLE',
        },
        recoveredCandidatesCount: 0,
        stopReason: plan.ineligibilityReasons[0] || 'RECOVERY_NOT_ELIGIBLE',
      };
    }

    if (effectiveBudget <= 0) {
      return {
        executed: false,
        acceptedStrategies: 0,
        recoveryState: {
          strategyId: plan.strategyId,
          primaryAccepted: false,
          eligible: true,
          executed: false,
          accepted: false,
          passesExecuted: 0,
          requestedCapabilities: plan.requests.map(r => 'kind' in r ? r.kind : r.capability),
          stopReason: 'NO_REMAINING_TIME_BUDGET',
        },
        recoveredCandidatesCount: 0,
        stopReason: 'NO_REMAINING_TIME_BUDGET',
      };
    }

    // Executar fetch direcionado
    const fetchResult = await this.fetcher.fetchTargetedRecoveryCandidates(
      {
        format: 'gen9vgc2024',
        strategyId: plan.strategyId,
        leadCandidateIds: [],
        // Módulo legado sem nenhum chamador de produção (confirmado via
        // grep) — não estendido para o novo request de COVERAGE_BREADTH;
        // cast preserva o comportamento anterior sem herdar a mudança de tipo.
        requiredCapabilities: plan.requests as RecoveryCapabilityRequest[],
        excludedCandidateIds: [],
        excludedCapabilityKeys: [],
        maximumRawCandidates: plan.maximumAdditionalRawCandidates,
        maximumUsableCandidates: plan.maximumAdditionalUsableCandidates,
      },
      availableUniverse,
    );

    const hasRecoveredCandidates = fetchResult.usableCandidates.length > 0;
    const stopReason = hasRecoveredCandidates ? 'VALID_RECOVERY_CANDIDATES_FOUND' : 'SOURCE_EXHAUSTED';

    return {
      executed: true,
      acceptedStrategies: hasRecoveredCandidates ? 1 : 0,
      recoveryState: {
        strategyId: plan.strategyId,
        primaryAccepted: false,
        eligible: true,
        executed: true,
        accepted: hasRecoveredCandidates,
        passesExecuted: 1,
        requestedCapabilities: plan.requests.map(r => 'kind' in r ? r.kind : r.capability),
        stopReason,
      },
      recoveredCandidatesCount: fetchResult.usableCandidates.length,
      stopReason,
    };
  }
}
