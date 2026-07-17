import type {
  ActiveV2RuntimeTelemetryEvent,
  ActiveV2RuntimeMetricsSnapshot,
  ActiveV2RuntimeLatencyPercentiles,
  ActiveV2RuntimeFallbackReason,
} from './ActiveV2RuntimeTelemetryTypes';
import type { CompetitiveClassification } from '../acceptance/ActiveV2AcceptanceTypes';

const FALLBACK_REASONS: ActiveV2RuntimeFallbackReason[] = [
  'v2-error',
  'v2-timeout',
  'v2-disabled',
  'circuit-breaker',
  'force-baseline',
  'digest-mismatch',
  'no-v2-data',
  'ambiguous-v2-data',
  'unknown',
];

const CLASSIFICATIONS: CompetitiveClassification[] = [
  'blocker',
  'regression',
  'human-review-needed',
  'improvement',
  'acceptable-divergence',
  'equivalent',
];

function emptyReasonCounts(): Record<ActiveV2RuntimeFallbackReason, number> {
  const counts = {} as Record<ActiveV2RuntimeFallbackReason, number>;
  for (const reason of FALLBACK_REASONS) counts[reason] = 0;
  return counts;
}

function emptyClassificationCounts(): Record<CompetitiveClassification, number> {
  const counts = {} as Record<CompetitiveClassification, number>;
  for (const classification of CLASSIFICATIONS) counts[classification] = 0;
  return counts;
}

function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  const rank = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  const clampedRank = Math.min(Math.max(rank, 0), sortedValues.length - 1);
  return sortedValues[clampedRank];
}

function calculateLatencyPercentiles(latencies: number[]): ActiveV2RuntimeLatencyPercentiles {
  const sorted = [...latencies].sort((a, b) => a - b);
  return {
    p50: calculatePercentile(sorted, 50),
    p95: calculatePercentile(sorted, 95),
    p99: calculatePercentile(sorted, 99),
  };
}

function incrementSegment(segment: Record<string, number>, key: string): void {
  segment[key] = (segment[key] ?? 0) + 1;
}

/**
 * Agrega uma janela de eventos de telemetria em um snapshot de métricas.
 * Função pura — não lê nem escreve nada; recebe os eventos já carregados
 * (do Mongo, de um fixture de teste, ou de um lote sintético de injeção).
 */
export function aggregateActiveV2RuntimeMetrics(
  events: readonly ActiveV2RuntimeTelemetryEvent[],
  windowStartedAt: string,
  windowEndedAt: string
): ActiveV2RuntimeMetricsSnapshot {
  const baselineLatencies: number[] = [];
  const v2Latencies: number[] = [];
  const reasonCounts = emptyReasonCounts();
  const classificationCounts = emptyClassificationCounts();
  const publishRunIds = new Set<string>();
  const dataDigests = new Set<string>();
  const segments = {
    format: {} as Record<string, number>,
    teamIdentity: {} as Record<string, number>,
    archetype: {} as Record<string, number>,
  };

  let baselineSuccessCount = 0;
  let baselineErrorCount = 0;
  let v2SuccessCount = 0;
  let v2ErrorCount = 0;
  let v2TimeoutCount = 0;
  let v2SkippedCount = 0;
  let fallbackCount = 0;

  for (const event of events) {
    baselineLatencies.push(event.baseline.latencyMs);
    if (event.baseline.outcome === 'success') baselineSuccessCount++;
    else baselineErrorCount++;

    if (event.v2.latencyMs !== null) v2Latencies.push(event.v2.latencyMs);
    if (event.v2.outcome === 'success') v2SuccessCount++;
    else if (event.v2.outcome === 'error') v2ErrorCount++;
    else if (event.v2.outcome === 'timeout') v2TimeoutCount++;
    else v2SkippedCount++;

    if (event.v2.fallbackTriggered) {
      fallbackCount++;
      const reason = event.v2.fallbackReason ?? 'unknown';
      reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
    }

    if (event.comparison) {
      classificationCounts[event.comparison.classification]++;
    }

    if (event.publishRunId) publishRunIds.add(event.publishRunId);
    if (event.activeV2DataDigest) dataDigests.add(event.activeV2DataDigest);

    incrementSegment(segments.format, event.format);
    incrementSegment(segments.teamIdentity, event.teamIdentity);
    incrementSegment(segments.archetype, event.archetype);
  }

  return {
    windowStartedAt,
    windowEndedAt,
    requestCount: events.length,
    baseline: {
      successCount: baselineSuccessCount,
      errorCount: baselineErrorCount,
      latency: calculateLatencyPercentiles(baselineLatencies),
    },
    v2: {
      successCount: v2SuccessCount,
      errorCount: v2ErrorCount,
      timeoutCount: v2TimeoutCount,
      skippedCount: v2SkippedCount,
      latency: calculateLatencyPercentiles(v2Latencies),
    },
    fallback: {
      count: fallbackCount,
      reasonCounts,
    },
    classificationCounts,
    observedPublishRunIds: [...publishRunIds].sort(),
    observedActiveV2DataDigests: [...dataDigests].sort(),
    segments,
  };
}
