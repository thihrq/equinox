import { createLeadBuildRequestContext } from './LeadBuildRequestContext';
import { deriveRecoveryCapabilityPlan } from './RecoveryCapabilityPlanner';
import { LeadBuildRecoverySearch } from './LeadBuildRecoverySearch';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testPipelineIntegration() {
  console.log('[Equinox Test] Testando a integração completa do pipeline adaptativo...');

  const ctx = createLeadBuildRequestContext('req-integration-01');
  const recoverySearch = new LeadBuildRecoverySearch();

  const plan = deriveRecoveryCapabilityPlan({
    strategyId: 'sun_offense',
    evaluatedFinalists: 20,
    acceptedFinalists: 0,
    rejectedFinalists: 20,
    legalCompleteFinalists: 20,
    defensivelyValidFinalists: 0,
    offensivelyValidFinalists: 20,
    setCoherentFinalists: 20,
    failuresByGate: { DefensiveQuality: 20 },
    failuresByReason: [
      { reasonCode: 'UNANSWERED_REPEATED_WEAKNESS', count: 20, attackType: 'Ice', finalistKeys: [] },
    ],
    failuresByAttackType: { Ice: 20 },
    dominantFailureReasons: ['UNANSWERED_REPEATED_WEAKNESS:Ice'],
  });

  const universe = [
    { species: 'Heatran', candidateId: 'heatran', types: ['Steel', 'Fire'] },
  ];

  recoverySearch.executeRecoverySearch(plan, universe, ctx.startedAtMs, ctx.timeBudget).then(result => {
    assert(result.executed === true, 'Recovery deve ser executado no contexto integrado');
    assert(result.acceptedStrategies === 1, 'Deve retornar 1 estratégia aceita após recovery');
    assert(result.stopReason === 'VALID_RECOVERY_CANDIDATES_FOUND', 'stopReason deve ser VALID_RECOVERY_CANDIDATES_FOUND');
    console.log('✅ LeadBuildPipeline integration testado com sucesso!');
  });
}

if (require.main === module) {
  testPipelineIntegration();
}
