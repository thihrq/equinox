import { evaluateActiveV2RuntimeAlerts } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeAlertEvaluator';
import { ACTIVE_V2_RUNTIME_OBSERVABILITY_POLICY_V1 } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeObservabilityPolicy';
import { aggregateActiveV2RuntimeMetrics } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeMetricsAggregator';
import type {
  ActiveV2RuntimeManifestHealthSnapshot,
  ActiveV2RuntimeTelemetryEvent,
} from '../services/competitive-data/runtime-observability/ActiveV2RuntimeTelemetryTypes';

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

function healthyManifest(): ActiveV2RuntimeManifestHealthSnapshot {
  return {
    activeSetCount: 4,
    activeSetIdsWithMultipleActiveVersions: [],
    activeManifest: { publishRunId: 'run-1', status: 'active', activeV2DataDigest: 'sha256-abc', recordedRecordCount: 4 },
    manifestRecordCountMatchesActiveSetCount: true,
    recomputedActiveV2DataDigest: 'sha256-abc',
    digestMatchesManifest: true,
  };
}

function repeatEvents(count: number, mutate: (event: ActiveV2RuntimeTelemetryEvent, i: number) => void): ActiveV2RuntimeTelemetryEvent[] {
  const events: ActiveV2RuntimeTelemetryEvent[] = [];
  for (let i = 0; i < count; i++) {
    const event = makeEvent({}, i);
    mutate(event, i);
    events.push(event);
  }
  return events;
}

async function runTests(): Promise<void> {
  const policy = ACTIVE_V2_RUNTIME_OBSERVABILITY_POLICY_V1;

  // --- Caso de Teste 1: janela saudável de alto volume não dispara nenhum alerta ---
  const healthyEvents = repeatEvents(30, () => {});
  const healthySnapshot = aggregateActiveV2RuntimeMetrics(healthyEvents, 'start', 'end');
  const healthyAlerts = evaluateActiveV2RuntimeAlerts(healthySnapshot, healthyManifest(), policy);
  if (healthyAlerts.length !== 0) throw new Error(`Test 1 failed: expected no alerts, got ${healthyAlerts.map(a => a.code).join(',')}`);

  // --- Caso de Teste 2: taxa de erro acima do limite dispara V2_ERROR_RATE ---
  const errorEvents = repeatEvents(30, (event, i) => {
    if (i < 5) event.v2.outcome = 'error';
  });
  const errorSnapshot = aggregateActiveV2RuntimeMetrics(errorEvents, 'start', 'end');
  const errorAlerts = evaluateActiveV2RuntimeAlerts(errorSnapshot, null, policy);
  if (!errorAlerts.some(a => a.code === 'V2_ERROR_RATE')) throw new Error('Test 2 failed: expected V2_ERROR_RATE to fire');

  // --- Caso de Teste 3: volume abaixo do mínimo suprime alertas de taxa mesmo com proporção alta ---
  const lowVolumeErrorEvents = repeatEvents(5, (event, i) => {
    if (i < 5) event.v2.outcome = 'error';
  });
  const lowVolumeSnapshot = aggregateActiveV2RuntimeMetrics(lowVolumeErrorEvents, 'start', 'end');
  const lowVolumeAlerts = evaluateActiveV2RuntimeAlerts(lowVolumeSnapshot, null, policy);
  if (lowVolumeAlerts.some(a => a.code === 'V2_ERROR_RATE')) {
    throw new Error('Test 3 failed: expected V2_ERROR_RATE to be suppressed below minRequestsForRateAlerts');
  }

  // --- Caso de Teste 4: taxa de timeout acima do limite dispara V2_TIMEOUT_RATE ---
  const timeoutEvents = repeatEvents(30, (event, i) => {
    if (i < 5) { event.v2.outcome = 'timeout'; event.v2.latencyMs = null; }
  });
  const timeoutSnapshot = aggregateActiveV2RuntimeMetrics(timeoutEvents, 'start', 'end');
  const timeoutAlerts = evaluateActiveV2RuntimeAlerts(timeoutSnapshot, null, policy);
  if (!timeoutAlerts.some(a => a.code === 'V2_TIMEOUT_RATE')) throw new Error('Test 4 failed: expected V2_TIMEOUT_RATE to fire');

  // --- Caso de Teste 5: taxa de fallback acima do limite dispara FALLBACK_RATE ---
  const fallbackEvents = repeatEvents(30, (event, i) => {
    if (i < 6) { event.v2.fallbackTriggered = true; event.v2.fallbackReason = 'v2-error'; }
  });
  const fallbackSnapshot = aggregateActiveV2RuntimeMetrics(fallbackEvents, 'start', 'end');
  const fallbackAlerts = evaluateActiveV2RuntimeAlerts(fallbackSnapshot, null, policy);
  if (!fallbackAlerts.some(a => a.code === 'FALLBACK_RATE')) throw new Error('Test 5 failed: expected FALLBACK_RATE to fire');

  // --- Caso de Teste 6: blocker dispara independente do volume ---
  const blockerEvents = [makeEvent({ comparison: { classification: 'blocker', scoreDelta: -20 } })];
  const blockerSnapshot = aggregateActiveV2RuntimeMetrics(blockerEvents, 'start', 'end');
  const blockerAlerts = evaluateActiveV2RuntimeAlerts(blockerSnapshot, null, policy);
  if (!blockerAlerts.some(a => a.code === 'BLOCKER_CLASSIFICATION_PRESENT' && a.severity === 'critical')) {
    throw new Error('Test 6 failed: expected BLOCKER_CLASSIFICATION_PRESENT critical alert');
  }

  // --- Caso de Teste 7: degradação de p95 acima do limite dispara P95_LATENCY_DEGRADATION ---
  const degradationEvents = repeatEvents(30, (event) => {
    event.baseline.latencyMs = 100;
    event.v2.latencyMs = 250;
  });
  const degradationSnapshot = aggregateActiveV2RuntimeMetrics(degradationEvents, 'start', 'end');
  const degradationAlerts = evaluateActiveV2RuntimeAlerts(degradationSnapshot, null, policy);
  if (!degradationAlerts.some(a => a.code === 'P95_LATENCY_DEGRADATION')) throw new Error('Test 7 failed: expected P95_LATENCY_DEGRADATION to fire');

  // --- Caso de Teste 8: manifesto zero sets ativos dispara ZERO_ACTIVE_SETS ---
  const zeroManifest: ActiveV2RuntimeManifestHealthSnapshot = { ...healthyManifest(), activeSetCount: 0, activeManifest: null };
  const zeroAlerts = evaluateActiveV2RuntimeAlerts(healthySnapshot, zeroManifest, policy);
  if (!zeroAlerts.some(a => a.code === 'ZERO_ACTIVE_SETS')) throw new Error('Test 8 failed: expected ZERO_ACTIVE_SETS to fire');

  // --- Caso de Teste 9: múltiplas versões ativas dispara MULTIPLE_ACTIVE_VERSIONS ---
  const multiManifest: ActiveV2RuntimeManifestHealthSnapshot = { ...healthyManifest(), activeSetIdsWithMultipleActiveVersions: ['set-a'] };
  const multiAlerts = evaluateActiveV2RuntimeAlerts(healthySnapshot, multiManifest, policy);
  if (!multiAlerts.some(a => a.code === 'MULTIPLE_ACTIVE_VERSIONS')) throw new Error('Test 9 failed: expected MULTIPLE_ACTIVE_VERSIONS to fire');

  // --- Caso de Teste 10: inconsistência de manifesto dispara MANIFEST_INCONSISTENCY ---
  const inconsistentManifest: ActiveV2RuntimeManifestHealthSnapshot = { ...healthyManifest(), manifestRecordCountMatchesActiveSetCount: false };
  const inconsistentAlerts = evaluateActiveV2RuntimeAlerts(healthySnapshot, inconsistentManifest, policy);
  if (!inconsistentAlerts.some(a => a.code === 'MANIFEST_INCONSISTENCY')) throw new Error('Test 10 failed: expected MANIFEST_INCONSISTENCY to fire');

  // --- Caso de Teste 11: divergência de digest dispara DIGEST_MISMATCH ---
  const digestMismatchManifest: ActiveV2RuntimeManifestHealthSnapshot = { ...healthyManifest(), digestMatchesManifest: false };
  const digestAlerts = evaluateActiveV2RuntimeAlerts(healthySnapshot, digestMismatchManifest, policy);
  if (!digestAlerts.some(a => a.code === 'DIGEST_MISMATCH')) throw new Error('Test 11 failed: expected DIGEST_MISMATCH to fire');

  console.log('[Equinox] Active V2 runtime alert evaluator validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
