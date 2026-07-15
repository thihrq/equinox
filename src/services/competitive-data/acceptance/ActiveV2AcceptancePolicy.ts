export interface ActiveV2AcceptancePolicy {
  version: string;
  scoreRegressionExclusiveUpperBound: number;
  scoreReviewExclusiveUpperBound: number;
  scoreAcceptableUpperBound: number;
}

export const ACTIVE_V2_ACCEPTANCE_POLICY_V1: ActiveV2AcceptancePolicy = {
  version: 'active-v2-acceptance-v1',
  scoreRegressionExclusiveUpperBound: -10,
  scoreReviewExclusiveUpperBound: -5,
  scoreAcceptableUpperBound: 5,
} as const;

export const SET_QUALITY_RANK = {
  'active-curated': 7,
  'verified-curated': 6,
  'reviewed-curated': 5,
  'verified-generated': 4,
  'reviewed-generated': 3,
  'local-pilot': 2,
  'generic-fallback': 1,
  missing: 0,
} as const;

export type SetQualityCategory = keyof typeof SET_QUALITY_RANK;

export const CRITICAL_COMPARATORS = [
  'setDiff',
  'moveDiff',
  'itemDiff',
  'abilityDiff',
  'roleDiff',
  'leadStrategyDiff',
  'selectedLeadStrategyDiff',
  'teamDataCoverageDiff',
  'fullTeamEvaluationDiff',
  'scoreDiff',
  'fallbackDiff',
  'exportDiff',
  'errorDiff',
] as const;

export type CriticalComparatorName = typeof CRITICAL_COMPARATORS[number];
