import { aggregateFinalistRejections } from './FinalistRejectionAggregator';
import { FinalistDecisionTrace } from './FinalistDecisionTrace';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testFinalistRejectionAggregator() {
  console.log('[Equinox Test] Testando a agregação de falhas dos finalistas...');

  const traces: FinalistDecisionTrace[] = [
    {
      strategyId: 'sun_offense',
      teamKey: 'team1',
      valid: false,
      failedGates: ['DefensiveQuality'],
      primaryReason: 'UNANSWERED_REPEATED_WEAKNESS:Ice',
      gates: [
        { gate: 'Legality', valid: true, reasons: [] },
        { gate: 'StrategyCompleteness', valid: true, reasons: [] },
        { gate: 'DefensiveQuality', valid: false, reasons: ['UNANSWERED_REPEATED_WEAKNESS:Ice'] },
      ],
    },
    {
      strategyId: 'sun_offense',
      teamKey: 'team2',
      valid: false,
      failedGates: ['DefensiveQuality'],
      primaryReason: 'UNANSWERED_REPEATED_WEAKNESS:Ice',
      gates: [
        { gate: 'Legality', valid: true, reasons: [] },
        { gate: 'StrategyCompleteness', valid: true, reasons: [] },
        { gate: 'DefensiveQuality', valid: false, reasons: ['UNANSWERED_REPEATED_WEAKNESS:Ice'] },
      ],
    },
  ];

  const aggregate = aggregateFinalistRejections('sun_offense', traces);

  assert(aggregate.evaluatedFinalists === 2, 'evaluatedFinalists deve ser 2');
  assert(aggregate.acceptedFinalists === 0, 'acceptedFinalists deve ser 0');
  assert(aggregate.rejectedFinalists === 2, 'rejectedFinalists deve ser 2');
  assert(aggregate.legalCompleteFinalists === 2, 'legalCompleteFinalists deve ser 2');

  assert(aggregate.failuresByGate['DefensiveQuality'] === 2, 'DefensiveQuality failures deve ser 2');
  assert(aggregate.failuresByAttackType['Ice'] === 2, 'Ice attack type failures deve ser 2');
  assert(aggregate.dominantFailureReasons.includes('UNANSWERED_REPEATED_WEAKNESS:Ice'), 'dominantFailureReasons deve conter UNANSWERED_REPEATED_WEAKNESS:Ice');

  console.log('✅ FinalistRejectionAggregator testado com sucesso!');
}

if (require.main === module) {
  testFinalistRejectionAggregator();
}
