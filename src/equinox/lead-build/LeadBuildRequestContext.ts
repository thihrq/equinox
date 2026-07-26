import { RequestScopedEvaluationCache } from './RequestScopedEvaluationCache';
import { LeadBuildTimeBudget, DEFAULT_LEAD_BUILD_TIME_BUDGET } from './RecoverySearchBudget';
import { CandidateSourceParityManifest } from './CandidateSourceParityManifest';
import { CandidateSourceParityResult } from './CandidateSourceParityVerifier';

export interface LeadBuildMetrics {
  totalDurationMs: number;
  primarySearchMs: number;
  recoverySearchMs: number;
  cacheMetrics: {
    hits: number;
    misses: number;
    writes: number;
    duplicateEvaluationsAvoided: number;
  };
}

export interface LeadBuildRequestContext {
  requestId: string;
  startedAtMs: number;

  format: string;
  runtimeProfile: string;

  parityManifest?: CandidateSourceParityManifest;
  parityResult?: CandidateSourceParityResult;

  evaluationCache: RequestScopedEvaluationCache<any>;

  timeBudget: LeadBuildTimeBudget;

  metrics: LeadBuildMetrics;
}

export function createLeadBuildRequestContext(
  requestId: string,
  format = 'gen9vgc2024',
  runtimeProfile = 'production',
): LeadBuildRequestContext {
  return {
    requestId,
    startedAtMs: Date.now(),
    format,
    runtimeProfile,
    evaluationCache: new RequestScopedEvaluationCache<any>(500),
    timeBudget: DEFAULT_LEAD_BUILD_TIME_BUDGET,
    metrics: {
      totalDurationMs: 0,
      primarySearchMs: 0,
      recoverySearchMs: 0,
      cacheMetrics: {
        hits: 0,
        misses: 0,
        writes: 0,
        duplicateEvaluationsAvoided: 0,
      },
    },
  };
}
