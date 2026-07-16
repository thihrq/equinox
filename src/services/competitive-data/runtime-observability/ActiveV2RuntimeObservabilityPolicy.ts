export interface ActiveV2RuntimeObservabilityPolicy {
  version: string;
  alertThresholds: {
    v2ErrorRatePercent: number;
    v2TimeoutRatePercent: number;
    fallbackRatePercent: number;
    p95DegradationPercent: number;
  };
  minRequestsForRateAlerts: number;
  syntheticInjectionSlaMs: number;
}

export const ACTIVE_V2_RUNTIME_OBSERVABILITY_POLICY_V1: ActiveV2RuntimeObservabilityPolicy = {
  version: 'active-v2-runtime-observability-v1',
  alertThresholds: {
    v2ErrorRatePercent: 5,
    v2TimeoutRatePercent: 5,
    fallbackRatePercent: 10,
    p95DegradationPercent: 50,
  },
  // Abaixo deste volume de requisições na janela, taxas percentuais não são
  // estatisticamente confiáveis e alertas baseados em taxa são suprimidos
  // (blocker/manifest health continuam ativos independente do volume).
  minRequestsForRateAlerts: 20,
  // SLA da Fase 2A (adendo 3.1/8.2): alerta deve disparar em até 60s
  // após o evento sintético injetado entrar na janela avaliada.
  syntheticInjectionSlaMs: 60_000,
} as const;
