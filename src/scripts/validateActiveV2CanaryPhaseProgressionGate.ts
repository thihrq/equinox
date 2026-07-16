import { evaluateActiveV2CanaryPhaseProgression } from '../services/competitive-data/rollout-governance/ActiveV2CanaryPhaseProgressionGate';
import { aggregateActiveV2RuntimeMetrics } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeMetricsAggregator';
import type { ActiveV2RuntimeAlert, ActiveV2RuntimeTelemetryEvent } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeTelemetryTypes';

function makeEvent(overrides: Partial<ActiveV2RuntimeTelemetryEvent> = {}, index = 0): ActiveV2RuntimeTelemetryEvent {
  return {
    eventId: `evt-${index}`,
    occurredAt: '2026-07-15T12:00:00.000Z',
    requestId: `req-${index}`,
    format: 'champions_reg_m_b_doubles',
    teamIdentity: 'balanced',
    archetype: 'balanced-offense',
    publishRunId: 'publish-run-1',
    activeV2DataDigest: 'sha256-abc',
    baseline: { outcome: 'success', latencyMs: 100 },
    v2: { outcome: 'success', latencyMs: 110, fallbackTriggered: false, fallbackReason: null },
    comparison: { classification: 'equivalent', scoreDelta: 0 },
    ...overrides,
  };
}

function repeatSuccessEvents(count: number): ActiveV2RuntimeTelemetryEvent[] {
  const events: ActiveV2RuntimeTelemetryEvent[] = [];
  for (let i = 0; i < count; i++) events.push(makeEvent({}, i));
  return events;
}

const NO_ALERTS: ActiveV2RuntimeAlert[] = [];
const ONE_CRITICAL_ALERT: ActiveV2RuntimeAlert[] = [
  {
    code: 'V2_ERROR_RATE',
    severity: 'critical',
    message: 'taxa de erro alta',
    observedValue: 40,
    thresholdValue: 5,
    firedAt: '2026-07-15T12:00:00.000Z',
  },
];

async function runTests(): Promise<void> {
  const now = new Date('2026-07-15T00:00:00.000Z');

  // --- Caso de Teste 1: criterios atingidos, sem breaker/alerta -> advance ---
  const advanceMetrics = aggregateActiveV2RuntimeMetrics(repeatSuccessEvents(1200), 'start', 'end');
  const advanceResult = evaluateActiveV2CanaryPhaseProgression({
    currentPhase: { mode: 'internal', percentage: null },
    phaseWindowStartedAt: '2026-07-10T00:00:00.000Z', // 5 dias atras, criterio internal = 3 dias
    metrics: advanceMetrics,
    alerts: NO_ALERTS,
    circuitBreakerMode: 'normal',
    now,
  });
  if (advanceResult.decision !== 'advance') throw new Error(`Test 1 failed: expected advance, got ${advanceResult.decision}`);
  if (advanceResult.nextPhase?.mode !== 'percentage' || advanceResult.nextPhase?.percentage !== 5) {
    throw new Error('Test 1 failed: expected nextPhase percentage:5');
  }

  // --- Caso de Teste 2: dias insuficientes -> hold ---
  const holdDaysResult = evaluateActiveV2CanaryPhaseProgression({
    currentPhase: { mode: 'internal', percentage: null },
    phaseWindowStartedAt: '2026-07-14T00:00:00.000Z', // 1 dia atras, criterio = 3 dias
    metrics: advanceMetrics,
    alerts: NO_ALERTS,
    circuitBreakerMode: 'normal',
    now,
  });
  if (holdDaysResult.decision !== 'hold') throw new Error(`Test 2 failed: expected hold, got ${holdDaysResult.decision}`);
  if (holdDaysResult.daysCriterionMet) throw new Error('Test 2 failed: expected daysCriterionMet=false');
  if (holdDaysResult.nextPhase !== null) throw new Error('Test 2 failed: expected nextPhase=null on hold');

  // --- Caso de Teste 3: volume insuficiente -> hold ---
  const lowVolumeMetrics = aggregateActiveV2RuntimeMetrics(repeatSuccessEvents(10), 'start', 'end');
  const holdVolumeResult = evaluateActiveV2CanaryPhaseProgression({
    currentPhase: { mode: 'internal', percentage: null },
    phaseWindowStartedAt: '2026-07-10T00:00:00.000Z',
    metrics: lowVolumeMetrics,
    alerts: NO_ALERTS,
    circuitBreakerMode: 'normal',
    now,
  });
  if (holdVolumeResult.decision !== 'hold') throw new Error(`Test 3 failed: expected hold, got ${holdVolumeResult.decision}`);
  if (holdVolumeResult.volumeCriterionMet) throw new Error('Test 3 failed: expected volumeCriterionMet=false');

  // --- Caso de Teste 4: circuit breaker disparado sobrepoe criterios atingidos -> rollback ---
  const breakerResult = evaluateActiveV2CanaryPhaseProgression({
    currentPhase: { mode: 'internal', percentage: null },
    phaseWindowStartedAt: '2026-07-10T00:00:00.000Z',
    metrics: advanceMetrics,
    alerts: NO_ALERTS,
    circuitBreakerMode: 'force-baseline',
    now,
  });
  if (breakerResult.decision !== 'rollback') throw new Error(`Test 4 failed: expected rollback, got ${breakerResult.decision}`);
  if (!breakerResult.circuitBreakerTripped) throw new Error('Test 4 failed: expected circuitBreakerTripped=true');

  // --- Caso de Teste 5: alerta critico sobrepoe criterios atingidos -> rollback ---
  const alertResult = evaluateActiveV2CanaryPhaseProgression({
    currentPhase: { mode: 'internal', percentage: null },
    phaseWindowStartedAt: '2026-07-10T00:00:00.000Z',
    metrics: advanceMetrics,
    alerts: ONE_CRITICAL_ALERT,
    circuitBreakerMode: 'normal',
    now,
  });
  if (alertResult.decision !== 'rollback') throw new Error(`Test 5 failed: expected rollback, got ${alertResult.decision}`);
  if (alertResult.criticalAlertCodes.join(',') !== 'V2_ERROR_RATE') {
    throw new Error('Test 5 failed: expected criticalAlertCodes to include V2_ERROR_RATE');
  }

  // --- Caso de Teste 6: hold que ultrapassa o teto de 21 dias sinaliza holdExpired ---
  const expiredHoldResult = evaluateActiveV2CanaryPhaseProgression({
    currentPhase: { mode: 'internal', percentage: null },
    phaseWindowStartedAt: '2026-06-01T00:00:00.000Z', // 44 dias atras, ainda sem volume suficiente
    metrics: lowVolumeMetrics,
    alerts: NO_ALERTS,
    circuitBreakerMode: 'normal',
    now,
  });
  if (expiredHoldResult.decision !== 'hold') throw new Error(`Test 6 failed: expected hold, got ${expiredHoldResult.decision}`);
  if (!expiredHoldResult.holdExpired) throw new Error('Test 6 failed: expected holdExpired=true past the 21-day ceiling');

  // --- Caso de Teste 7: fase sem janela de observacao (off) lanca erro de dominio ---
  let threw = false;
  try {
    evaluateActiveV2CanaryPhaseProgression({
      currentPhase: { mode: 'off', percentage: null },
      phaseWindowStartedAt: '2026-07-10T00:00:00.000Z',
      metrics: advanceMetrics,
      alerts: NO_ALERTS,
      circuitBreakerMode: 'normal',
      now,
    });
  } catch (error) {
    threw = true;
    if (!(error instanceof Error) || !error.message.startsWith('PHASE_NOT_OBSERVABLE')) {
      throw new Error(`Test 7 failed: expected PHASE_NOT_OBSERVABLE error, got: ${error}`);
    }
  }
  if (!threw) throw new Error('Test 7 failed: expected evaluateActiveV2CanaryPhaseProgression to throw for mode=off');

  console.log('[Equinox] Active V2 canary phase progression gate validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
