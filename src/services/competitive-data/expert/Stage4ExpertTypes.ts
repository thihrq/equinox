import { ExpertDecision, ExpertEvidence, ExpertFinding } from './CompetitiveDoublesExpertTypes';
import type { DecisionTraceStep, SpecialistConfidenceSummaryEntry } from './ExpertVerdictAggregator';

export type HumanReviewRequirement = 'not-required' | 'sampling-optional' | 'required' | 'not-applicable';
export type Confidence = 'high' | 'medium' | 'low';

export interface Stage4Candidate {
  candidateId: string;
  candidateDigest: string;
  pokemonId?: string;
  sourceType: 'generated';
  status: 'draft';
  humanReviewed: false;
  automaticPromotionAllowed: false;
  original?: Readonly<Record<string, unknown>>;
}

export interface Stage4EvidenceInput {
  packageDigest: string;
  mechanicsDigest: string;
  rosterDigest: string;
  candidateDigest: string;
  generationEvidence: boolean;
  damageEvidence: boolean;
  speedEvidence: boolean;
  scenarioEvidenceCount: number;
  fullTeamEvidenceCount: number;
  benchmarkEvidence: boolean;
  specialistVersions: string[];
  policyVersions: string[];
  assumptions: string[];
  limitations: string[];
  unsupportedMechanics: string[];
  blockers: string[];
  warnings: string[];
  confidence: Confidence;
}

export interface Stage4SpecialistResult {
  specialistId: string;
  specialistVersion: string;
  valid: boolean;
  reasonCodes: string[];
  blockers: string[];
  warnings: string[];
  confidence: Confidence;
  inputDigest: string;
  outputDigest: string;
  evidence: ExpertEvidence[];
  findings: ExpertFinding[];
}

export interface Stage4VerdictMetadata {
  verdict: ExpertDecision;
  validatedAt: string;
  policyVersion: string;
  evidenceDigest: string;
  confidence: Confidence;
}

export interface Stage4VerdictTransition {
  candidateId: string;
  candidateDigest: string;
  previousVerdict: 'agent-reviewed' | 'human-review-required' | 'rejected';
  expertVerdict: ExpertDecision;
  confidence: Confidence;
  humanReviewRequirement: HumanReviewRequirement;
  changed: boolean;
  reasonCodes: string[];
}

export interface Stage4EvidenceAuditResult {
  valid: boolean;
  reasonCodes: string[];
  blockers: string[];
  warnings: string[];
  evidenceDigest: string;
}

export interface Stage4CandidateContext {
  candidate: Stage4Candidate;
  legal: boolean;
  coherent: boolean;
  rolesSupported: boolean;
  generationResolved: boolean;
  formResolved: boolean;
  damageEvidence: boolean;
  speedEvidence: boolean;
  scenarioEvidenceCount: number;
  favorableScenarioCount: number;
  adverseScenarioCount: number;
  fullTeamEvidenceCount: number;
  fullTeamLegal: boolean;
  benchmarkEvidence: boolean;
  unsupportedMechanics: string[];
  packageDigest: string;
  mechanicsDigest: string;
  rosterDigest: string;
  previousVerdict: 'agent-reviewed' | 'human-review-required' | 'rejected';
  archetype: string;
  isMega: boolean;
  isRegional: boolean;
  hasTrickRoom: boolean;
  hasTailwind: boolean;
  hasWeather: boolean;
  hasTerrain: boolean;
  candidateDigestMatches?: boolean;
  // Wave 1D: structured Critical Review signals. Optional and defaulted to absent/false for
  // every existing caller -- Critical Review "must be ABLE to express" these (mission section 7),
  // not required to auto-detect them from context fields that don't exist yet for real candidates.
  criticalReviewSignals?: {
    candidateDominated?: boolean;
    excessivePartnerDependency?: boolean;
    noWinCondition?: boolean;
    fullTeamRiskMaterial?: boolean;
    coverageInsufficient?: boolean;
    contradictoryEvidence?: boolean;
  };
}

export interface Stage4CandidateValidationResult {
  candidateId: string;
  candidateDigest: string;
  specialistResults: Stage4SpecialistResult[];
  evidenceAudit: Stage4EvidenceAuditResult;
  verdict: ExpertDecision;
  confidence: Confidence;
  humanReviewRequirement: HumanReviewRequirement;
  reasonCodes: string[];
  expertValidation?: Stage4VerdictMetadata;
  // Wave 1D: traceability for the aggregation decision itself, separate from the overall
  // validation policyVersion in expertValidation (which identifies the whole Stage4 pipeline).
  aggregationPolicyId?: string;
  aggregationPolicyVersion?: string;
  materialFindings?: ExpertFinding[];
  // Wave 1C re-run: full propagation of the aggregator's audit-trail output (previously computed
  // but dropped at the orchestrator boundary -- flagged as NEW-P3-1 in the Wave 1D.1 peer review).
  appliedReasonCodes?: string[];
  informationalFindings?: ExpertFinding[];
  specialistConfidenceSummary?: SpecialistConfidenceSummaryEntry[];
  decisionTrace?: DecisionTraceStep[];
}
