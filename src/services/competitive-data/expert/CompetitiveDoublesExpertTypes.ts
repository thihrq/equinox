export type ExpertDecision = 'expert-validated' | 'expert-review-required' | 'rejected';
export type ExpertFindingSeverity = 'blocking' | 'error' | 'warning' | 'info';
export type ExpertEvidenceKind = 'source' | 'calculation' | 'scenario' | 'benchmark' | 'audit';

// Wave 1D (Expert Verdict Aggregation Policy Correction): `materiality` is the field the
// aggregator actually keys decisions on -- coarser and more auditable than `severity`, which
// only expresses this finding's own urgency, not its effect on the aggregate verdict.
// `category`/`materiality` are additive/optional so every pre-existing ExpertFinding literal in
// the codebase keeps compiling unchanged; the aggregator falls back to a policy-documented
// default (see ExpertVerdictAggregationPolicy.reasonCodeMappings / warningMaterialityRules) for
// findings that don't set them explicitly.
export type ExpertFindingCategory =
  | 'legality' | 'integrity' | 'evidence' | 'unsupported-mechanic' | 'set-coherence' | 'role'
  | 'archetype' | 'damage' | 'speed' | 'scenario' | 'benchmark' | 'full-team'
  | 'partner-dependency' | 'candidate-dominated' | 'strategic-risk';

export type ExpertFindingMateriality = 'verdict-blocking' | 'review-required' | 'confidence-degrading' | 'informational';

export interface ExpertFinding {
  code: string;
  message: string;
  severity: ExpertFindingSeverity;
  blocking: boolean;
  evidenceIds: string[];
  specialistId?: string;
  category?: ExpertFindingCategory;
  materiality?: ExpertFindingMateriality;
}

export interface ExpertEvidence {
  evidenceId: string;
  kind: ExpertEvidenceKind;
  sourceId: string;
  sourceRevision: string;
  inputDigest: string;
  resultDigest: string;
  description: string;
}

export interface ExpertCandidateRef {
  candidateId: string;
  candidateDigest: string;
  pokemonId: string;
  speciesId: string;
  formId?: string;
  status: 'generated';
  reviewStatus: 'draft';
}

export interface ExpertEngineExecutionState {
  executed: boolean;
  executionReason: 'contracts-only' | 'engine-disabled' | 'engine-executed';
}

export interface ExpertComponentResult {
  componentId: string;
  valid: boolean;
  findings: ExpertFinding[];
  evidence: ExpertEvidence[];
  execution: ExpertEngineExecutionState;
}

export interface ExpertVerdict {
  candidate: ExpertCandidateRef;
  decision: ExpertDecision;
  score: number;
  findings: ExpertFinding[];
  evidence: ExpertEvidence[];
  automaticPromotionAllowed: false;
  humanReviewRequired: boolean;
  policyVersion: string;
}

export interface CompetitiveDoublesExpertRunManifest {
  expertRunId: string;
  sourceCurationRunId: string;
  sourceAuditRunId: string;
  regulationId: 'M-B';
  packageDigest: string;
  rosterDigest: string;
  mechanicsDigest: string;
  generationCatalogVersion: string;
  damageFormulaVersion: string;
  speedFormulaVersion: string;
  scenarioPolicyVersion: string;
  benchmarkPolicyVersion: string;
  expertPolicyVersion: string;
  candidateCount: number;
  expertValidatedCount: number;
  expertReviewRequiredCount: number;
  rejectedCount: number;
  humanReviewRequiredCount: number;
  humanSamplingCount: number;
  mongoReads: 0;
  mongoWrites: 0;
  productionWrites: 0;
  automaticPromotionAllowed: false;
  artifactsDigest: string;
}
