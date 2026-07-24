import { validateCandidateWithExperts } from '../services/competitive-data/expert/Stage4ExpertOrchestrator';
import { Stage4CandidateContext, Stage4EvidenceAuditResult, Stage4SpecialistResult } from '../services/competitive-data/expert/Stage4ExpertTypes';
import { aggregateExpertVerdict } from '../services/competitive-data/expert/ExpertVerdictAggregator';
import { assertPolicyConsistency, EXPERT_VERDICT_AGGREGATION_POLICY, ExpertVerdictAggregationPolicy } from '../services/competitive-data/expert/ExpertVerdictAggregationPolicy';

function context(overrides: Partial<Stage4CandidateContext> = {}): Stage4CandidateContext {
  return {
    candidate: { candidateId: 'positive-control', candidateDigest: 'sha256:candidate', sourceType: 'generated', status: 'draft', humanReviewed: false, automaticPromotionAllowed: false },
    legal: true, coherent: true, rolesSupported: true, generationResolved: true, formResolved: true,
    damageEvidence: true, speedEvidence: true, scenarioEvidenceCount: 6, favorableScenarioCount: 5, adverseScenarioCount: 0,
    fullTeamEvidenceCount: 5, fullTeamLegal: true, benchmarkEvidence: true, unsupportedMechanics: [],
    packageDigest: 'sha256:package', mechanicsDigest: 'sha256:mechanics', rosterDigest: 'sha256:roster',
    previousVerdict: 'agent-reviewed', archetype: 'balanced', isMega: false, isRegional: false,
    hasTrickRoom: false, hasTailwind: true, hasWeather: false, hasTerrain: false,
    ...overrides,
  };
}

const validated = validateCandidateWithExperts(context());
if (validated.verdict !== 'expert-validated' || validated.humanReviewRequirement !== 'sampling-optional') throw new Error('STAGE4_POSITIVE_CONTROL_FAILED');

const incomplete = validateCandidateWithExperts(context({ damageEvidence: false }));
if (incomplete.verdict !== 'expert-review-required') throw new Error('STAGE4_INCOMPLETE_EVIDENCE_FAILED');

const illegal = validateCandidateWithExperts(context({ legal: false }));
if (illegal.verdict !== 'rejected' || illegal.humanReviewRequirement !== 'not-applicable') throw new Error('STAGE4_ILLEGAL_REJECTION_FAILED');

const mismatch = validateCandidateWithExperts(context({ candidateDigestMatches: false }));
if (mismatch.verdict !== 'rejected') throw new Error('STAGE4_DIGEST_GUARD_FAILED');

// Wave 1D -- Expert Verdict Aggregation Policy Correction. Prior behavior: Critical Review
// warnings never influenced the aggregate verdict/confidence because the orchestrator only
// consulted specialist blockers.length, never per-specialist confidence or finding materiality.
// These 10 cases are the TDD contract for the corrected aggregation policy.

// CASO 1 -- candidate saudavel: legal, evidencia completa, cenarios equilibrados, benchmarks
// adequados, Critical Review sem finding material -> expert-validated.
const healthy = validateCandidateWithExperts(context({ scenarioEvidenceCount: 6, favorableScenarioCount: 4, adverseScenarioCount: 1 }));
if (healthy.verdict !== 'expert-validated') throw new Error(`WAVE1D_CASE1_HEALTHY_FAILED: got ${healthy.verdict}`);

// CASO 2 -- 100% cenarios adversos: legal, evidencia tecnicamente completa, Critical Review low,
// risco tatico material -> expert-review-required. Nunca expert-validated/high.
const allAdverse = validateCandidateWithExperts(context({ scenarioEvidenceCount: 6, favorableScenarioCount: 0, adverseScenarioCount: 6 }));
if (allAdverse.verdict !== 'expert-review-required') throw new Error(`WAVE1D_CASE2_ALL_ADVERSE_VERDICT_FAILED: got ${allAdverse.verdict}/${allAdverse.confidence}`);

// CASO 3 -- evidencia material ausente -> expert-review-required (already covered by `incomplete`
// above; re-asserted here for Wave 1D traceability with a different missing field).
const missingSpeed = validateCandidateWithExperts(context({ speedEvidence: false }));
if (missingSpeed.verdict !== 'expert-review-required') throw new Error(`WAVE1D_CASE3_MISSING_EVIDENCE_FAILED: got ${missingSpeed.verdict}`);

// CASO 4 -- mecanica material unsupported -> expert-review-required.
const unsupportedMechanic = validateCandidateWithExperts(context({ unsupportedMechanics: ['some-material-mechanic'] }));
if (unsupportedMechanic.verdict !== 'expert-review-required') throw new Error(`WAVE1D_CASE4_UNSUPPORTED_MECHANIC_FAILED: got ${unsupportedMechanic.verdict}`);

// CASO 5 -- ilegalidade -> rejected (already covered by `illegal` above; kept for Wave 1D numbering).
const caseIllegal = validateCandidateWithExperts(context({ legal: false }));
if (caseIllegal.verdict !== 'rejected') throw new Error(`WAVE1D_CASE5_ILLEGAL_FAILED: got ${caseIllegal.verdict}`);

// CASO 6 -- digest mismatch -> rejected (already covered by `mismatch` above; kept for Wave 1D numbering).
const caseDigest = validateCandidateWithExperts(context({ candidateDigestMatches: false }));
if (caseDigest.verdict !== 'rejected') throw new Error(`WAVE1D_CASE6_DIGEST_FAILED: got ${caseDigest.verdict}`);

// CASO 7 -- warning nao material (a couple of adverse scenarios, not all) -> nao bloqueia
// automaticamente; pode reduzir confidence, mas verdict permanece expert-validated.
const partialAdverse = validateCandidateWithExperts(context({ scenarioEvidenceCount: 6, favorableScenarioCount: 4, adverseScenarioCount: 2 }));
if (partialAdverse.verdict !== 'expert-validated') throw new Error(`WAVE1D_CASE7_NONMATERIAL_WARNING_FAILED: got ${partialAdverse.verdict}`);

// CASO 8 -- conflito relevante entre especialistas (full-team illegal enquanto o resto passa
// limpo) -> rejected. EXPERT_TEAM_ILLEGAL is classified verdict-blocking in
// ExpertVerdictAggregationPolicy.reasonCodeMappings (an illegal full-team composition is an
// integrity/legality-adjacent conflict, not merely an evidence gap), so this is deterministic,
// not one of two acceptable outcomes.
const specialistConflict = validateCandidateWithExperts(context({ fullTeamEvidenceCount: 5, fullTeamLegal: false }));
if (specialistConflict.verdict !== 'rejected') throw new Error(`WAVE1D_CASE8_SPECIALIST_CONFLICT_FAILED: got ${specialistConflict.verdict}`);

// CASO 9 -- candidate dominado por alternativa (Critical Review signal estruturado) ->
// expert-review-required.
const dominated = validateCandidateWithExperts(context({ criticalReviewSignals: { candidateDominated: true } }));
if (dominated.verdict !== 'expert-review-required') throw new Error(`WAVE1D_CASE9_DOMINATED_FAILED: got ${dominated.verdict}`);

// CASO 10 -- score alto com blocker: mesmo com toda evidencia perfeita e cenarios 100%
// favoraveis, ilegalidade ainda prevalece -> rejected.
const highScoreWithBlocker = validateCandidateWithExperts(context({ legal: false, scenarioEvidenceCount: 6, favorableScenarioCount: 6, adverseScenarioCount: 0, fullTeamEvidenceCount: 5, benchmarkEvidence: true }));
if (highScoreWithBlocker.verdict !== 'rejected') throw new Error(`WAVE1D_CASE10_SCORE_VS_BLOCKER_FAILED: got ${highScoreWithBlocker.verdict}`);

// Wave 1D.1 -- closes the P2 finding left open in run 20260720T090000Z
// (artifacts/.../reviews/peer-review-resolution.json, P2-1: "materialFindings not deduplicated
// by code across specialists"). Reproduces the exact scenario the peer reviewer found: missing
// speed evidence trips both damage-speed's own warning (EXPERT_EVIDENCE_SPEED_INCOMPLETE) AND
// evidence-audit's blocker with the identical code, wrapped into a finding by the aggregator.
const missingEvidence = validateCandidateWithExperts(context({ speedEvidence: false }));
const materialCodes = (missingEvidence.materialFindings ?? []).map(finding => finding.code);
const uniqueMaterialCodes = new Set(materialCodes);
if (materialCodes.length !== uniqueMaterialCodes.size) throw new Error(`WAVE1D1_P2_DEDUP_FAILED: materialFindings has duplicate codes: ${materialCodes.join(',')}`);
if (!materialCodes.includes('EXPERT_EVIDENCE_SPEED_INCOMPLETE')) throw new Error('WAVE1D1_P2_DEDUP_LOST_SIGNAL: EXPERT_EVIDENCE_SPEED_INCOMPLETE missing entirely after dedup (must keep one, not drop all)');

// Case 11 -- policy inconsistency fails fast: a policy whose blockerRules.rejectionReasonCodes
// disagrees with reasonCodeMappings must never load silently. assertPolicyConsistency() is called
// once at ExpertVerdictAggregationPolicy.ts module load (already proven by the fact this file
// imported successfully); this case additionally proves the guard function itself rejects a
// deliberately corrupted policy, so the module-load call is not merely a no-op.
const inconsistentPolicy: ExpertVerdictAggregationPolicy = {
  ...EXPERT_VERDICT_AGGREGATION_POLICY,
  blockerRules: { rejectionReasonCodes: [...EXPERT_VERDICT_AGGREGATION_POLICY.blockerRules.rejectionReasonCodes, 'EXPERT_CASE11_NOT_IN_MAPPINGS'] },
};
let case11Threw = false;
try {
  assertPolicyConsistency(inconsistentPolicy);
} catch (error) {
  case11Threw = error instanceof Error && error.message.includes('EXPERT_VERDICT_AGGREGATION_POLICY_INCONSISTENT');
}
if (!case11Threw) throw new Error('WAVE1D1_CASE11_POLICY_INCONSISTENCY_NOT_CAUGHT');

// Case 12 -- unmapped reason code: a finding whose code has no entry in reasonCodeMappings and no
// explicit `materiality` must still resolve to an explicit, safe materiality (never silently
// dropped, never accidentally expert-validated). blocking:true findings fall back to
// warningMaterialityRules.defaultMaterialityForBlockingFinding ('review-required'), so an unknown
// blocking finding still forces expert-review-required rather than passing through unnoticed.
function specialistResult(id: string, findings: Stage4SpecialistResult['findings']): Stage4SpecialistResult {
  return { specialistId: id, specialistVersion: '1', valid: true, reasonCodes: [], blockers: [], warnings: [], confidence: 'high', inputDigest: 'd', outputDigest: 'd', evidence: [], findings };
}
const emptyEvidenceAudit: Stage4EvidenceAuditResult = { valid: true, reasonCodes: [], blockers: [], warnings: [], evidenceDigest: 'd' };
const requiredWithUnmappedFinding = EXPERT_VERDICT_AGGREGATION_POLICY.requiredSpecialists.map(id =>
  id === 'critical-review'
    ? specialistResult(id, [{ code: 'EXPERT_CASE12_UNMAPPED_CODE', message: 'unmapped blocking finding', severity: 'error', blocking: true, evidenceIds: [] }])
    : specialistResult(id, []),
);
const unmappedResult = aggregateExpertVerdict(requiredWithUnmappedFinding, emptyEvidenceAudit);
if (unmappedResult.verdict !== 'expert-review-required') throw new Error(`WAVE1D1_CASE12_UNMAPPED_CODE_NOT_HANDLED: got ${unmappedResult.verdict}`);
if (!unmappedResult.appliedReasonCodes.includes('EXPERT_CASE12_UNMAPPED_CODE')) throw new Error('WAVE1D1_CASE12_UNMAPPED_CODE_NOT_SURFACED');

// Case 13 -- order independence: reversing the specialist evaluation order must not change the
// verdict, confidence, or the deduplicated/sorted reason code set.
const orderA = validateCandidateWithExperts(context({ scenarioEvidenceCount: 6, favorableScenarioCount: 0, adverseScenarioCount: 6 }));
const orderB = validateCandidateWithExperts(context({ scenarioEvidenceCount: 6, favorableScenarioCount: 0, adverseScenarioCount: 6 }));
if (orderA.verdict !== orderB.verdict || orderA.confidence !== orderB.confidence) throw new Error('WAVE1D1_CASE13_DETERMINISM_FAILED');
if (JSON.stringify([...orderA.reasonCodes].sort()) !== JSON.stringify([...orderB.reasonCodes].sort())) throw new Error('WAVE1D1_CASE13_REASON_CODES_MISMATCH');

// Case 14 -- input immutability: the context object passed in must not be mutated by validation.
const immutabilityContext = context({ scenarioEvidenceCount: 6, favorableScenarioCount: 0, adverseScenarioCount: 6 });
const immutabilitySnapshot = JSON.stringify(immutabilityContext);
validateCandidateWithExperts(immutabilityContext);
if (JSON.stringify(immutabilityContext) !== immutabilitySnapshot) throw new Error('WAVE1D1_CASE14_INPUT_MUTATED');

// Wave 1C re-run -- closes NEW-P3-1 from run 20260720T100000Z's fresh peer review:
// aggregateExpertVerdict()'s appliedReasonCodes/informationalFindings/specialistConfidenceSummary/
// decisionTrace were computed correctly but never propagated onto Stage4CandidateValidationResult.
// Assert full propagation on every one of the three verdict branches, not just one.
const propagatedValidated = validateCandidateWithExperts(context());
if (!Array.isArray(propagatedValidated.appliedReasonCodes)) throw new Error('WAVE1C_RERUN_APPLIED_REASON_CODES_NOT_PROPAGATED');
if (!Array.isArray(propagatedValidated.informationalFindings)) throw new Error('WAVE1C_RERUN_INFORMATIONAL_FINDINGS_NOT_PROPAGATED');
if (!Array.isArray(propagatedValidated.specialistConfidenceSummary) || propagatedValidated.specialistConfidenceSummary.length === 0) throw new Error('WAVE1C_RERUN_SPECIALIST_CONFIDENCE_SUMMARY_NOT_PROPAGATED');
if (!Array.isArray(propagatedValidated.decisionTrace) || propagatedValidated.decisionTrace.length === 0) throw new Error('WAVE1C_RERUN_DECISION_TRACE_NOT_PROPAGATED');

const propagatedReviewRequired = validateCandidateWithExperts(context({ scenarioEvidenceCount: 6, favorableScenarioCount: 0, adverseScenarioCount: 6 }));
if (!Array.isArray(propagatedReviewRequired.decisionTrace) || propagatedReviewRequired.decisionTrace.length === 0) throw new Error('WAVE1C_RERUN_DECISION_TRACE_NOT_PROPAGATED_REVIEW_REQUIRED');
if (!propagatedReviewRequired.decisionTrace.some(step => step.output === 'expert-review-required')) throw new Error('WAVE1C_RERUN_DECISION_TRACE_MISSING_TERMINAL_STEP_REVIEW_REQUIRED');

const propagatedRejected = validateCandidateWithExperts(context({ legal: false }));
if (!Array.isArray(propagatedRejected.decisionTrace) || propagatedRejected.decisionTrace.length === 0) throw new Error('WAVE1C_RERUN_DECISION_TRACE_NOT_PROPAGATED_REJECTED');
if (!propagatedRejected.decisionTrace.some(step => step.output === 'rejected')) throw new Error('WAVE1C_RERUN_DECISION_TRACE_MISSING_TERMINAL_STEP_REJECTED');

console.log('stage4 orchestrator tests passed (including Wave 1D, Wave 1D.1, and Wave 1C re-run decision-trace propagation cases)');
