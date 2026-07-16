import type { ActiveV2RuntimeAlert } from '../runtime-observability/ActiveV2RuntimeTelemetryTypes';

export interface CircuitBreakerTripDecision {
  shouldTrip: boolean;
  reasonCode: string | null;
  triggeringAlert: ActiveV2RuntimeAlert | null;
}

/**
 * Decide se o circuit breaker deve abrir (forçar baseline) a partir dos
 * alertas já classificados pela Fase 2A (`ActiveV2RuntimeAlertEvaluator`).
 * Reaproveita a mesma lógica de detecção validada pelo gate de injeção
 * sintética em vez de duplicar limiares — "monitorar janela deslizante,
 * detectar erro/timeout/fallback" (adendo 3.2) é exatamente o que o
 * avaliador de alertas da Fase 2A já faz; este módulo apenas decide a
 * ação (trip) a partir do resultado.
 *
 * Regra: qualquer alerta de severidade `critical` na janela dispara o
 * breaker. O primeiro alerta crítico (ordem de avaliação da Fase 2A,
 * que já segue a precedência do adendo) vira o `reasonCode` registrado.
 */
export function evaluateCircuitBreakerTrip(alerts: readonly ActiveV2RuntimeAlert[]): CircuitBreakerTripDecision {
  const triggeringAlert = alerts.find(alert => alert.severity === 'critical') ?? null;

  if (!triggeringAlert) {
    return { shouldTrip: false, reasonCode: null, triggeringAlert: null };
  }

  return {
    shouldTrip: true,
    reasonCode: `AUTOMATIC_${triggeringAlert.code}`,
    triggeringAlert,
  };
}
