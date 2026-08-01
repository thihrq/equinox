import { deriveRecoveryCapabilityPlan } from './RecoveryCapabilityPlanner';
import { FinalistRejectionAggregate } from './FinalistRejectionAggregator';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

export function testRecoveryCapabilityPrioritizerUnit() {
  const aggregate: FinalistRejectionAggregate = {
    strategyId: 'weather_sun',
    evaluatedFinalists: 3,
    acceptedFinalists: 0,
    rejectedFinalists: 3,
    legalCompleteFinalists: 3,
    defensivelyValidFinalists: 0,
    offensivelyValidFinalists: 3,
    setCoherentFinalists: 3,
    failuresByGate: { DefensiveQuality: 3 },
    failuresByReason: [
      {
        reasonCode: 'UNANSWERED_REPEATED_WEAKNESS',
        count: 3,
        attackType: 'Ice',
        finalistKeys: ['f1', 'f2', 'f3'],
      },
      {
        reasonCode: 'NO_DEFENSIVE_SWITCH_IN',
        count: 2,
        attackType: 'Ice',
        finalistKeys: ['f1', 'f2'],
      },
      {
        reasonCode: 'CRITICAL_SPREAD_EXPOSURE',
        count: 1,
        attackType: 'Flying',
        finalistKeys: ['f3'],
      },
    ],
    failuresByAttackType: { Ice: 5, Flying: 1 },
    dominantFailureReasons: ['UNANSWERED_REPEATED_WEAKNESS'],
  };

  const plan = deriveRecoveryCapabilityPlan(aggregate, { parityValid: true });

  assert(plan.eligible === true, 'Plano de recuperação deve ser elegível.');
  assert(plan.requests.length >= 2, 'Deve mapear ao menos 2 solicitações de recuperação.');
  assert(plan.requests.some(r => 'attackType' in r && r.attackType === 'Ice'), 'Solicitações devem priorizar a fraqueza Ice.');

  console.log('✅ RecoveryCapabilityPrioritizer unit test passou.');
}

if (require.main === module) {
  testRecoveryCapabilityPrioritizerUnit();
}
