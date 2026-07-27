import { resolvePrimaryFinalistPolicy } from './PrimaryFinalistPolicy';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

export function testPrimaryFinalistPolicyUnit() {
  const renderFree = resolvePrimaryFinalistPolicy('render_free');

  assert(renderFree.initialFinalistsPerStrategy === 2, 'render_free deve ter 2 finalistas iniciais.');
  assert(renderFree.maximumFinalistsPerStrategy === 4, 'render_free deve ter no máximo 4 finalistas por estratégia.');
  assert(renderFree.maximumFinalistsPerRequest === 8, 'render_free deve ter no máximo 8 finalistas por requisição.');
  assert(renderFree.beamWidth === 24, 'render_free deve usar beamWidth de 24.');

  const standard = resolvePrimaryFinalistPolicy('standard');
  assert(standard.maximumFinalistsPerRequest === 16, 'standard deve ter no máximo 16 finalistas por requisição.');

  console.log('✅ PrimaryFinalistPolicy unit test passou.');
}

if (require.main === module) {
  testPrimaryFinalistPolicyUnit();
}
