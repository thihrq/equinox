import { ExpertFindingMateriality } from './CompetitiveDoublesExpertTypes';
import { Stage4SpecialistId } from './Stage4SpecialistContracts';

export const EXPERT_VERDICT_AGGREGATION_POLICY_ID = 'expert-verdict-aggregation-policy';
export const EXPERT_VERDICT_AGGREGATION_POLICY_VERSION = 'expert-verdict-aggregation-v1';

export interface ExpertVerdictAggregationPolicy {
  policyId: string;
  policyVersion: string;
  /** Specialists that must produce a result for a candidate to be eligible for expert-validated. */
  requiredSpecialists: readonly Stage4SpecialistId[];
  /**
   * Documented for audit-trail purposes only -- deliberately NOT consumed anywhere in the
   * aggregation math. A weighted/summed score must never be able to outrank a verdict-blocking
   * finding (mission requirement 6: "score nunca supere blocker"), so this policy has no score
   * step at all; weights exist only so downstream reporting can explain relative specialist
   * importance without implying they trade off against blockers.
   */
  specialistWeights: Readonly<Record<Stage4SpecialistId, number>>;
  blockerRules: {
    /** Reason codes that always force `rejected`, regardless of every other specialist's output. */
    rejectionReasonCodes: readonly string[];
  };
  warningMaterialityRules: {
    /** Fallback for a finding with `blocking: true` and no explicit `materiality`/table entry. */
    defaultMaterialityForBlockingFinding: ExpertFindingMateriality;
    /** Fallback for a finding with `blocking: false` and no explicit `materiality`/table entry. */
    defaultMaterialityForWarningFinding: ExpertFindingMateriality;
  };
  confidenceAggregationRules: {
    rule: 'floor-at-worst-required-specialist-with-material-finding';
    description: string;
  };
  criticalReviewRules: {
    /** Categories that, when found on a critical-review finding, are treated as material. */
    materialCategories: readonly string[];
    capsConfidenceAt: 'low';
  };
  verdictPrecedence: readonly ['rejected', 'expert-review-required', 'expert-validated'];
  /** Single source of truth mapping every known reason code to its materiality. */
  reasonCodeMappings: Readonly<Record<string, ExpertFindingMateriality>>;
  unsupportedMechanicRules: { materiality: ExpertFindingMateriality };
  evidenceCompletenessRules: { materiality: ExpertFindingMateriality };
}

const REQUIRED_SPECIALISTS: readonly Stage4SpecialistId[] = [
  'deterministic-legality', 'damage-speed', 'set-coherence', 'role-archetype', 'doubles-strategy',
  'full-team', 'competitive-benchmark', 'critical-review', 'format-rules', 'export-integrity',
];

export const EXPERT_VERDICT_AGGREGATION_POLICY: ExpertVerdictAggregationPolicy = {
  policyId: EXPERT_VERDICT_AGGREGATION_POLICY_ID,
  policyVersion: EXPERT_VERDICT_AGGREGATION_POLICY_VERSION,
  requiredSpecialists: REQUIRED_SPECIALISTS,
  specialistWeights: {
    'deterministic-legality': 1, 'damage-speed': 1, 'set-coherence': 1, 'role-archetype': 1,
    'doubles-strategy': 1, 'full-team': 1, 'competitive-benchmark': 1, 'critical-review': 1,
    'format-rules': 1, 'export-integrity': 1, 'evidence-audit': 1,
  },
  blockerRules: {
    rejectionReasonCodes: [
      'EXPERT_ILLEGAL_SET', 'EXPERT_GENERATION_UNRESOLVED', 'EXPERT_FORM_UNRESOLVED', 'EXPERT_CANDIDATE_DIGEST_MISMATCH',
      'EXPERT_SET_INCOHERENT', 'EXPERT_ROLE_UNSUPPORTED', 'EXPERT_TEAM_ILLEGAL',
      'EXPERT_FORMAT_RULE_CONTEXT_INCOMPLETE', 'EXPERT_EXPORT_CANDIDATE_ID_MISSING',
      'EXPERT_EVIDENCE_PACKAGE_DIGEST_MISSING', 'EXPERT_EVIDENCE_CANDIDATE_DIGEST_MISMATCH',
    ],
  },
  warningMaterialityRules: {
    defaultMaterialityForBlockingFinding: 'review-required',
    defaultMaterialityForWarningFinding: 'informational',
  },
  confidenceAggregationRules: {
    rule: 'floor-at-worst-required-specialist-with-material-finding',
    description: 'Aggregate confidence starts at the specialist-reported confidence of every required specialist. If any required specialist has a review-required-or-worse materiality finding, aggregate confidence is capped at low and the verdict becomes expert-review-required (or rejected, if the finding is verdict-blocking). Specialists whose only findings are confidence-degrading/informational cannot force review-required, but their reported confidence still floors the aggregate (a specialist honestly reporting medium/low confidence for benign structural reasons still prevents the aggregate from claiming high) -- this is what makes individual specialist confidence auditable rather than silently discarded.',
  },
  criticalReviewRules: {
    // Categories that CAN carry a review-required critical-review finding (not all findings in
    // these categories are material -- e.g. 'strategic-risk' also covers the confidence-degrading
    // partial-adverse-scenarios finding; actual materiality always comes from reasonCodeMappings,
    // this list is a coarser audit-trail summary, kept in sync by assertPolicyConsistency below).
    materialCategories: ['strategic-risk', 'partner-dependency', 'candidate-dominated', 'full-team', 'unsupported-mechanic', 'evidence'],
    capsConfidenceAt: 'low',
  },
  verdictPrecedence: ['rejected', 'expert-review-required', 'expert-validated'],
  reasonCodeMappings: {
    // Legality / integrity -- always rejected, never overridden by score or other specialists.
    EXPERT_ILLEGAL_SET: 'verdict-blocking',
    EXPERT_GENERATION_UNRESOLVED: 'verdict-blocking',
    EXPERT_FORM_UNRESOLVED: 'verdict-blocking',
    EXPERT_CANDIDATE_DIGEST_MISMATCH: 'verdict-blocking',
    EXPERT_SET_INCOHERENT: 'verdict-blocking',
    EXPERT_ROLE_UNSUPPORTED: 'verdict-blocking',
    EXPERT_TEAM_ILLEGAL: 'verdict-blocking',
    EXPERT_FORMAT_RULE_CONTEXT_INCOMPLETE: 'verdict-blocking',
    EXPERT_EXPORT_CANDIDATE_ID_MISSING: 'verdict-blocking',
    EXPERT_EVIDENCE_PACKAGE_DIGEST_MISSING: 'verdict-blocking',
    EXPERT_EVIDENCE_CANDIDATE_DIGEST_MISMATCH: 'verdict-blocking',

    // Evidence completeness -- material but not an integrity/legality violation.
    EXPERT_EVIDENCE_DAMAGE_INCOMPLETE: 'review-required',
    EXPERT_EVIDENCE_SPEED_INCOMPLETE: 'review-required',
    EXPERT_EVIDENCE_SCENARIOS_INSUFFICIENT: 'review-required',
    EXPERT_EVIDENCE_FULL_TEAM_INSUFFICIENT: 'review-required',
    EXPERT_EVIDENCE_BENCHMARK_INCOMPLETE: 'review-required',
    EXPERT_EVIDENCE_GENERATION_MISSING: 'review-required',
    EXPERT_EVIDENCE_SPECIALIST_VERSION_MISSING: 'review-required',
    EXPERT_EVIDENCE_POLICY_VERSION_MISSING: 'review-required',
    EXPERT_EVIDENCE_CONTEXT_MISSING: 'review-required',

    // Unsupported mechanics -- material by definition (see unsupportedMechanicRules below).
    EXPERT_UNSUPPORTED_ESSENTIAL_MECHANIC: 'review-required',
    EXPERT_EVIDENCE_UNSUPPORTED_ESSENTIAL_MECHANIC: 'review-required',
    EXPERT_CRITICAL_UNSUPPORTED_MECHANIC: 'review-required',

    // Doubles-strategy / scenario signals.
    EXPERT_ADVERSE_SCENARIOS_PRESENT: 'confidence-degrading',

    // Critical Review structured findings (Wave 1D).
    EXPERT_CRITICAL_ALL_SCENARIOS_ADVERSE: 'review-required',
    EXPERT_CRITICAL_ADVERSE_SCENARIOS_PRESENT: 'confidence-degrading',
    EXPERT_CRITICAL_FULL_TEAM_GAP: 'review-required',
    EXPERT_CRITICAL_CANDIDATE_DOMINATED: 'review-required',
    EXPERT_CRITICAL_EXCESSIVE_PARTNER_DEPENDENCY: 'review-required',
    EXPERT_CRITICAL_NO_WIN_CONDITION: 'review-required',
    EXPERT_CRITICAL_FULL_TEAM_RISK_MATERIAL: 'review-required',
    EXPERT_CRITICAL_COVERAGE_INSUFFICIENT: 'review-required',
    EXPERT_CRITICAL_CONTRADICTORY_EVIDENCE: 'review-required',

    // Legacy code kept for backward compatibility with any artifact that still references it.
    EXPERT_CRITICAL_ADVERSE_SCENARIOS: 'review-required',
  },
  unsupportedMechanicRules: { materiality: 'review-required' },
  evidenceCompletenessRules: { materiality: 'review-required' },
};

// Evidence-integrity codes (digest tampering) are deliberately verdict-blocking, not plain
// evidence-completeness gaps -- excluded from the evidenceCompletenessRules consistency check below.
const EVIDENCE_INTEGRITY_EXCEPTIONS = new Set(['EXPERT_EVIDENCE_PACKAGE_DIGEST_MISSING', 'EXPERT_EVIDENCE_CANDIDATE_DIGEST_MISMATCH']);

/**
 * Guards against the exact class of drift a peer review of this policy found: structured sub-rule
 * fields (`blockerRules`, `unsupportedMechanicRules`, `evidenceCompletenessRules`) that exist for
 * documentation/audit purposes but silently disagree with the single source of truth
 * (`reasonCodeMappings`) that the aggregator actually reads. Throws on any mismatch, and is called
 * once at module load below, so a future edit to one table without the other fails immediately
 * (at import time, in every offline check and every real run) rather than producing a
 * quietly-wrong verdict.
 */
export function assertPolicyConsistency(policy: ExpertVerdictAggregationPolicy): void {
  const verdictBlockingCodes = new Set(Object.entries(policy.reasonCodeMappings).filter(([, materiality]) => materiality === 'verdict-blocking').map(([code]) => code));
  const declaredRejectionCodes = new Set(policy.blockerRules.rejectionReasonCodes);
  for (const code of declaredRejectionCodes) if (!verdictBlockingCodes.has(code)) throw new Error(`EXPERT_VERDICT_AGGREGATION_POLICY_INCONSISTENT: blockerRules.rejectionReasonCodes lists ${code}, but reasonCodeMappings does not classify it as verdict-blocking`);
  for (const code of verdictBlockingCodes) if (!declaredRejectionCodes.has(code)) throw new Error(`EXPERT_VERDICT_AGGREGATION_POLICY_INCONSISTENT: reasonCodeMappings classifies ${code} as verdict-blocking, but blockerRules.rejectionReasonCodes does not list it`);

  for (const [code, materiality] of Object.entries(policy.reasonCodeMappings)) {
    if (code.includes('UNSUPPORTED_MECHANIC') || code.includes('UNSUPPORTED_ESSENTIAL_MECHANIC')) {
      if (materiality !== policy.unsupportedMechanicRules.materiality) throw new Error(`EXPERT_VERDICT_AGGREGATION_POLICY_INCONSISTENT: ${code} is ${materiality}, but unsupportedMechanicRules.materiality is ${policy.unsupportedMechanicRules.materiality}`);
    } else if (code.startsWith('EXPERT_EVIDENCE_') && !EVIDENCE_INTEGRITY_EXCEPTIONS.has(code)) {
      if (materiality !== policy.evidenceCompletenessRules.materiality) throw new Error(`EXPERT_VERDICT_AGGREGATION_POLICY_INCONSISTENT: ${code} is ${materiality}, but evidenceCompletenessRules.materiality is ${policy.evidenceCompletenessRules.materiality}`);
    }
  }
}

assertPolicyConsistency(EXPERT_VERDICT_AGGREGATION_POLICY);
