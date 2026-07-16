# Active V2 Runtime Observability Foundation V1 — Sumário da Fase 2A

**Status:** Implementado e validado offline. Gate da Fase 2A (teste de injeção sintética) **aprovado**.

## 1. Escopo desta fase

Esta fase implementa os cinco componentes mínimos exigidos pelo adendo de revisão (seção 3.1) antes do Runtime Shadow Mode (Fase 3):

| Componente | Arquivo |
|---|---|
| Schema de telemetria | `src/services/competitive-data/runtime-observability/ActiveV2RuntimeTelemetrySchema.ts` |
| Agregador de métricas | `src/services/competitive-data/runtime-observability/ActiveV2RuntimeMetricsAggregator.ts` |
| Avaliador de alertas | `src/services/competitive-data/runtime-observability/ActiveV2RuntimeAlertEvaluator.ts` |
| Audit logger | `src/services/competitive-data/runtime-observability/ActiveV2RuntimeAuditLogger.ts` |
| Dashboard (relatório JSON/Markdown) | `src/services/competitive-data/runtime-observability/ActiveV2RuntimeDashboardFormatter.ts` |

Componente adicional, não listado explicitamente no adendo mas necessário para cobrir os 4 alertas estruturais (zero active sets, múltiplas versões ativas, inconsistência de manifesto, digest mismatch):

- `src/services/competitive-data/runtime-observability/ActiveV2RuntimeManifestHealth.ts` — cruza `pokemonsets_v2` e `publication_manifests`, reaproveitando `ActiveV2CanonicalDataDigest.ts` já existente.

## 2. Os 9 alertas mínimos

Todos implementados em `ActiveV2RuntimeAlertEvaluator.ts`, com os 5 baseados em taxa (`V2_ERROR_RATE`, `V2_TIMEOUT_RATE`, `FALLBACK_RATE`, `P95_LATENCY_DEGRADATION`, e o volume mínimo de `BLOCKER_CLASSIFICATION_PRESENT`) protegidos por um piso de volume (`minRequestsForRateAlerts = 20`) para evitar falso-positivo por amostra pequena, e os 4 estruturais (`ZERO_ACTIVE_SETS`, `MULTIPLE_ACTIVE_VERSIONS`, `MANIFEST_INCONSISTENCY`, `DIGEST_MISMATCH`) sempre avaliados quando há saúde de manifesto disponível.

## 3. Gate da Fase 2A — teste de injeção sintética

Requisito do adendo (3.1/8.2): *"forçar um erro/timeout controlado em staging e confirmar que o alerta dispara dentro do SLA esperado"*.

Implementado em `src/services/competitive-data/runtime-observability/ActiveV2RuntimeSyntheticInjectionGate.ts` e exposto via `npm run sets:active-v2-runtime-observability:inject-synthetic-alert`. Resultado real desta execução: ver `active-v2-runtime-observability-synthetic-injection-v1-report.md` (gate **APROVADO**, 9/9 alertas disparados, todos dentro do SLA de 60s).

**Limitação assumida e declarada no próprio relatório gerado:** esta é uma injeção **offline, em memória** — prova que a lógica de agregação e avaliação classifica corretamente cada uma das 9 condições e o faz dentro do orçamento de SLA de avaliação. **Não é** o mesmo que um teste de injeção contra um ambiente de staging vivo (endpoint HTTP real, latência de rede, entrega efetiva de uma notificação/alerta para um humano) — isso só se torna possível a partir da Fase 3 (Runtime Shadow Mode), quando houver tráfego real fluindo pelo runtime. Um teste de injeção *live* deve ser reexecutado nesse momento antes de a Fase 2A ser considerada definitivamente encerrada para fins de produção pública.

## 4. Artefatos gerados

- `docs/data-audit/active-v2-runtime-observability-v1-report.md` / `artifacts/active-v2-runtime-observability-v1.json` — dashboard de uma janela de amostra (`src/scripts/support/fixtures/active-v2-runtime-observability-sample-events.json`, 24 eventos sintéticos representativos, **não é tráfego real** — não há runtime V2 em produção ainda).
- `docs/data-audit/active-v2-runtime-observability-synthetic-injection-v1-report.md` / `artifacts/active-v2-runtime-observability-synthetic-injection-v1.json` — evidência do gate da Fase 2A.

## 5. Suíte offline

`npm run sets:active-v2-runtime-observability:offline:check` executa os 7 validadores (schema, agregador, saúde de manifesto, avaliador de alertas, audit logger, formatter, gate de injeção sintética). Todos passando nesta branch.

## 6. O que ainda falta para a Fase 2A ser 100% (não coberto aqui)

- Persistência real de eventos de telemetria em produção (o modelo Mongoose `ActiveV2RuntimeTelemetryEvent` existe em `src/models/`, mas nada ainda escreve nele — não há runtime V2 recebendo tráfego).
- Dashboard visual (esta fase entrega o relatório JSON/Markdown, não uma UI).
- Entrega efetiva de alerta (paging, Slack, e-mail) — o avaliador classifica e o audit logger registra em console/relatório; a integração com um canal de notificação real fica para quando houver on-call definido.
- Teste de injeção sintética *live* contra staging, conforme observado na seção 3.
