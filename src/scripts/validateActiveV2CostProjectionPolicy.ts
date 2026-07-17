import {
  ACTIVE_V2_SHADOW_MONGO_IO_PROFILE_V1,
  ACTIVE_V2_COST_PROJECTION_TARGET_PERCENTAGES,
} from '../services/competitive-data/rollout-governance/ActiveV2CostProjectionPolicy';

async function runTests(): Promise<void> {
  // --- Caso de Teste 1: perfil de I/O do shadow reflete o codigo real do orquestrador ---
  const profile = ACTIVE_V2_SHADOW_MONGO_IO_PROFILE_V1;
  if (profile.configReadsPerEvaluatedRequest !== 2) {
    throw new Error(`Test 1 failed: esperado 2 leituras de config (canary config + circuit breaker), obteve ${profile.configReadsPerEvaluatedRequest}`);
  }
  if (profile.setReadsPerSuggestedPokemon !== 1) {
    throw new Error(`Test 1 failed: esperado 1 leitura de set por Pokemon sugerido, obteve ${profile.setReadsPerSuggestedPokemon}`);
  }
  if (profile.telemetryWritesPerEvaluatedRequest !== 1) {
    throw new Error(`Test 1 failed: esperado 1 escrita de telemetria por requisicao avaliada, obteve ${profile.telemetryWritesPerEvaluatedRequest}`);
  }
  if (profile.defaultSuggestedTeamSize !== 3) {
    throw new Error(`Test 1 failed: esperado tamanho de time padrao 3, obteve ${profile.defaultSuggestedTeamSize}`);
  }

  // --- Caso de Teste 2: percentuais-alvo cobrem exatamente as Fases 6-10 ---
  const expected = [5, 10, 25, 50, 100];
  if (ACTIVE_V2_COST_PROJECTION_TARGET_PERCENTAGES.length !== expected.length) {
    throw new Error(`Test 2 failed: esperado ${expected.length} percentuais-alvo, obteve ${ACTIVE_V2_COST_PROJECTION_TARGET_PERCENTAGES.length}`);
  }
  for (let i = 0; i < expected.length; i++) {
    if (ACTIVE_V2_COST_PROJECTION_TARGET_PERCENTAGES[i] !== expected[i]) {
      throw new Error(`Test 2 failed: percentual-alvo[${i}] esperado ${expected[i]}, obteve ${ACTIVE_V2_COST_PROJECTION_TARGET_PERCENTAGES[i]}`);
    }
  }

  console.log('[Equinox] Active V2 cost projection policy validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
