import { aggregateActiveV2RuntimeMetrics } from './ActiveV2RuntimeMetricsAggregator';
import { evaluateActiveV2RuntimeAlerts } from './ActiveV2RuntimeAlertEvaluator';
import {
  ACTIVE_V2_RUNTIME_OBSERVABILITY_POLICY_V1,
  type ActiveV2RuntimeObservabilityPolicy,
} from './ActiveV2RuntimeObservabilityPolicy';
import type {
  ActiveV2RuntimeAlertCode,
  ActiveV2RuntimeManifestHealthSnapshot,
  ActiveV2RuntimeTelemetryEvent,
} from './ActiveV2RuntimeTelemetryTypes';

export interface SyntheticInjectionScenarioResult {
  alertCode: ActiveV2RuntimeAlertCode;
  description: string;
  fired: boolean;
  elapsedMs: number;
  withinSla: boolean;
}

export interface SyntheticInjectionGateReport {
  policyVersion: string;
  slaMs: number;
  generatedAt: string;
  scenarios: SyntheticInjectionScenarioResult[];
  allFired: boolean;
  allWithinSla: boolean;
  gatePassed: boolean;
  limitation: string;
}

function baseEvent(index: number, occurredAt: string): ActiveV2RuntimeTelemetryEvent {
  return {
    eventId: `synthetic-${index}`,
    occurredAt,
    requestId: `synthetic-req-${index}`,
    format: 'champions_reg_m_b_doubles',
    teamIdentity: 'balanced',
    archetype: 'balanced-offense',
    publishRunId: 'publish-run-synthetic-1',
    activeV2DataDigest: 'sha256-synthetic-digest',
    baseline: { outcome: 'success', latencyMs: 100 },
    v2: { outcome: 'success', latencyMs: 110, fallbackTriggered: false, fallbackReason: null },
    comparison: { classification: 'equivalent', scoreDelta: 0 },
  };
}

function makeEvents(count: number, mutate: (event: ActiveV2RuntimeTelemetryEvent, index: number) => void): ActiveV2RuntimeTelemetryEvent[] {
  const startedAt = Date.now();
  const events: ActiveV2RuntimeTelemetryEvent[] = [];
  for (let i = 0; i < count; i++) {
    const event = baseEvent(i, new Date(startedAt + i * 1000).toISOString());
    mutate(event, i);
    events.push(event);
  }
  return events;
}

interface Scenario {
  alertCode: ActiveV2RuntimeAlertCode;
  description: string;
  events: ActiveV2RuntimeTelemetryEvent[];
  manifestHealth: ActiveV2RuntimeManifestHealthSnapshot | null;
}

function buildScenarios(policy: ActiveV2RuntimeObservabilityPolicy): Scenario[] {
  const volume = Math.max(policy.minRequestsForRateAlerts, 20);

  const errorEvents = makeEvents(volume, (event, i) => {
    if (i < Math.ceil(volume * 0.15)) {
      event.v2.outcome = 'error';
    }
  });

  const timeoutEvents = makeEvents(volume, (event, i) => {
    if (i < Math.ceil(volume * 0.15)) {
      event.v2.outcome = 'timeout';
      event.v2.latencyMs = null;
    }
  });

  const fallbackEvents = makeEvents(volume, (event, i) => {
    if (i < Math.ceil(volume * 0.2)) {
      event.v2.fallbackTriggered = true;
      event.v2.fallbackReason = 'v2-error';
    }
  });

  const p95DegradationEvents = makeEvents(volume, (event) => {
    event.baseline.latencyMs = 100;
    event.v2.latencyMs = 250;
  });

  const blockerEvents = makeEvents(1, (event) => {
    event.comparison = { classification: 'blocker', scoreDelta: -50 };
  });

  const healthyManifest: ActiveV2RuntimeManifestHealthSnapshot = {
    activeSetCount: 4,
    activeSetIdsWithMultipleActiveVersions: [],
    activeManifest: {
      publishRunId: 'publish-run-synthetic-1',
      status: 'active',
      activeV2DataDigest: 'sha256-synthetic-digest',
      recordedRecordCount: 4,
    },
    manifestRecordCountMatchesActiveSetCount: true,
    recomputedActiveV2DataDigest: 'sha256-synthetic-digest',
    digestMatchesManifest: true,
  };

  return [
    {
      alertCode: 'V2_ERROR_RATE',
      description: `Taxa de erro do Active V2 acima de ${policy.alertThresholds.v2ErrorRatePercent}% em uma janela de ${volume} requisições`,
      events: errorEvents,
      manifestHealth: null,
    },
    {
      alertCode: 'V2_TIMEOUT_RATE',
      description: `Taxa de timeout do Active V2 acima de ${policy.alertThresholds.v2TimeoutRatePercent}% em uma janela de ${volume} requisições`,
      events: timeoutEvents,
      manifestHealth: null,
    },
    {
      alertCode: 'FALLBACK_RATE',
      description: `Taxa de fallback para baseline acima de ${policy.alertThresholds.fallbackRatePercent}% em uma janela de ${volume} requisições`,
      events: fallbackEvents,
      manifestHealth: null,
    },
    {
      alertCode: 'P95_LATENCY_DEGRADATION',
      description: `Degradação de latência p95 do Active V2 acima de ${policy.alertThresholds.p95DegradationPercent}% em relação à baseline`,
      events: p95DegradationEvents,
      manifestHealth: null,
    },
    {
      alertCode: 'BLOCKER_CLASSIFICATION_PRESENT',
      description: 'Um cenário classificado como blocker aparece na janela',
      events: blockerEvents,
      manifestHealth: null,
    },
    {
      alertCode: 'ZERO_ACTIVE_SETS',
      description: 'Nenhum set ativo encontrado em pokemonsets_v2',
      events: [],
      manifestHealth: {
        ...healthyManifest,
        activeSetCount: 0,
        activeManifest: null,
        manifestRecordCountMatchesActiveSetCount: false,
        recomputedActiveV2DataDigest: 'sha256-' + 'e'.repeat(64),
        digestMatchesManifest: false,
      },
    },
    {
      alertCode: 'MULTIPLE_ACTIVE_VERSIONS',
      description: 'Mais de uma versão ativa simultânea para o mesmo setId',
      events: [],
      manifestHealth: {
        ...healthyManifest,
        activeSetIdsWithMultipleActiveVersions: ['sinistcha-bulky-trick-room-setter-draft'],
      },
    },
    {
      alertCode: 'MANIFEST_INCONSISTENCY',
      description: 'recordCount do manifesto ativo não confere com a contagem real de sets ativos',
      events: [],
      manifestHealth: {
        ...healthyManifest,
        activeSetCount: 3,
        manifestRecordCountMatchesActiveSetCount: false,
      },
    },
    {
      alertCode: 'DIGEST_MISMATCH',
      description: 'Digest recalculado dos sets ativos diverge do digest registrado no manifesto',
      events: [],
      manifestHealth: {
        ...healthyManifest,
        recomputedActiveV2DataDigest: 'sha256-' + 'f'.repeat(64),
        digestMatchesManifest: false,
      },
    },
  ];
}

/**
 * Gate da Fase 2A (adendo 3.1/8.2): injeta, para cada um dos 9 alertas mínimos,
 * um lote sintético de telemetria/estado de manifesto desenhado para disparar
 * exatamente aquele alerta, e mede o tempo decorrido entre a injeção e o
 * disparo do alerta.
 *
 * Limitação assumida: esta é uma injeção offline contra a lógica de agregação
 * e avaliação em memória — prova que o pipeline de alertas classifica e
 * dispara corretamente e dentro do orçamento de SLA. Não substitui um teste
 * de injeção real contra um ambiente de staging vivo (endpoint HTTP real,
 * latência de rede, entrega efetiva de notificação), que só é possível a
 * partir da Fase 3 (Runtime Shadow Mode), quando houver tráfego real fluindo.
 */
export function runActiveV2RuntimeSyntheticInjectionGate(
  policy: ActiveV2RuntimeObservabilityPolicy = ACTIVE_V2_RUNTIME_OBSERVABILITY_POLICY_V1
): SyntheticInjectionGateReport {
  const scenarios = buildScenarios(policy);
  const results: SyntheticInjectionScenarioResult[] = scenarios.map(scenario => {
    const injectionStartedAt = Date.now();

    const { windowStartedAt, windowEndedAt } = scenario.events.length > 0
      ? {
          windowStartedAt: scenario.events[0].occurredAt,
          windowEndedAt: scenario.events[scenario.events.length - 1].occurredAt,
        }
      : { windowStartedAt: new Date(injectionStartedAt).toISOString(), windowEndedAt: new Date(injectionStartedAt).toISOString() };

    const metrics = aggregateActiveV2RuntimeMetrics(scenario.events, windowStartedAt, windowEndedAt);
    const alerts = evaluateActiveV2RuntimeAlerts(metrics, scenario.manifestHealth, policy);

    const evaluationCompletedAt = Date.now();
    const elapsedMs = evaluationCompletedAt - injectionStartedAt;
    const fired = alerts.some(alert => alert.code === scenario.alertCode);

    return {
      alertCode: scenario.alertCode,
      description: scenario.description,
      fired,
      elapsedMs,
      withinSla: elapsedMs <= policy.syntheticInjectionSlaMs,
    };
  });

  const allFired = results.every(r => r.fired);
  const allWithinSla = results.every(r => r.withinSla);

  return {
    policyVersion: policy.version,
    slaMs: policy.syntheticInjectionSlaMs,
    generatedAt: new Date().toISOString(),
    scenarios: results,
    allFired,
    allWithinSla,
    gatePassed: allFired && allWithinSla,
    limitation:
      'Injeção offline em memória — comprova a lógica de classificação e o orçamento de SLA de avaliação, ' +
      'não a entrega ponta-a-ponta contra um ambiente de staging vivo (pendente da Fase 3).',
  };
}
