import { projectActiveV2MongoOperationsCost } from '../services/competitive-data/rollout-governance/ActiveV2CostProjectionEngine';
import { ACTIVE_V2_SHADOW_MONGO_IO_PROFILE_V1 } from '../services/competitive-data/rollout-governance/ActiveV2CostProjectionPolicy';

async function runTests(): Promise<void> {
  const profile = ACTIVE_V2_SHADOW_MONGO_IO_PROFILE_V1;

  // --- Caso de Teste 1: perfil de I/O por requisicao usa o time padrao (3) ---
  const shadowResult = projectActiveV2MongoOperationsCost({
    windowStartedAt: '2026-07-01T00:00:00.000Z',
    windowEndedAt: '2026-07-08T00:00:00.000Z',
    evaluatedRequestCount: 1000,
    trafficBasis: { kind: 'shadow-full-traffic' },
    ioProfile: profile,
  });
  // 2 leituras de config + 3 leituras de set (time padrao) = 5 leituras/requisicao
  if (shadowResult.readsPerEvaluatedRequest !== 5) {
    throw new Error(`Test 1 failed: expected 5 reads/request, got ${shadowResult.readsPerEvaluatedRequest}`);
  }
  if (shadowResult.writesPerEvaluatedRequest !== 1) {
    throw new Error(`Test 1 failed: expected 1 write/request, got ${shadowResult.writesPerEvaluatedRequest}`);
  }
  if (shadowResult.estimatedFullEligibleTrafficForWindow !== 1000) {
    throw new Error('Test 1 failed: shadow-full-traffic deve usar o volume observado diretamente, sem reescalar');
  }

  // --- Caso de Teste 2: shadow-full-traffic -> projecao em 100% e' identica ao observado ---
  const fullProjection = shadowResult.projections.find(p => p.targetPercentage === 100);
  if (!fullProjection || fullProjection.projectedEvaluatedRequests !== 1000) {
    throw new Error('Test 2 failed: projecao em 100% deveria igualar o volume observado no shadow');
  }
  const fivePercentProjection = shadowResult.projections.find(p => p.targetPercentage === 5);
  if (!fivePercentProjection || fivePercentProjection.projectedEvaluatedRequests !== 50) {
    throw new Error(`Test 2 failed: esperado 50 requisicoes projetadas em 5%, obteve ${fivePercentProjection?.projectedEvaluatedRequests}`);
  }

  // --- Caso de Teste 3: base 'percentage' reescala o trafego total elegivel ---
  const percentageResult = projectActiveV2MongoOperationsCost({
    windowStartedAt: '2026-07-01T00:00:00.000Z',
    windowEndedAt: '2026-07-08T00:00:00.000Z',
    evaluatedRequestCount: 500,
    trafficBasis: { kind: 'percentage', currentPercentage: 10 },
    ioProfile: profile,
  });
  // 500 requisicoes observadas representam 10% do trafego elegivel -> total = 5000
  if (percentageResult.estimatedFullEligibleTrafficForWindow !== 5000) {
    throw new Error(`Test 3 failed: esperado trafego total elegivel de 5000, obteve ${percentageResult.estimatedFullEligibleTrafficForWindow}`);
  }
  const twentyFivePercentProjection = percentageResult.projections.find(p => p.targetPercentage === 25);
  if (!twentyFivePercentProjection || twentyFivePercentProjection.projectedEvaluatedRequests !== 1250) {
    throw new Error('Test 3 failed: esperado 1250 requisicoes projetadas em 25% (25% de 5000)');
  }

  // --- Caso de Teste 4: sem costRates, estimatedCost e custo por mil ficam null ---
  if (shadowResult.costRatesProvided) throw new Error('Test 4 failed: costRatesProvided deveria ser false sem costRates');
  if (shadowResult.costPerThousandRequests !== null) throw new Error('Test 4 failed: costPerThousandRequests deveria ser null sem costRates');
  if (shadowResult.projections.some(p => p.estimatedCost !== null)) {
    throw new Error('Test 4 failed: nenhuma projecao deveria ter estimatedCost sem costRates fornecido');
  }

  // --- Caso de Teste 5: com costRates explicito, custo e' calculado ---
  const withCostResult = projectActiveV2MongoOperationsCost({
    windowStartedAt: '2026-07-01T00:00:00.000Z',
    windowEndedAt: '2026-07-08T00:00:00.000Z',
    evaluatedRequestCount: 1000,
    trafficBasis: { kind: 'shadow-full-traffic' },
    ioProfile: profile,
    costRates: { costPerThousandReads: 0.5, costPerThousandWrites: 2, currency: 'USD' },
  });
  if (!withCostResult.costRatesProvided) throw new Error('Test 5 failed: costRatesProvided deveria ser true');
  // custo por mil requisicoes = (5000 leituras/1000)*0.5 + (1000 escritas/1000)*2 = 2.5 + 2 = 4.5
  if (!withCostResult.costPerThousandRequests || Math.abs(withCostResult.costPerThousandRequests.amount - 4.5) > 1e-9) {
    throw new Error(`Test 5 failed: esperado custo por mil requisicoes de 4.5, obteve ${withCostResult.costPerThousandRequests?.amount}`);
  }
  if (withCostResult.costPerThousandRequests.currency !== 'USD') throw new Error('Test 5 failed: moeda deveria ser USD');

  // --- Caso de Teste 6: suggestedTeamSize customizado sobrescreve o padrao do perfil ---
  const customTeamResult = projectActiveV2MongoOperationsCost({
    windowStartedAt: '2026-07-01T00:00:00.000Z',
    windowEndedAt: '2026-07-08T00:00:00.000Z',
    evaluatedRequestCount: 100,
    trafficBasis: { kind: 'shadow-full-traffic' },
    ioProfile: profile,
    suggestedTeamSize: 6,
  });
  // 2 leituras de config + 6 leituras de set = 8 leituras/requisicao
  if (customTeamResult.readsPerEvaluatedRequest !== 8) {
    throw new Error(`Test 6 failed: esperado 8 reads/request com time de 6, obteve ${customTeamResult.readsPerEvaluatedRequest}`);
  }

  // --- Caso de Teste 7: percentage com currentPercentage invalido lanca erro de dominio ---
  let threwInvalidPercentage = false;
  try {
    projectActiveV2MongoOperationsCost({
      windowStartedAt: '2026-07-01T00:00:00.000Z',
      windowEndedAt: '2026-07-08T00:00:00.000Z',
      evaluatedRequestCount: 100,
      trafficBasis: { kind: 'percentage', currentPercentage: 0 },
      ioProfile: profile,
    });
  } catch (error) {
    threwInvalidPercentage = true;
    if (!(error instanceof Error) || !error.message.startsWith('COST_PROJECTION_INVALID')) {
      throw new Error(`Test 7 failed: esperado erro COST_PROJECTION_INVALID, obteve: ${error}`);
    }
  }
  if (!threwInvalidPercentage) throw new Error('Test 7 failed: esperado erro para currentPercentage=0');

  console.log('[Equinox] Active V2 cost projection engine validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
