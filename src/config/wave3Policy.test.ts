import { FULL_ROSTER_EXPANSION_POLICY, assertFullRosterExpansionPolicyConsistency } from '../services/competitive-data/expert/wave3/FullRosterExpansionPolicy';

function expectThrows(label: string, fn: () => void, messageIncludes: string): void {
  let threw = false;
  try { fn(); } catch (error) { threw = error instanceof Error && error.message.includes(messageIncludes); }
  if (!threw) throw new Error(`WAVE3_POLICY_GUARD_NOT_CAUGHT:${label}`);
}

// Case: unbounded retry policy must be rejected (mission section 12: "Falhar imediatamente quando... retry policy for ilimitada").
expectThrows('unbounded-retry', () => assertFullRosterExpansionPolicyConsistency({ ...FULL_ROSTER_EXPANSION_POLICY, failurePolicy: { ...FULL_ROSTER_EXPANSION_POLICY.failurePolicy, maxRetryAttempts: 999999 } }), 'maxRetryAttempts');

// Case: package inclusion policy contradicting itself (a verdict both included and excluded).
expectThrows('inclusion-contradiction', () => assertFullRosterExpansionPolicyConsistency({ ...FULL_ROSTER_EXPANSION_POLICY, packageInclusionPolicy: { includedVerdicts: ['expert-validated', 'rejected'], excludedVerdicts: ['expert-review-required', 'rejected', 'generation-rejected', 'blocked', 'failed'] } }), 'both included and excluded');

// Case: package inclusion policy allowing something other than exactly expert-validated (mission section 30/55 hard rule).
expectThrows('inclusion-not-validated-only', () => assertFullRosterExpansionPolicyConsistency({ ...FULL_ROSTER_EXPANSION_POLICY, packageInclusionPolicy: { includedVerdicts: ['expert-validated', 'expert-review-required'], excludedVerdicts: ['rejected', 'generation-rejected', 'blocked', 'failed'] } }), 'must include exactly expert-validated');

// Case: resume reason code declared without a mapping (documentation/consumption drift).
expectThrows('unmapped-resume-reason-code', () => assertFullRosterExpansionPolicyConsistency({ ...FULL_ROSTER_EXPANSION_POLICY, resumePolicy: { ...FULL_ROSTER_EXPANSION_POLICY.resumePolicy, reasonCodes: [...FULL_ROSTER_EXPANSION_POLICY.resumePolicy.reasonCodes, 'RESUME_UNMAPPED_CODE'] } }), 'no entry in reasonCodeMappings');

// Case: a policy field declared but never actually consumed by evidence/specialist requirements (drift between the two required-specialist lists).
expectThrows('specialist-list-drift', () => assertFullRosterExpansionPolicyConsistency({ ...FULL_ROSTER_EXPANSION_POLICY, specialistRequirements: { ...FULL_ROSTER_EXPANSION_POLICY.specialistRequirements, requiredSpecialistIds: ['deterministic-legality'] } }), 'must agree on the required specialist set');

// Case: the real, unmodified policy must load without throwing.
assertFullRosterExpansionPolicyConsistency(FULL_ROSTER_EXPANSION_POLICY);

console.log('wave3 policy consistency tests passed');
