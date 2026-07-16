import { createAuditRunContext, AuditRunContext } from '../../../equinox/data-audit/AuditRunContext';
import type { ActiveV2RuntimeDashboardReport } from './ActiveV2RuntimeTelemetryTypes';

export interface ActiveV2RuntimeObservabilityAuditContext {
  base: AuditRunContext;
  windowStartedAt: string;
  windowEndedAt: string;
}

/**
 * Constrói o contexto de auditoria de uma execução de avaliação de observabilidade,
 * reaproveitando `createAuditRunContext` (run id, commit, data mode) e anexando
 * os limites da janela avaliada.
 */
export function createActiveV2RuntimeObservabilityAuditContext(
  command: string,
  windowStartedAt: string,
  windowEndedAt: string
): ActiveV2RuntimeObservabilityAuditContext {
  return {
    base: createAuditRunContext(command),
    windowStartedAt,
    windowEndedAt,
  };
}

/**
 * Imprime o cabeçalho de auditoria em console (convenção de tags entre colchetes
 * usada por `printAuditHeader`), seguido do resumo de métricas e alertas da janela.
 */
export function printActiveV2RuntimeObservabilityAuditHeader(
  context: ActiveV2RuntimeObservabilityAuditContext,
  report: ActiveV2RuntimeDashboardReport
): void {
  console.log(`[RUN ID] ${context.base.runId}`);
  console.log(`[COMMAND] ${context.base.command}`);
  console.log(`[DATA MODE] ${context.base.dataMode}`);
  console.log(`[NODE ENV] ${context.base.nodeEnv}`);
  console.log(`[GIT COMMIT] ${context.base.gitCommit}`);
  console.log(`[GIT DIRTY] ${context.base.gitDirty}`);
  console.log(`[WINDOW START] ${context.windowStartedAt}`);
  console.log(`[WINDOW END] ${context.windowEndedAt}`);
  console.log(`[REQUEST COUNT] ${report.metrics.requestCount}`);
  console.log(`[POLICY VERSION] ${report.policyVersion}`);
  console.log(`[ALERTS FIRED] ${report.alerts.length}`);
  console.log(`[HAS CRITICAL ALERT] ${report.hasCriticalAlert}`);

  for (const alert of report.alerts) {
    console.log(`[ALERT] ${alert.code} | severity=${alert.severity} | observed=${alert.observedValue} | threshold=${alert.thresholdValue} | firedAt=${alert.firedAt}`);
  }
}
