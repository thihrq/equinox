import {
  ACTIVE_V2_RUNTIME_OBSERVABILITY_POLICY_V1,
  type ActiveV2RuntimeObservabilityPolicy,
} from './ActiveV2RuntimeObservabilityPolicy';
import type {
  ActiveV2RuntimeAlert,
  ActiveV2RuntimeAlertSeverity,
  ActiveV2RuntimeManifestHealthSnapshot,
  ActiveV2RuntimeMetricsSnapshot,
} from './ActiveV2RuntimeTelemetryTypes';

function ratePercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

function rateSeverity(observedPercent: number, thresholdPercent: number): ActiveV2RuntimeAlertSeverity {
  return observedPercent >= thresholdPercent * 2 ? 'critical' : 'warning';
}

/**
 * Avalia um snapshot de métricas (e, quando disponível, um snapshot de saúde
 * de manifesto) contra a política operacional e devolve a lista de alertas
 * mínimos exigidos pelo adendo 3.1. Função pura — não dispara notificações,
 * apenas classifica o estado observado.
 */
export function evaluateActiveV2RuntimeAlerts(
  metrics: ActiveV2RuntimeMetricsSnapshot,
  manifestHealth: ActiveV2RuntimeManifestHealthSnapshot | null,
  policy: ActiveV2RuntimeObservabilityPolicy = ACTIVE_V2_RUNTIME_OBSERVABILITY_POLICY_V1
): ActiveV2RuntimeAlert[] {
  const alerts: ActiveV2RuntimeAlert[] = [];
  const firedAt = new Date().toISOString();
  const hasReliableVolume = metrics.requestCount >= policy.minRequestsForRateAlerts;

  if (hasReliableVolume) {
    const v2ErrorRate = ratePercent(metrics.v2.errorCount, metrics.requestCount);
    if (v2ErrorRate > policy.alertThresholds.v2ErrorRatePercent) {
      alerts.push({
        code: 'V2_ERROR_RATE',
        severity: rateSeverity(v2ErrorRate, policy.alertThresholds.v2ErrorRatePercent),
        message: `Taxa de erro do Active V2 (${v2ErrorRate.toFixed(2)}%) excede o limite de ${policy.alertThresholds.v2ErrorRatePercent}%`,
        observedValue: Number(v2ErrorRate.toFixed(2)),
        thresholdValue: policy.alertThresholds.v2ErrorRatePercent,
        firedAt,
      });
    }

    const v2TimeoutRate = ratePercent(metrics.v2.timeoutCount, metrics.requestCount);
    if (v2TimeoutRate > policy.alertThresholds.v2TimeoutRatePercent) {
      alerts.push({
        code: 'V2_TIMEOUT_RATE',
        severity: rateSeverity(v2TimeoutRate, policy.alertThresholds.v2TimeoutRatePercent),
        message: `Taxa de timeout do Active V2 (${v2TimeoutRate.toFixed(2)}%) excede o limite de ${policy.alertThresholds.v2TimeoutRatePercent}%`,
        observedValue: Number(v2TimeoutRate.toFixed(2)),
        thresholdValue: policy.alertThresholds.v2TimeoutRatePercent,
        firedAt,
      });
    }

    const fallbackRate = ratePercent(metrics.fallback.count, metrics.requestCount);
    if (fallbackRate > policy.alertThresholds.fallbackRatePercent) {
      alerts.push({
        code: 'FALLBACK_RATE',
        severity: rateSeverity(fallbackRate, policy.alertThresholds.fallbackRatePercent),
        message: `Taxa de fallback para baseline (${fallbackRate.toFixed(2)}%) excede o limite de ${policy.alertThresholds.fallbackRatePercent}%`,
        observedValue: Number(fallbackRate.toFixed(2)),
        thresholdValue: policy.alertThresholds.fallbackRatePercent,
        firedAt,
      });
    }

    if (metrics.baseline.latency.p95 > 0) {
      const p95DegradationPercent =
        ((metrics.v2.latency.p95 - metrics.baseline.latency.p95) / metrics.baseline.latency.p95) * 100;
      if (p95DegradationPercent > policy.alertThresholds.p95DegradationPercent) {
        alerts.push({
          code: 'P95_LATENCY_DEGRADATION',
          severity: rateSeverity(p95DegradationPercent, policy.alertThresholds.p95DegradationPercent),
          message: `Latência p95 do Active V2 (${metrics.v2.latency.p95}ms) está ${p95DegradationPercent.toFixed(2)}% acima da baseline (${metrics.baseline.latency.p95}ms)`,
          observedValue: Number(p95DegradationPercent.toFixed(2)),
          thresholdValue: policy.alertThresholds.p95DegradationPercent,
          firedAt,
        });
      }
    }
  }

  if (metrics.classificationCounts.blocker > 0) {
    alerts.push({
      code: 'BLOCKER_CLASSIFICATION_PRESENT',
      severity: 'critical',
      message: `${metrics.classificationCounts.blocker} cenário(s) classificado(s) como blocker na janela`,
      observedValue: metrics.classificationCounts.blocker,
      thresholdValue: 0,
      firedAt,
    });
  }

  if (manifestHealth) {
    if (manifestHealth.activeSetCount === 0) {
      alerts.push({
        code: 'ZERO_ACTIVE_SETS',
        severity: 'critical',
        message: 'Nenhum set ativo encontrado em pokemonsets_v2',
        observedValue: 0,
        thresholdValue: null,
        firedAt,
      });
    }

    if (manifestHealth.activeSetIdsWithMultipleActiveVersions.length > 0) {
      alerts.push({
        code: 'MULTIPLE_ACTIVE_VERSIONS',
        severity: 'critical',
        message: `setId(s) com mais de uma versão ativa simultânea: ${manifestHealth.activeSetIdsWithMultipleActiveVersions.join(', ')}`,
        observedValue: manifestHealth.activeSetIdsWithMultipleActiveVersions.length,
        thresholdValue: 0,
        firedAt,
      });
    }

    if (!manifestHealth.manifestRecordCountMatchesActiveSetCount) {
      alerts.push({
        code: 'MANIFEST_INCONSISTENCY',
        severity: 'critical',
        message: `recordCount do manifesto ativo (${manifestHealth.activeManifest?.recordedRecordCount ?? 'n/a'}) não confere com a contagem real de sets ativos (${manifestHealth.activeSetCount})`,
        observedValue: manifestHealth.activeSetCount,
        thresholdValue: manifestHealth.activeManifest?.recordedRecordCount ?? null,
        firedAt,
      });
    }

    if (!manifestHealth.digestMatchesManifest) {
      alerts.push({
        code: 'DIGEST_MISMATCH',
        severity: 'critical',
        message: `Digest recalculado dos sets ativos (${manifestHealth.recomputedActiveV2DataDigest}) diverge do digest registrado no manifesto (${manifestHealth.activeManifest?.activeV2DataDigest ?? 'n/a'})`,
        observedValue: manifestHealth.recomputedActiveV2DataDigest ?? 'null',
        thresholdValue: manifestHealth.activeManifest?.activeV2DataDigest ?? null,
        firedAt,
      });
    }
  }

  return alerts;
}
