import crypto from 'crypto';
import { Stage4EvidenceAuditResult, Stage4EvidenceInput } from './Stage4ExpertTypes';

function digest(value: unknown): string { return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`; }

export function auditExpertEvidence(input: Stage4EvidenceInput): Stage4EvidenceAuditResult {
  const blockers: string[] = [];
  const warnings: string[] = [...input.warnings];
  if (!input.packageDigest) blockers.push('EXPERT_EVIDENCE_PACKAGE_DIGEST_MISSING');
  if (!input.candidateDigest) blockers.push('EXPERT_EVIDENCE_CANDIDATE_DIGEST_MISMATCH');
  if (!input.generationEvidence) blockers.push('EXPERT_EVIDENCE_GENERATION_MISSING');
  if (!input.damageEvidence) blockers.push('EXPERT_EVIDENCE_DAMAGE_INCOMPLETE');
  if (!input.speedEvidence) blockers.push('EXPERT_EVIDENCE_SPEED_INCOMPLETE');
  if (input.scenarioEvidenceCount < 6) blockers.push('EXPERT_EVIDENCE_SCENARIOS_INSUFFICIENT');
  if (input.fullTeamEvidenceCount < 5) blockers.push('EXPERT_EVIDENCE_FULL_TEAM_INSUFFICIENT');
  if (!input.benchmarkEvidence) blockers.push('EXPERT_EVIDENCE_BENCHMARK_INCOMPLETE');
  if (input.specialistVersions.length === 0) blockers.push('EXPERT_EVIDENCE_SPECIALIST_VERSION_MISSING');
  if (input.policyVersions.length === 0) blockers.push('EXPERT_EVIDENCE_POLICY_VERSION_MISSING');
  if (input.assumptions.length === 0 || input.limitations.length === 0) blockers.push('EXPERT_EVIDENCE_CONTEXT_MISSING');
  if (input.unsupportedMechanics.length > 0) blockers.push('EXPERT_EVIDENCE_UNSUPPORTED_ESSENTIAL_MECHANIC');
  if (input.blockers.length > 0) blockers.push(...input.blockers);
  return { valid: blockers.length === 0, reasonCodes: blockers, blockers, warnings, evidenceDigest: digest(input) };
}
