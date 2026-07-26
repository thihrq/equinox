import { LeadBuildRecoverySearch } from './LeadBuildRecoverySearch';
import { RecoveryCapabilityPlan } from './RecoveryCapabilityPlanner';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testLeadBuildRecoverySearch() {
  console.log('[Equinox Test] Testando a busca adaptativa por recuperação...');

  const recoverySearch = new LeadBuildRecoverySearch();

  const plan: RecoveryCapabilityPlan = {
    strategyId: 'sun_offense',
    eligible: true,
    eligibilityReasons: ['PRIMARY_SEARCH_EXHAUSTED_QUALITY_GATES'],
    ineligibilityReasons: [],
    requests: [
      {
        capability: 'TYPE_RESISTANCE',
        attackType: 'Ice',
        priority: 'CRITICAL',
        minimumDistinctAnswers: 1,
        desiredDistinctAnswers: 2,
        appliesTo: 'BOTH',
        evidenceReasonCodes: ['UNANSWERED_REPEATED_WEAKNESS'],
      },
    ],
    maximumPasses: 2,
    maximumAdditionalRawCandidates: 60,
    maximumAdditionalUsableCandidates: 16,
    sourceLimitations: [],
  };

  const universe = [
    { species: 'Heatran', candidateId: 'heatran', types: ['Steel', 'Fire'] },
  ];

  const now = Date.now();

  recoverySearch.executeRecoverySearch(plan, universe, now).then(result => {
    assert(result.executed === true, 'A recuperação deve ser executada quando elegível');
    assert(result.recoveredCandidatesCount === 1, 'Deve recuperar 1 candidato');
    assert(result.stopReason === 'VALID_RECOVERY_CANDIDATES_FOUND', 'stopReason deve ser VALID_RECOVERY_CANDIDATES_FOUND');
    console.log('✅ LeadBuildRecoverySearch testado com sucesso!');
  });
}

if (require.main === module) {
  testLeadBuildRecoverySearch();
}
