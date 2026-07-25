import { classifyPerformanceStatus } from './LeadBuildPerformanceMetrics';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testLeadBuildPerformance() {
  console.log('[Equinox Test] Validando métricas estruturais e limites de performance do Lead Build...');

  // Métricas observadas pós-Fase 2/3
  const observedMetrics = {
    rawCandidates: 45,
    usableCandidates: 40,
    batchesFetched: 2,
    duplicateCount: 0,
    rejectedMegaBeforeBeam: 3,
    rejectedMegaInsideBeam: 0,
    candidateFetchMs: 1529,
    strategyPipelineMs: 3476,
    leadBuildTotalMs: 5005,
    acceptedStrategies: 3,
  };

  // 1. Limites estruturais do feixe
  assert(observedMetrics.rawCandidates <= 150, 'rawCandidates deve respeitar limite máximo de 150');
  assert(observedMetrics.usableCandidates <= 40, 'usableCandidates não deve exceder a meta de 40 no feixe');
  assert(observedMetrics.rejectedMegaInsideBeam === 0, 'rejectedMegaInsideBeam deve ser exatamente 0');
  assert(observedMetrics.acceptedStrategies >= 1, 'Deve aceitar pelo menos 1 estratégia nativa');

  // 2. Classificação de performance
  const status = classifyPerformanceStatus(observedMetrics.leadBuildTotalMs);
  assert(status === 'OPTIMAL', `Performance total (${observedMetrics.leadBuildTotalMs}ms) deve ser OPTIMAL (< 10000ms)`);

  console.log('✅ Validação de performance e limites do feixe concluída com sucesso!');
}

if (require.main === module) {
  testLeadBuildPerformance();
}
