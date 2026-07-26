import { createLeadBuildRequestContext } from './LeadBuildRequestContext';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testLeadBuildRequestContext() {
  console.log('[Equinox Test] Testando o contexto de execução por requisição...');

  const ctx = createLeadBuildRequestContext('req-123', 'gen9vgc2024', 'production');

  assert(ctx.requestId === 'req-123', 'requestId deve ser req-123');
  assert(ctx.evaluationCache !== undefined, 'evaluationCache deve estar inicializado');
  assert(ctx.timeBudget.totalBudgetMs === 10000, 'totalBudgetMs deve ser 10000');

  console.log('✅ LeadBuildRequestContext testado com sucesso!');
}

if (require.main === module) {
  testLeadBuildRequestContext();
}
