import { RequestScopedEvaluationCache } from './RequestScopedEvaluationCache';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testRequestScopedEvaluationCache() {
  console.log('[Equinox Test] Testando o cache de avaliação por requisição...');

  const cache = new RequestScopedEvaluationCache<number>(5);

  assert(cache.get('k1') === undefined, 'Miss inicial deve retornar undefined');

  cache.set('k1', 100);
  assert(cache.get('k1') === 100, 'Get pós-set deve retornar o valor armazenado');

  const metrics = cache.getMetrics();
  assert(metrics.hits === 1, 'Hits deve ser 1');
  assert(metrics.misses === 1, 'Misses deve ser 1');
  assert(metrics.writes === 1, 'Writes deve ser 1');

  console.log('✅ RequestScopedEvaluationCache testado com sucesso!');
}

if (require.main === module) {
  testRequestScopedEvaluationCache();
}
