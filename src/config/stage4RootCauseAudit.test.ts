import { classifyStage4ReasonCode } from '../services/competitive-data/expert/Stage4RootCauseAudit';

const expectations: Array<[string, string]> = [
  ['EXPERT_EVIDENCE_DAMAGE_INCOMPLETE', 'engine-coverage-gap'],
  ['EXPERT_EVIDENCE_SPEED_INCOMPLETE', 'engine-coverage-gap'],
  ['EXPERT_EVIDENCE_BENCHMARK_INCOMPLETE', 'meta-dependent'],
  ['EXPERT_CRITICAL_ADVERSE_SCENARIOS', 'battle-test-dependent'],
  ['EXPERT_SET_INCOHERENT', 'data-quality-problem'],
  ['EXPERT_CANDIDATE_DIGEST_MISMATCH', 'implementation-defect'],
];

for (const [reasonCode, expected] of expectations) {
  if (classifyStage4ReasonCode(reasonCode) !== expected) throw new Error(`STAGE4_REASON_CLASSIFICATION_FAILED:${reasonCode}`);
}

console.log('stage4 root cause audit tests passed');
