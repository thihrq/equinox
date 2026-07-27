import { RequestScopedEvaluationCache } from './RequestScopedEvaluationCache';
import { LeadBuildTimeBudget, DEFAULT_LEAD_BUILD_TIME_BUDGET } from './RecoverySearchBudget';
import { CandidateSourceParityManifest } from './CandidateSourceParityManifest';
import { CandidateSourceParityResult } from './CandidateSourceParityVerifier';
import { LeadBuildPhaseBudget, RENDER_FREE_PHASE_BUDGET_CONFIG } from './LeadBuildPhaseBudget';
import { resolvePrimaryFinalistPolicy } from './PrimaryFinalistPolicy';
import { systemMonotonicClock } from './MonotonicClock';

export interface LeadBuildMetrics {
  totalDurationMs: number;
  primarySearchMs: number;
  recoverySearchMs: number;
  primaryCandidateFetchCount: number;
  primaryCandidatePoolSize: number;
  phaseBudgetInstanceCount: number;
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

  return {
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
    phaseBudget: new LeadBuildPhaseBudget(startedAtMonotonicMs, RENDER_FREE_PHASE_BUDGET_CONFIG, systemMonotonicClock),
    primaryFinalistBudgetRemaining: policy.maximumFinalistsPerRequest,
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
}
