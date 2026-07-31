import { RequestScopedEvaluationCache } from './RequestScopedEvaluationCache';
import { LeadBuildTimeBudget, DEFAULT_LEAD_BUILD_TIME_BUDGET } from './RecoverySearchBudget';
import { CandidateSourceParityManifest } from './CandidateSourceParityManifest';
import { CandidateSourceParityResult } from './CandidateSourceParityVerifier';
import { LeadBuildPhaseBudget, RENDER_FREE_PHASE_BUDGET_CONFIG } from './LeadBuildPhaseBudget';
import { resolvePrimaryFinalistPolicy } from './PrimaryFinalistPolicy';
import { systemMonotonicClock } from './MonotonicClock';

export interface LeadBuildInvocationCounters {
  anytimeCoordinatorInvocationCount: number;
  legacyExpandBeamInvocationCount: number;
  roundRobinSchedulerInvocationCount: number;
  firstPassStrategyAttemptCount: number;
  firstCompleteTeamBuilderInvocationCount: number;
  compositionPlannerInvocationCount: number;
  capabilityIndexBuildCount: number;
  capabilityIndexReuseCount: number;
  acceptedTeamWithoutAcceptanceDecision: number;
  candidateQueryCount: number;
  candidateBatchCount: number;
  candidateQueryRawLimit: number;
  candidateQueryReturnedCount: number;
  candidateRejectedLeadMember: number;
  candidateRejectedSpeciesClause: number;
  candidateRejectedFormat: number;
  candidateRejectedMissingCompetitiveSet: number;
  candidateRejectedIllegal: number;
  candidateRejectedMissingTypes: number;
  candidateRejectedItemConflict: number;
  candidateRejectedOther: number;
  candidateUsableBeforeSelection: number;
  candidateInitialSelectedCount: number;
  targetedAdditionalFetchCount: number;
  duplicateCandidateQueryCount: number;
  partialFeasibilityEvaluationCount: number;
  incompleteRecoveryPlannerInvocationCount: number;
  anytimeRecoveryCoordinatorInvocationCount: number;
  fullTeamAcceptanceDecisionInvocationCount: number;
}

export interface LeadBuildMetrics {
  totalDurationMs: number;
  primarySearchMs: number;
  recoverySearchMs: number;
  primaryCandidateFetchCount: number;
  primaryCandidatePoolSize: number;
  phaseBudgetInstanceCount: number;
  requestElapsedAfterHydrateMs?: number;
  requestElapsedAfterCandidateFetchMs?: number;
  cacheMetrics: {
    hits: number;
    misses: number;
    writes: number;
    duplicateEvaluationsAvoided: number;
  };
}

export interface RecoveryBudgetState {
  passesRemaining: number;
  rawCandidatesRemaining: number;
  usableCandidatesRemaining: number;
}

export interface LeadBuildRequestContext {
  requestId: string;
  startedAtMs: number;
  startedAtMonotonicMs: number;

  format: string;
  runtimeProfile: string;

  parityManifest?: CandidateSourceParityManifest;
  parityResult?: CandidateSourceParityResult;

  evaluationCache: RequestScopedEvaluationCache<any>;

  timeBudget: LeadBuildTimeBudget;
  recoveryBudget: RecoveryBudgetState;
  phaseBudget: LeadBuildPhaseBudget;
  primaryFinalistBudgetRemaining: number;

  invocationCounters: LeadBuildInvocationCounters;
  phaseBudgetInstanceIds: Set<string>;
  registerPhaseBudgetInstance: (instanceId: string) => void;

  metrics: LeadBuildMetrics;
}

export function createLeadBuildRequestContext(
  requestId: string,
  format = 'gen9vgc2024',
  runtimeProfile = 'production',
  initialStartedAtMs?: number,
  initialStartedAtMonotonicMs?: number,
): LeadBuildRequestContext {
  const startedAtMs = initialStartedAtMs ?? Date.now();
  const startedAtMonotonicMs = initialStartedAtMonotonicMs ?? systemMonotonicClock.now();
  const policy = resolvePrimaryFinalistPolicy(runtimeProfile);

  const phaseBudget = new LeadBuildPhaseBudget(startedAtMonotonicMs, RENDER_FREE_PHASE_BUDGET_CONFIG, systemMonotonicClock);
  const phaseBudgetInstanceIds = new Set<string>([requestId]);

  const invocationCounters: LeadBuildInvocationCounters = {
    anytimeCoordinatorInvocationCount: 0,
    legacyExpandBeamInvocationCount: 0,
    roundRobinSchedulerInvocationCount: 0,
    firstPassStrategyAttemptCount: 0,
    firstCompleteTeamBuilderInvocationCount: 0,
    compositionPlannerInvocationCount: 0,
    capabilityIndexBuildCount: 0,
    capabilityIndexReuseCount: 0,
    acceptedTeamWithoutAcceptanceDecision: 0,
    candidateQueryCount: 0,
    candidateBatchCount: 0,
    candidateQueryRawLimit: 30,
    candidateQueryReturnedCount: 0,
    candidateRejectedLeadMember: 0,
    candidateRejectedSpeciesClause: 0,
    candidateRejectedFormat: 0,
    candidateRejectedMissingCompetitiveSet: 0,
    candidateRejectedIllegal: 0,
    candidateRejectedMissingTypes: 0,
    candidateRejectedItemConflict: 0,
    candidateRejectedOther: 0,
    candidateUsableBeforeSelection: 0,
    candidateInitialSelectedCount: 0,
    targetedAdditionalFetchCount: 0,
    duplicateCandidateQueryCount: 0,
    partialFeasibilityEvaluationCount: 0,
    incompleteRecoveryPlannerInvocationCount: 0,
    anytimeRecoveryCoordinatorInvocationCount: 0,
    fullTeamAcceptanceDecisionInvocationCount: 0,
  };

  const context: LeadBuildRequestContext = {
    requestId,
    startedAtMs,
    startedAtMonotonicMs,
    format,
    runtimeProfile,
    evaluationCache: new RequestScopedEvaluationCache<any>(500),
    timeBudget: DEFAULT_LEAD_BUILD_TIME_BUDGET,
    recoveryBudget: {
      passesRemaining: 2,
      rawCandidatesRemaining: 60,
      usableCandidatesRemaining: 16,
    },
    phaseBudget,
    primaryFinalistBudgetRemaining: policy.maximumFinalistsPerRequest,
    invocationCounters,
    phaseBudgetInstanceIds,
    registerPhaseBudgetInstance: (id: string) => {
      phaseBudgetInstanceIds.add(id);
      context.metrics.phaseBudgetInstanceCount = phaseBudgetInstanceIds.size;
    },
    metrics: {
      totalDurationMs: 0,
      primarySearchMs: 0,
      recoverySearchMs: 0,
      primaryCandidateFetchCount: 0,
      primaryCandidatePoolSize: 0,
      phaseBudgetInstanceCount: 1,
      cacheMetrics: {
        hits: 0,
        misses: 0,
        writes: 0,
        duplicateEvaluationsAvoided: 0,
      },
    },
  };

  return context;
}
