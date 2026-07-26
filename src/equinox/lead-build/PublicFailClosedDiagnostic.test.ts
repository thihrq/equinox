import { projectPublicFailClosedMetadata } from './PublicFailClosedDiagnostic';
import { RejectionReasonAggregate } from './FinalistRejectionAggregator';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testPublicFailClosedDiagnostic() {
  console.log('[Equinox Test] Testando a projeção pública de diagnósticos de fail-closed...');

  const internalReasons: RejectionReasonAggregate[] = [
    {
      reasonCode: 'UNANSWERED_REPEATED_WEAKNESS',
      count: 14,
      attackType: 'Ice',
      finalistKeys: [],
    },
  ];

  const metadata = projectPublicFailClosedMetadata(internalReasons, true, true, true);

  assert(metadata.failClosed === true, 'failClosed deve ser true');
  assert(metadata.recoveryAttempted === true, 'recoveryAttempted deve ser true');
  assert(metadata.reasons.length === 1, 'Deve conter 1 motivo público');
  assert(metadata.reasons[0].code === 'UNANSWERED_TYPE_WEAKNESS', 'Razão interna deve mapear para UNANSWERED_TYPE_WEAKNESS');
  assert(metadata.reasons[0].attackType === 'Ice', 'attackType deve ser Ice');

  console.log('✅ PublicFailClosedDiagnostic testado com sucesso!');
}

if (require.main === module) {
  testPublicFailClosedDiagnostic();
}
