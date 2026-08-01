import { createFinalistDecisionTrace } from './FinalistDecisionTrace';
import { toStructuredGateReason } from './StrategyQualityDiagnostics';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testFinalistDecisionTrace() {
  console.log('[Equinox Test] Testando decomposição e rastreamento das decisões dos finalistas...');

  // 1. Time rejeitado por exposição defensiva a Gelo
  const trace1 = createFinalistDecisionTrace('sun_offense', 'charizard-whimsicott-greattusk-sandyshocks-venusaur-shiftry', [
    { gate: 'Legality', valid: true, reasons: [] },
    { gate: 'StrategyCompleteness', valid: true, reasons: [] },
    { gate: 'DefensiveQuality', valid: false, reasons: [toStructuredGateReason('UNANSWERED_REPEATED_WEAKNESS:Ice')] },
    { gate: 'SetCoherence', valid: true, reasons: [] },
  ]);

  assert(trace1.valid === false, 'Time com falha defensiva deve ser valid = false');
  assert(trace1.failedGates.includes('DefensiveQuality'), 'failedGates deve incluir DefensiveQuality');
  assert(trace1.primaryReason === 'UNANSWERED_REPEATED_WEAKNESS:Ice', 'primaryReason deve ser UNANSWERED_REPEATED_WEAKNESS:Ice');

  // 2. Time totalmente aprovado
  const trace2 = createFinalistDecisionTrace('sun_offense', 'charizard-whimsicott-aggron-venusaur-lilligant-shiftry', [
    { gate: 'Legality', valid: true, reasons: [] },
    { gate: 'StrategyCompleteness', valid: true, reasons: [] },
    { gate: 'DefensiveQuality', valid: true, reasons: [] },
    { gate: 'SetCoherence', valid: true, reasons: [] },
  ]);

  assert(trace2.valid === true, 'Time aprovado deve ter valid = true');
  assert(trace2.failedGates.length === 0, 'failedGates deve ser vazio');
  assert(trace2.primaryReason === 'APPROVED', 'primaryReason deve ser APPROVED');

  console.log('✅ FinalistDecisionTrace testado com sucesso!');
}

if (require.main === module) {
  testFinalistDecisionTrace();
}
