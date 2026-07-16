import {
  createActiveV2RuntimeObservabilityAuditContext,
  printActiveV2RuntimeObservabilityAuditHeader,
} from '../services/competitive-data/runtime-observability/ActiveV2RuntimeAuditLogger';
import { aggregateActiveV2RuntimeMetrics } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeMetricsAggregator';
import type { ActiveV2RuntimeDashboardReport } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeTelemetryTypes';

async function runTests(): Promise<void> {
  // --- Caso de Teste 1: contexto de auditoria carrega runId, comando e janela ---
  const context = createActiveV2RuntimeObservabilityAuditContext(
    'testCommand',
    '2026-07-15T00:00:00.000Z',
    '2026-07-15T01:00:00.000Z'
  );
  if (!context.base.runId.startsWith('audit-')) throw new Error('Test 1 failed: expected runId to start with audit-');
  if (context.base.command !== 'testCommand') throw new Error('Test 1 failed: expected command to be preserved');
  if (context.windowStartedAt !== '2026-07-15T00:00:00.000Z') throw new Error('Test 1 failed: expected windowStartedAt to be preserved');

  // --- Caso de Teste 2: printAuditHeader não lança para um relatório vazio ---
  const metrics = aggregateActiveV2RuntimeMetrics([], '2026-07-15T00:00:00.000Z', '2026-07-15T01:00:00.000Z');
  const report: ActiveV2RuntimeDashboardReport = {
    policyVersion: 'active-v2-runtime-observability-v1',
    generatedAt: new Date().toISOString(),
    metrics,
    manifestHealth: null,
    alerts: [],
    hasCriticalAlert: false,
  };

  const originalLog = console.log;
  const capturedLines: string[] = [];
  console.log = (...args: any[]) => { capturedLines.push(args.join(' ')); };
  try {
    printActiveV2RuntimeObservabilityAuditHeader(context, report);
  } finally {
    console.log = originalLog;
  }

  if (!capturedLines.some(line => line.includes('[RUN ID]'))) throw new Error('Test 2 failed: expected [RUN ID] line to be printed');
  if (!capturedLines.some(line => line.includes('[ALERTS FIRED] 0'))) throw new Error('Test 2 failed: expected [ALERTS FIRED] 0 line');

  // --- Caso de Teste 3: alertas são impressos individualmente ---
  const reportWithAlert: ActiveV2RuntimeDashboardReport = {
    ...report,
    alerts: [{
      code: 'ZERO_ACTIVE_SETS',
      severity: 'critical',
      message: 'test',
      observedValue: 0,
      thresholdValue: null,
      firedAt: new Date().toISOString(),
    }],
    hasCriticalAlert: true,
  };
  const capturedLines2: string[] = [];
  console.log = (...args: any[]) => { capturedLines2.push(args.join(' ')); };
  try {
    printActiveV2RuntimeObservabilityAuditHeader(context, reportWithAlert);
  } finally {
    console.log = originalLog;
  }
  if (!capturedLines2.some(line => line.includes('[ALERT] ZERO_ACTIVE_SETS'))) {
    throw new Error('Test 3 failed: expected [ALERT] ZERO_ACTIVE_SETS line to be printed');
  }

  console.log('[Equinox] Active V2 runtime audit logger validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
