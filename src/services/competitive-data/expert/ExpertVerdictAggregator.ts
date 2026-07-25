import { ExpertDecision, ExpertFinding, ExpertFindingMateriality } from './CompetitiveDoublesExpertTypes';
import { EXPERT_VERDICT_AGGREGATION_POLICY, ExpertVerdictAggregationPolicy } from './ExpertVerdictAggregationPolicy';
import { Confidence, Stage4EvidenceAuditResult, Stage4SpecialistResult } from './Stage4ExpertTypes';

export interface SpecialistConfidenceSummaryEntry {
  specialistId: string;
  confidence: Confidence;
  /** true if at least one of this specialist's own findings is review-required or worse. */
  material: boolean;
}

export interface DecisionTraceStep {
  step: string;
  ruleId: string;
  input: string;
  output: string;
}

export interface AggregatedExpertVerdict {
  verdict: ExpertDecision;
  confidence: Confidence;
  policyId: string;
  policyVersion: string;
  /** Deduplicated (by code), sorted for order-independent determinism (Wave 1D.1 P2 fix). */
  appliedReasonCodes: string[];
  /** @deprecated kept for backward compatibility; identical to appliedReasonCodes. */
  reasonCodes: string[];
  /** Deduplicated by code -- Wave 1D.1 fix for the P2 finding left open in run 20260720T090000Z. */
  materialFindings: ExpertFinding[];
  informationalFindings: ExpertFinding[];
  specialistConfidenceSummary: SpecialistConfidenceSummaryEntry[];
  decisionTrace: DecisionTraceStep[];
  missingRequiredSpecialists: string[];
}

const CONFIDENCE_RANK: Readonly<Record<Confidence, number>> = { low: 0, medium: 1, high: 2 };
const CONFIDENCE_BY_RANK: readonly Confidence[] = ['low', 'medium', 'high'];
const MATERIAL_MATERIALITIES: ReadonlySet<ExpertFindingMateriality> = new Set(['verdict-blocking', 'review-required']);

function classifyMateriality(finding: ExpertFinding, policy: ExpertVerdictAggregationPolicy): ExpertFindingMateriality {
  if (finding.materiality) return finding.materiality;
  const mapped = policy.reasonCodeMappings[finding.code];
  if (mapped) return mapped;
  return finding.blocking ? policy.warningMaterialityRules.defaultMaterialityForBlockingFinding : policy.warningMaterialityRules.defaultMaterialityForWarningFinding;
}

// evidence-audit reports plain reason-code strings, not ExpertFinding objects; wrap them so they
// flow through the same materiality classification as every specialist finding (single code path,
// no separate "evidence completeness" special-casing downstream).
function evidenceBlockersAsFindings(evidenceAudit: Stage4EvidenceAuditResult): ExpertFinding[] {
  return evidenceAudit.blockers.map(code => ({
    code, message: `evidence-audit reported ${code}`, severity: 'error', blocking: true, evidenceIds: [], specialistId: 'evidence-audit',
  }));
}

// Wave 1D.1: multiple specialists (or a specialist plus evidence-audit) can independently raise
// the exact same reason code for the same underlying gap (e.g. damage-speed's own warning and
// evidence-audit's blocker both fire EXPERT_EVIDENCE_SPEED_INCOMPLETE). Left un-deduplicated, the
// same code appeared twice in materialFindings -- cosmetic to the verdict/confidence decision
// (which only checks presence, not count) but a real defect in the audit-trail output this
// function exists to make trustworthy. Dedupes by code, keeping the first finding's
// message/category/materiality but merging every specialistId that raised it so no signal is lost.
function dedupeFindingsByCode(findings: readonly ExpertFinding[]): ExpertFinding[] {
  const byCode = new Map<string, ExpertFinding>();
  for (const finding of findings) {
    const existing = byCode.get(finding.code);
    if (!existing) {
      byCode.set(finding.code, finding);
      continue;
    }
    const specialistIds = [...new Set([existing.specialistId, finding.specialistId].filter((id): id is string => Boolean(id)))];
    byCode.set(finding.code, { ...existing, specialistId: specialistIds.join(',') });
  }
  return [...byCode.values()];
}

/**
 * Wave 1D: Expert Verdict Aggregation Policy Correction.
 *
 * Replaces the prior inline aggregation (which only consulted `specialistResults.some(r =>
 * r.blockers.length > 0)`, so Critical Review -- which never produces blockers by design -- could
 * never influence the verdict). This function classifies every finding's materiality via the
 * policy, then applies verdict precedence: any verdict-blocking finding rejects the candidate
 * outright; any review-required finding (including a material Critical Review finding), a missing
 * required specialist, or a required specialist reporting confidence 'low' forces
 * expert-review-required; only a candidate with none of those, and every required specialist
 * reporting confidence >= medium, is expert-validated.
 *
 * Pure function: never mutates `specialistResults`/`evidenceAudit` (only spreads into new
 * objects), never touches Mongo/network, and is deterministic regardless of finding order
 * (materialFindings/informationalFindings are deduplicated by code and appliedReasonCodes is
 * sorted, so reordering the input specialist array cannot change the output).
 */
export function aggregateExpertVerdict(
  specialistResults: Stage4SpecialistResult[],
  evidenceAudit: Stage4EvidenceAuditResult,
  policy: ExpertVerdictAggregationPolicy = EXPERT_VERDICT_AGGREGATION_POLICY,
): AggregatedExpertVerdict {
  const requiredSpecialistIds: readonly string[] = policy.requiredSpecialists;
  const taggedFindings: ExpertFinding[] = [
    ...specialistResults.flatMap(result => result.findings.map(finding => ({ ...finding, specialistId: finding.specialistId ?? result.specialistId }))),
    ...evidenceBlockersAsFindings(evidenceAudit),
  ];
  const classified = taggedFindings.map(finding => ({ finding, materiality: classifyMateriality(finding, policy) }));
  const verdictBlocking = dedupeFindingsByCode(classified.filter(item => item.materiality === 'verdict-blocking').map(item => item.finding));
  const reviewRequired = dedupeFindingsByCode(classified.filter(item => item.materiality === 'review-required').map(item => item.finding));
  const informational = dedupeFindingsByCode(classified.filter(item => !MATERIAL_MATERIALITIES.has(item.materiality)).map(item => item.finding));
  const appliedReasonCodes = [...new Set(taggedFindings.map(finding => finding.code))].sort();

  const missingRequiredSpecialists = requiredSpecialistIds.filter(id => !specialistResults.some(result => result.specialistId === id));
  const requiredResults = specialistResults.filter(result => requiredSpecialistIds.includes(result.specialistId));
  const worstRequiredConfidenceRank = requiredResults.length > 0
    ? Math.min(...requiredResults.map(result => CONFIDENCE_RANK[result.confidence]))
    : CONFIDENCE_RANK.high;

  const materialSpecialistIds = new Set(classified.filter(item => MATERIAL_MATERIALITIES.has(item.materiality)).map(item => item.finding.specialistId));
  const specialistConfidenceSummary: SpecialistConfidenceSummaryEntry[] = specialistResults.map(result => ({
    specialistId: result.specialistId, confidence: result.confidence, material: materialSpecialistIds.has(result.specialistId),
  }));

  const decisionTrace: DecisionTraceStep[] = [
    { step: 'classify-findings', ruleId: 'materiality-classification', input: `${taggedFindings.length} findings from ${specialistResults.length} specialists + evidence-audit`, output: `${verdictBlocking.length} verdict-blocking, ${reviewRequired.length} review-required, ${informational.length} informational (deduplicated)` },
  ];

  if (verdictBlocking.length > 0) {
    decisionTrace.push({ step: 'verdict-precedence', ruleId: 'rejected-on-verdict-blocking', input: verdictBlocking.map(finding => finding.code).join(','), output: 'rejected' });
    return {
      verdict: 'rejected', confidence: 'low', materialFindings: verdictBlocking, informationalFindings: informational,
      appliedReasonCodes, reasonCodes: appliedReasonCodes, missingRequiredSpecialists, specialistConfidenceSummary, decisionTrace,
      policyId: policy.policyId, policyVersion: policy.policyVersion,
    };
  }
  decisionTrace.push({ step: 'verdict-precedence', ruleId: 'rejected-on-verdict-blocking', input: 'none', output: 'pass' });

  const hasMaterialReviewRequired = reviewRequired.length > 0;
  const requiredSpecialistConfidenceIsLow = worstRequiredConfidenceRank <= CONFIDENCE_RANK.low;
  decisionTrace.push({ step: 'required-specialists', ruleId: 'all-required-specialists-present', input: `${requiredSpecialistIds.length} required`, output: missingRequiredSpecialists.length === 0 ? 'all-present' : `missing:${missingRequiredSpecialists.join(',')}` });
  decisionTrace.push({ step: 'confidence-floor', ruleId: 'confidence-aggregation-floor-at-worst-required-specialist', input: `worst required specialist confidence rank=${worstRequiredConfidenceRank}`, output: CONFIDENCE_BY_RANK[worstRequiredConfidenceRank] });

  if (hasMaterialReviewRequired || missingRequiredSpecialists.length > 0 || requiredSpecialistConfidenceIsLow) {
    decisionTrace.push({ step: 'verdict-precedence', ruleId: 'review-required-on-material-finding-or-missing-specialist-or-low-confidence', input: hasMaterialReviewRequired ? reviewRequired.map(finding => finding.code).join(',') : requiredSpecialistConfidenceIsLow ? 'required-specialist-confidence-low' : 'missing-required-specialist', output: 'expert-review-required' });
    return {
      verdict: 'expert-review-required', confidence: 'low', materialFindings: reviewRequired, informationalFindings: informational,
      appliedReasonCodes, reasonCodes: appliedReasonCodes, missingRequiredSpecialists, specialistConfidenceSummary, decisionTrace,
      policyId: policy.policyId, policyVersion: policy.policyVersion,
    };
  }

  // No verdict-blocking or review-required finding, every required specialist present with
  // confidence >= medium: expert-validated. Aggregate confidence still floors at the worst
  // required specialist's own reported confidence, so a specialist honestly reporting 'medium'
  // for benign structural reasons (e.g. doubles-strategy/full-team/benchmark, which never report
  // 'high') is not silently rounded up -- individual specialist confidence stays auditable.
  decisionTrace.push({ step: 'verdict-precedence', ruleId: 'validated-when-no-material-finding-and-confidence-sufficient', input: 'none', output: 'expert-validated' });
  return {
    verdict: 'expert-validated', confidence: CONFIDENCE_BY_RANK[worstRequiredConfidenceRank],
    materialFindings: [], informationalFindings: informational, appliedReasonCodes, reasonCodes: appliedReasonCodes,
    missingRequiredSpecialists, specialistConfidenceSummary, decisionTrace, policyId: policy.policyId, policyVersion: policy.policyVersion,
  };
}
