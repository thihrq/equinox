import { evaluateAcceptanceGates } from '../services/competitive-data/acceptance/ActiveV2AcceptanceGates';
import type { ActiveV2AcceptanceReport } from '../services/competitive-data/acceptance/ActiveV2AcceptanceTypes';

const baseReportMock: ActiveV2AcceptanceReport = {
  policyVersion: 'active-v2-acceptance-v1',
  inputEvidenceDigest: 'sha256-abc',
  inputCommitSha: 'commit-123',
  inputActiveRunId: 'run-123',
  baselineSourceDigest: 'sha256-abc',
  activeV2DataDigest: 'sha256-abc',
  activeV2RecordCount: 4,
  activeV2DataDigestAlgorithm: 'active-v2-canonical-sha256-v1',
  evidenceValid: true,
  globalBlockers: [],
  classificationCounts: {
    blocker: 0,
    regression: 0,
    'human-review-needed': 0,
    improvement: 0,
    'acceptable-divergence': 0,
    equivalent: 0,
  },
  scenarioVerdicts: [],
  gateStatus: 'approved',
  automaticRolloutApproved: false,
  generatedAt: new Date().toISOString(),
};

function runGateTests(): void {
  // Teste 1: Só equivalentes e melhorias -> approved
  const rep1 = evaluateAcceptanceGates({
    ...baseReportMock,
    classificationCounts: {
      ...baseReportMock.classificationCounts,
      equivalent: 3,
      improvement: 1,
    },
  });
  if (rep1.gateStatus !== 'approved' || rep1.automaticRolloutApproved !== true) {
    throw new Error(`Expected approved/true, got ${rep1.gateStatus}/${rep1.automaticRolloutApproved}`);
  }

  // Teste 2: Um regression presente -> rejected
  const rep2 = evaluateAcceptanceGates({
    ...baseReportMock,
    classificationCounts: {
      ...baseReportMock.classificationCounts,
      equivalent: 2,
      improvement: 1,
      regression: 1,
    },
  });
  if (rep2.gateStatus !== 'rejected' || rep2.automaticRolloutApproved !== false) {
    throw new Error(`Expected rejected/false, got ${rep2.gateStatus}/${rep2.automaticRolloutApproved}`);
  }

  // Teste 3: Um blocker presente -> rejected
  const rep3 = evaluateAcceptanceGates({
    ...baseReportMock,
    classificationCounts: {
      ...baseReportMock.classificationCounts,
      blocker: 1,
      equivalent: 3,
    },
  });
  if (rep3.gateStatus !== 'rejected' || rep3.automaticRolloutApproved !== false) {
    throw new Error('Expected gate to be rejected due to blocker');
  }

  // Teste 4: Um human-review-needed presente -> human-review-required
  const rep4 = evaluateAcceptanceGates({
    ...baseReportMock,
    classificationCounts: {
      ...baseReportMock.classificationCounts,
      equivalent: 3,
      'human-review-needed': 1,
    },
  });
  if (rep4.gateStatus !== 'human-review-required' || rep4.automaticRolloutApproved !== false) {
    throw new Error(`Expected human-review-required/false, got ${rep4.gateStatus}/${rep4.automaticRolloutApproved}`);
  }

  // Teste 5: blocker global na evidencia -> rejected
  const rep5 = evaluateAcceptanceGates({
    ...baseReportMock,
    globalBlockers: [{ classification: 'blocker', reasonCode: 'SHADOW_EVIDENCE_INVALID', explanation: 'Invalid' }],
  });
  if (rep5.gateStatus !== 'rejected' || rep5.automaticRolloutApproved !== false) {
    throw new Error('Expected gate to be rejected due to global blocker');
  }

  console.log('[Equinox] Active V2 acceptance gates validation passed.');
}

runGateTests();
