import { evaluateCircuitBreakerTrip } from '../services/competitive-data/runtime-control/ActiveV2CircuitBreakerEvaluator';
import type { ActiveV2RuntimeAlert } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeTelemetryTypes';

function makeAlert(overrides: Partial<ActiveV2RuntimeAlert>): ActiveV2RuntimeAlert {
  return {
    code: 'V2_ERROR_RATE',
    severity: 'warning',
    message: 'test',
    observedValue: 0,
    thresholdValue: 0,
    firedAt: new Date().toISOString(),
    ...overrides,
  };
}

async function runTests(): Promise<void> {
  // --- Caso de Teste 1: sem alertas -> não dispara ---
  const decision1 = evaluateCircuitBreakerTrip([]);
  if (decision1.shouldTrip) throw new Error('Test 1 failed: expected no trip with no alerts');

  // --- Caso de Teste 2: apenas alertas de severidade warning -> não dispara ---
  const decision2 = evaluateCircuitBreakerTrip([makeAlert({ severity: 'warning' })]);
  if (decision2.shouldTrip) throw new Error('Test 2 failed: expected no trip with only warning alerts');

  // --- Caso de Teste 3: um alerta crítico -> dispara com reasonCode derivado ---
  const decision3 = evaluateCircuitBreakerTrip([makeAlert({ code: 'ZERO_ACTIVE_SETS', severity: 'critical' })]);
  if (!decision3.shouldTrip) throw new Error('Test 3 failed: expected trip on critical alert');
  if (decision3.reasonCode !== 'AUTOMATIC_ZERO_ACTIVE_SETS') {
    throw new Error(`Test 3 failed: expected reasonCode AUTOMATIC_ZERO_ACTIVE_SETS, got ${decision3.reasonCode}`);
  }

  // --- Caso de Teste 4: múltiplos alertas críticos -> o primeiro na ordem vira o motivo registrado ---
  const decision4 = evaluateCircuitBreakerTrip([
    makeAlert({ code: 'DIGEST_MISMATCH', severity: 'critical' }),
    makeAlert({ code: 'ZERO_ACTIVE_SETS', severity: 'critical' }),
  ]);
  if (decision4.reasonCode !== 'AUTOMATIC_DIGEST_MISMATCH') {
    throw new Error(`Test 4 failed: expected first critical alert to win, got ${decision4.reasonCode}`);
  }

  // --- Caso de Teste 5: mistura de warning e critical -> dispara pelo crítico ---
  const decision5 = evaluateCircuitBreakerTrip([
    makeAlert({ code: 'FALLBACK_RATE', severity: 'warning' }),
    makeAlert({ code: 'V2_TIMEOUT_RATE', severity: 'critical' }),
  ]);
  if (!decision5.shouldTrip || decision5.reasonCode !== 'AUTOMATIC_V2_TIMEOUT_RATE') {
    throw new Error('Test 5 failed: expected trip driven by the critical alert, ignoring the warning');
  }

  console.log('[Equinox] Active V2 circuit breaker evaluator validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
