import { aggregateActiveV2RuntimeMetrics } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeMetricsAggregator';
import type { ActiveV2RuntimeTelemetryEvent } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeTelemetryTypes';

function makeEvent(overrides: Partial<ActiveV2RuntimeTelemetryEvent> = {}): ActiveV2RuntimeTelemetryEvent {
  return {
    eventId: 'evt',
    occurredAt: '2026-07-15T12:00:00.000Z',
    requestId: 'req',
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

async function runTests(): Promise<void> {
  // --- Caso de Teste 1: janela vazia produz snapshot zerado ---
  const emptySnapshot = aggregateActiveV2RuntimeMetrics([], '2026-07-15T00:00:00.000Z', '2026-07-15T00:00:00.000Z');
  if (emptySnapshot.requestCount !== 0) throw new Error('Test 1 failed: expected requestCount 0 for empty window');
  if (emptySnapshot.baseline.latency.p95 !== 0) throw new Error('Test 1 failed: expected p95 0 for empty latencies');

  // --- Caso de Teste 2: contagens de sucesso/erro/timeout ---
  const events = [
    makeEvent({ eventId: '1', v2: { outcome: 'success', latencyMs: 100, fallbackTriggered: false, fallbackReason: null } }),
    makeEvent({ eventId: '2', v2: { outcome: 'error', latencyMs: 100, fallbackTriggered: false, fallbackReason: null }, baseline: { outcome: 'error', latencyMs: 100 } }),
    makeEvent({ eventId: '3', v2: { outcome: 'timeout', latencyMs: null, fallbackTriggered: true, fallbackReason: 'v2-timeout' } }),
  ];
  const snapshot2 = aggregateActiveV2RuntimeMetrics(events, '2026-07-15T00:00:00.000Z', '2026-07-15T00:01:00.000Z');
  if (snapshot2.requestCount !== 3) throw new Error('Test 2 failed: expected requestCount 3');
  if (snapshot2.v2.successCount !== 1 || snapshot2.v2.errorCount !== 1 || snapshot2.v2.timeoutCount !== 1) {
    throw new Error('Test 2 failed: expected 1 success, 1 error, 1 timeout on v2');
  }
  if (snapshot2.baseline.successCount !== 2 || snapshot2.baseline.errorCount !== 1) {
    throw new Error('Test 2 failed: expected 2 baseline successes and 1 error');
  }
  if (snapshot2.fallback.count !== 1 || snapshot2.fallback.reasonCounts['v2-timeout'] !== 1) {
    throw new Error('Test 2 failed: expected 1 fallback with reason v2-timeout');
  }

  // --- Caso de Teste 3: percentis de latência (nearest-rank) ---
  const latencyEvents = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((ms, i) =>
    makeEvent({ eventId: `lat-${i}`, baseline: { outcome: 'success', latencyMs: ms }, v2: { outcome: 'success', latencyMs: ms, fallbackTriggered: false, fallbackReason: null } })
  );
  const snapshot3 = aggregateActiveV2RuntimeMetrics(latencyEvents, '2026-07-15T00:00:00.000Z', '2026-07-15T00:01:00.000Z');
  if (snapshot3.baseline.latency.p50 !== 50) throw new Error(`Test 3 failed: expected p50=50, got ${snapshot3.baseline.latency.p50}`);
  if (snapshot3.baseline.latency.p95 !== 100) throw new Error(`Test 3 failed: expected p95=100, got ${snapshot3.baseline.latency.p95}`);

  // --- Caso de Teste 4: classificationCounts e digests/publishRunIds observados ---
  const classificationEvents = [
    makeEvent({ eventId: 'c1', comparison: { classification: 'blocker', scoreDelta: -20 }, publishRunId: 'run-a', activeV2DataDigest: 'sha256-a' }),
    makeEvent({ eventId: 'c2', comparison: { classification: 'blocker', scoreDelta: -20 }, publishRunId: 'run-a', activeV2DataDigest: 'sha256-a' }),
    makeEvent({ eventId: 'c3', comparison: { classification: 'improvement', scoreDelta: 10 }, publishRunId: 'run-b', activeV2DataDigest: 'sha256-b' }),
  ];
  const snapshot4 = aggregateActiveV2RuntimeMetrics(classificationEvents, '2026-07-15T00:00:00.000Z', '2026-07-15T00:01:00.000Z');
  if (snapshot4.classificationCounts.blocker !== 2) throw new Error('Test 4 failed: expected 2 blocker classifications');
  if (snapshot4.classificationCounts.improvement !== 1) throw new Error('Test 4 failed: expected 1 improvement classification');
  if (snapshot4.observedPublishRunIds.join(',') !== 'run-a,run-b') throw new Error('Test 4 failed: expected sorted distinct publishRunIds run-a,run-b');
  if (snapshot4.observedActiveV2DataDigests.join(',') !== 'sha256-a,sha256-b') throw new Error('Test 4 failed: expected sorted distinct digests');

  // --- Caso de Teste 5: segmentação por format/teamIdentity/archetype ---
  const segmentEvents = [
    makeEvent({ eventId: 's1', format: 'champions_reg_m_b_doubles', teamIdentity: 'offensive', archetype: 'weather-rain' }),
    makeEvent({ eventId: 's2', format: 'champions_reg_m_b_doubles', teamIdentity: 'offensive', archetype: 'weather-rain' }),
    makeEvent({ eventId: 's3', format: 'radical_red', teamIdentity: 'defensive', archetype: 'trick-room' }),
  ];
  const snapshot5 = aggregateActiveV2RuntimeMetrics(segmentEvents, '2026-07-15T00:00:00.000Z', '2026-07-15T00:01:00.000Z');
  if (snapshot5.segments.format['champions_reg_m_b_doubles'] !== 2) throw new Error('Test 5 failed: expected format segment count 2');
  if (snapshot5.segments.teamIdentity['defensive'] !== 1) throw new Error('Test 5 failed: expected teamIdentity segment count 1');
  if (snapshot5.segments.archetype['weather-rain'] !== 2) throw new Error('Test 5 failed: expected archetype segment count 2');

  console.log('[Equinox] Active V2 runtime metrics aggregator validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
