import type {
  CompetitiveClassification,
  AcceptanceReasonCode,
  ComparatorClassification,
  AcceptanceScenarioVerdict,
  ActiveV2AcceptanceReport,
} from '../services/competitive-data/acceptance/ActiveV2AcceptanceTypes';

function validateContracts(): void {
  // Testando asserções básicas de tipo
  const classification: CompetitiveClassification = 'equivalent';
  const reasonCode: AcceptanceReasonCode = 'CRITICAL_COMPARATORS_EQUAL';

  const comparator: ComparatorClassification = {
    comparator: 'scoreDiff',
    diffStatus: 'equal',
    classification,
    reasonCode,
    explanation: 'Score equal',
    scoreDeltaAbsolute: 0,
    scoreDeltaPercent: 0,
  };

  const verdict: AcceptanceScenarioVerdict = {
    scenarioId: 'test-scenario',
    comparatorClassifications: [comparator],
    scenarioClassification: 'equivalent',
    automaticApproval: true,
    requiresHumanReview: false,
  };

  const report: ActiveV2AcceptanceReport = {
    policyVersion: 'active-v2-acceptance-v1',
    inputEvidenceDigest: 'sha256-mockeddigest',
    inputCommitSha: 'mockedcommit',
    inputActiveRunId: 'mockedrunid',
    baselineSourceDigest: 'sha256-mockedbaseline',
    activeV2DataDigest: 'sha256-mockedv2data',
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
      equivalent: 1,
    },
    scenarioVerdicts: [verdict],
    gateStatus: 'approved',
    automaticRolloutApproved: true,
    generatedAt: new Date().toISOString(),
  };

  if (report.policyVersion !== 'active-v2-acceptance-v1' || report.scenarioVerdicts[0].scenarioId !== 'test-scenario') {
    throw new Error('Contract validation failure');
  }

  console.log('[Equinox] Active V2 acceptance contract validation passed.');
}

validateContracts();
