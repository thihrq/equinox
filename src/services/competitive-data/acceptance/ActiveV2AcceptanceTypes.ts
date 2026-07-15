import type {
  ActiveV2ShadowReport,
  ActiveV2ShadowScenarioResult,
} from '../../../equinox/competitive/active-v2-shadow/ActiveV2ShadowTypes';

export type CompetitiveClassification =
  | 'blocker'
  | 'regression'
  | 'human-review-needed'
  | 'improvement'
  | 'acceptable-divergence'
  | 'equivalent';

export type AcceptanceReasonCode =
  | 'SHADOW_EVIDENCE_INVALID'
  | 'ACTIVE_V2_FALLBACK_INTRODUCED'
  | 'EXECUTION_ERROR_PRESENT'
  | 'SET_QUALITY_REGRESSION'
  | 'SCORE_MAJOR_REGRESSION'
  | 'SCORE_REVIEW_RANGE'
  | 'SCORE_IMPROVEMENT'
  | 'CENTRAL_STRATEGY_CHANGED'
  | 'TACTICAL_VARIATION_ACCEPTABLE'
  | 'CRITICAL_COMPARATORS_EQUAL';

export interface ComparatorClassification {
  comparator: string;
  diffStatus: 'equal' | 'different' | 'error';
  classification: CompetitiveClassification;
  reasonCode: AcceptanceReasonCode;
  explanation: string;
  baselineValue?: unknown;
  activeV2Value?: unknown;
  scoreDeltaAbsolute?: number;
  scoreDeltaPercent?: number | null;
}

export interface AcceptanceScenarioVerdict {
  scenarioId: string;
  comparatorClassifications: ComparatorClassification[];
  scenarioClassification: CompetitiveClassification;
  automaticApproval: boolean;
  requiresHumanReview: boolean;
}

export type AcceptanceGateStatus =
  | 'approved'
  | 'rejected'
  | 'human-review-required';

export interface GlobalBlocker {
  classification: 'blocker';
  reasonCode: AcceptanceReasonCode;
  explanation: string;
}

export interface ActiveV2AcceptanceReport {
  policyVersion: string;
  inputEvidenceDigest: string;
  inputCommitSha: string;
  inputActiveRunId: string;
  evidenceValid: boolean;
  globalBlockers: GlobalBlocker[];
  classificationCounts: {
    blocker: number;
    regression: number;
    'human-review-needed': number;
    improvement: number;
    'acceptable-divergence': number;
    equivalent: number;
  };
  scenarioVerdicts: AcceptanceScenarioVerdict[];
  gateStatus: AcceptanceGateStatus;
  automaticRolloutApproved: boolean;
  generatedAt: string;
}
