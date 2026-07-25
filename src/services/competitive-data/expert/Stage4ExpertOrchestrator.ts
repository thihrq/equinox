import crypto from 'crypto';
import { auditExpertEvidence } from './Stage4EvidenceAudit';
import { assertPromotionGuard, classifyHumanReviewRequirement, deepFreezeCandidate, STAGE4_POLICY_VERSION } from './Stage4ExpertPolicy';
import { aggregateExpertVerdict } from './ExpertVerdictAggregator';
import { Stage4CandidateContext, Stage4CandidateValidationResult, Stage4EvidenceInput } from './Stage4ExpertTypes';
import { STAGE4_INDEPENDENT_SPECIALISTS } from './Stage4Specialists';
import { STAGE4_SPECIALIST_VERSIONS } from './Stage4SpecialistContracts';

function digest(value: unknown): string { return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`; }

function evidenceInput(context: Stage4CandidateContext, specialistVersions: string[]): Stage4EvidenceInput {
  return {
    packageDigest: context.packageDigest,
    mechanicsDigest: context.mechanicsDigest,
    rosterDigest: context.rosterDigest,
    candidateDigest: context.candidate.candidateDigest,
    generationEvidence: context.generationResolved,
    damageEvidence: context.damageEvidence,
    speedEvidence: context.speedEvidence,
    scenarioEvidenceCount: context.scenarioEvidenceCount,
    fullTeamEvidenceCount: context.fullTeamEvidenceCount,
    benchmarkEvidence: context.benchmarkEvidence,
    specialistVersions,
    policyVersions: [STAGE4_POLICY_VERSION],
    assumptions: ['source evidence is local and versioned'],
    limitations: ['no production meta or battle simulation is used'],
    unsupportedMechanics: context.unsupportedMechanics,
    blockers: [],
    warnings: [],
    confidence: 'medium',
  };
}

export function validateCandidateWithExperts(input: Stage4CandidateContext, validatedAt = '2026-07-20T00:00:00.000Z'): Stage4CandidateValidationResult {
  const candidate = deepFreezeCandidate(input.candidate);
  const context: Stage4CandidateContext = { ...input, candidate };
  const specialistResults = STAGE4_INDEPENDENT_SPECIALISTS.map(specialist => specialist(context));
  const specialistVersions: string[] = Object.values(STAGE4_SPECIALIST_VERSIONS);
  const evidenceAudit = auditExpertEvidence(evidenceInput(context, specialistVersions));
  // Wave 1D: verdict/confidence come from the policy-driven aggregator (ExpertVerdictAggregator),
  // not an inline blockers.length-only check -- this is what lets Critical Review (which never
  // produces a blocker by design) actually influence the outcome via finding materiality.
  const aggregated = aggregateExpertVerdict(specialistResults, evidenceAudit);
  const { verdict, confidence } = aggregated;
  const reasonCodes = [...new Set([...specialistResults.flatMap(result => result.reasonCodes), ...evidenceAudit.reasonCodes, ...aggregated.reasonCodes])];
  const humanReviewRequirement = classifyHumanReviewRequirement(verdict, confidence);
  const metadata = { verdict, validatedAt, policyVersion: STAGE4_POLICY_VERSION, evidenceDigest: evidenceAudit.evidenceDigest, confidence } as const;
  assertPromotionGuard(candidate, metadata);
  return {
    candidateId: candidate.candidateId, candidateDigest: candidate.candidateDigest, specialistResults, evidenceAudit, verdict, confidence, humanReviewRequirement, reasonCodes, expertValidation: metadata,
    aggregationPolicyId: aggregated.policyId, aggregationPolicyVersion: aggregated.policyVersion, materialFindings: aggregated.materialFindings,
    appliedReasonCodes: aggregated.appliedReasonCodes, informationalFindings: aggregated.informationalFindings,
    specialistConfidenceSummary: aggregated.specialistConfidenceSummary, decisionTrace: aggregated.decisionTrace,
  };
}

export function stage4VerdictDigest(result: Stage4CandidateValidationResult): string { return digest(result); }
