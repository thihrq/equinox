import { deriveRecoveryCapabilityPlan } from './RecoveryCapabilityPlanner';
import { FinalistRejectionAggregate } from './FinalistRejectionAggregator';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testRecoveryCapabilityPlanner() {
  console.log('[Equinox Test] Testando o planejador de capacidades de recuperação...');

  // 1. Snapshot Charizard + Whimsicott (todos falharam por Gelo, elegível para recovery)
  const agg1: FinalistRejectionAggregate = {
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
  };

  const plan1 = deriveRecoveryCapabilityPlan(agg1);

  assert(plan1.eligible === true, 'Caso com falha por Gelo deve ser elegível para recovery');
  assert(plan1.requests.some(r => r.capability === 'TYPE_RESISTANCE' && r.attackType === 'Ice'), 'Deve solicitar TYPE_RESISTANCE contra Ice');
  assert(plan1.requests.some(r => r.capability === 'SAFE_SWITCH_IN' && r.attackType === 'Ice'), 'Deve solicitar SAFE_SWITCH_IN contra Ice');
  assert(plan1.maximumPasses <= 2, 'maximumPasses deve ser <= 2');

  // 2. Busca primária teve sucesso -> NÃO elegível para recovery
  const agg2: FinalistRejectionAggregate = {
    ...agg1,
    acceptedFinalists: 1,
  };
  const plan2 = deriveRecoveryCapabilityPlan(agg2);
  assert(plan2.eligible === false, 'Estratégia aceita na busca primária deve tornar recovery elegível = false');
  assert(plan2.ineligibilityReasons.includes('PRIMARY_SEARCH_SUCCEEDED'), 'Deve conter razão PRIMARY_SEARCH_SUCCEEDED');

  // 3. Lead ilegal -> NÃO elegível para recovery
  const plan3 = deriveRecoveryCapabilityPlan(agg1, { hasIllegalLead: true });
  assert(plan3.eligible === false, 'Lead ilegal deve tornar recovery elegível = false');
  assert(plan3.ineligibilityReasons.includes('ILLEGAL_LEAD'), 'Deve conter razão ILLEGAL_LEAD');

  console.log('✅ RecoveryCapabilityPlanner testado com sucesso!');
}

if (require.main === module) {
  testRecoveryCapabilityPlanner();
}
