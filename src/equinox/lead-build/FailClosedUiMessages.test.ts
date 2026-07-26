import { getFailClosedUiMessages } from './FailClosedUiMessages';
import { PublicNoStrategyDiagnostic } from './PublicFailClosedDiagnostic';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testFailClosedUiMessages() {
  console.log('[Equinox Test] Testando mensagens e i18n da interface de fail-closed...');

  const diagnostics: PublicNoStrategyDiagnostic[] = [
    { code: 'UNANSWERED_TYPE_WEAKNESS', count: 14, attackType: 'Ice' },
  ];

  const pt = getFailClosedUiMessages(diagnostics, 'pt-BR');
  assert(pt.title.includes('Nenhuma composição'), 'Título em PT-BR deve conter Nenhuma composição');
  assert(pt.reasons[0].includes('Gelo'), 'Motivo em PT-BR deve conter Gelo');

  const en = getFailClosedUiMessages(diagnostics, 'en-US');
  assert(en.title.includes('No competitively safe'), 'Título em EN-US deve conter No competitively safe');
  assert(en.reasons[0].includes('Ice'), 'Motivo em EN-US deve conter Ice');

  console.log('✅ FailClosedUiMessages testado com sucesso!');
}

if (require.main === module) {
  testFailClosedUiMessages();
}
