import { resolveActiveV2RuntimeDecision } from '../services/competitive-data/runtime-control/ActiveV2RuntimeDecisionResolver';
import { ACTIVE_V2_RUNTIME_CONTROL_DEFAULT_STATE } from '../services/competitive-data/runtime-control/ActiveV2RuntimeControlTypes';
import { ACTIVE_V2_CANARY_CONFIG_DEFAULT_STATE } from '../services/competitive-data/runtime-control/ActiveV2CanaryConfigTypes';
import type { ActiveV2RuntimeDecisionInput } from '../services/competitive-data/runtime-control/ActiveV2RuntimeDecisionResolver';

function baseInput(overrides: Partial<ActiveV2RuntimeDecisionInput> = {}): ActiveV2RuntimeDecisionInput {
  return {
    circuitBreaker: { ...ACTIVE_V2_RUNTIME_CONTROL_DEFAULT_STATE },
    staticForceBaseline: false,
    canaryConfig: { ...ACTIVE_V2_CANARY_CONFIG_DEFAULT_STATE, mode: 'full' },
    identifier: 'team-x',
    isAuthorizedInternalCanaryRequest: false,
    perRequestFallbackRequested: false,
    ...overrides,
  };
}

async function runTests(): Promise<void> {
  // --- Caso de Teste 1: circuit breaker em force-baseline vence tudo, mesmo com mode=full ---
  const decision1 = resolveActiveV2RuntimeDecision(baseInput({
    circuitBreaker: { ...ACTIVE_V2_RUNTIME_CONTROL_DEFAULT_STATE, mode: 'force-baseline' },
  }));
  if (decision1.servePath !== 'baseline' || decision1.reasonCode !== 'CIRCUIT_BREAKER_FORCE_BASELINE') {
    throw new Error('Test 1 failed: expected circuit breaker to take precedence over everything');
  }

  // --- Caso de Teste 2: FORCE_BASELINE estático vence o modo operacional ---
  const decision2 = resolveActiveV2RuntimeDecision(baseInput({ staticForceBaseline: true }));
  if (decision2.servePath !== 'baseline' || decision2.reasonCode !== 'STATIC_FORCE_BASELINE') {
    throw new Error('Test 2 failed: expected static FORCE_BASELINE to take precedence over canary mode');
  }

  // --- Caso de Teste 3: mode=off serve baseline ---
  const decision3 = resolveActiveV2RuntimeDecision(baseInput({ canaryConfig: { ...ACTIVE_V2_CANARY_CONFIG_DEFAULT_STATE, mode: 'off' } }));
  if (decision3.servePath !== 'baseline' || decision3.reasonCode !== 'MODE_OFF') throw new Error('Test 3 failed: expected mode=off to serve baseline');

  // --- Caso de Teste 4: mode=shadow serve baseline mas sinaliza avaliação paralela ---
  const decision4 = resolveActiveV2RuntimeDecision(baseInput({ canaryConfig: { ...ACTIVE_V2_CANARY_CONFIG_DEFAULT_STATE, mode: 'shadow' } }));
  if (decision4.servePath !== 'baseline' || !decision4.shadowParallelEvaluation) {
    throw new Error('Test 4 failed: expected mode=shadow to serve baseline with shadowParallelEvaluation=true');
  }

  // --- Caso de Teste 5: mode=internal sem autorização serve baseline ---
  const decision5 = resolveActiveV2RuntimeDecision(baseInput({
    canaryConfig: { ...ACTIVE_V2_CANARY_CONFIG_DEFAULT_STATE, mode: 'internal' },
    isAuthorizedInternalCanaryRequest: false,
  }));
  if (decision5.servePath !== 'baseline' || decision5.reasonCode !== 'MODE_INTERNAL_UNAUTHORIZED') {
    throw new Error('Test 5 failed: expected unauthorized internal request to serve baseline');
  }

  // --- Caso de Teste 6: mode=internal COM autorização serve active-v2 ---
  const decision6 = resolveActiveV2RuntimeDecision(baseInput({
    canaryConfig: { ...ACTIVE_V2_CANARY_CONFIG_DEFAULT_STATE, mode: 'internal' },
    isAuthorizedInternalCanaryRequest: true,
  }));
  if (decision6.servePath !== 'active-v2') throw new Error('Test 6 failed: expected authorized internal request to serve active-v2');

  // --- Caso de Teste 7: mode=full serve active-v2 ---
  const decision7 = resolveActiveV2RuntimeDecision(baseInput());
  if (decision7.servePath !== 'active-v2' || decision7.reasonCode !== 'MODE_FULL') throw new Error('Test 7 failed: expected mode=full to serve active-v2');

  // --- Caso de Teste 8: mode=percentage não selecionado serve baseline ---
  const decision8 = resolveActiveV2RuntimeDecision(baseInput({
    canaryConfig: { ...ACTIVE_V2_CANARY_CONFIG_DEFAULT_STATE, mode: 'percentage', percentage: 0, seed: 'x' },
  }));
  if (decision8.servePath !== 'baseline' || decision8.reasonCode !== 'CANARY_NOT_SELECTED') {
    throw new Error('Test 8 failed: expected 0% canary to never select');
  }

  // --- Caso de Teste 9: mode=percentage=100 sempre seleciona ---
  const decision9 = resolveActiveV2RuntimeDecision(baseInput({
    canaryConfig: { ...ACTIVE_V2_CANARY_CONFIG_DEFAULT_STATE, mode: 'percentage', percentage: 100, seed: 'x' },
  }));
  if (decision9.servePath !== 'active-v2' || decision9.reasonCode !== 'CANARY_SELECTED') {
    throw new Error('Test 9 failed: expected 100% canary to always select');
  }

  // --- Caso de Teste 10: fallback por requisição vence a seleção canária ---
  const decision10 = resolveActiveV2RuntimeDecision(baseInput({ perRequestFallbackRequested: true }));
  if (decision10.servePath !== 'baseline' || decision10.reasonCode !== 'PER_REQUEST_FALLBACK') {
    throw new Error('Test 10 failed: expected per-request fallback to override an otherwise-selected path');
  }

  // --- Caso de Teste 11: percentage mal configurado (null) serve baseline em vez de lançar ---
  const decision11 = resolveActiveV2RuntimeDecision(baseInput({
    canaryConfig: { ...ACTIVE_V2_CANARY_CONFIG_DEFAULT_STATE, mode: 'percentage', percentage: null },
  }));
  if (decision11.servePath !== 'baseline' || decision11.reasonCode !== 'MODE_PERCENTAGE_MISCONFIGURED') {
    throw new Error('Test 11 failed: expected misconfigured percentage mode to fail safe to baseline');
  }

  console.log('[Equinox] Active V2 runtime decision resolver validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
