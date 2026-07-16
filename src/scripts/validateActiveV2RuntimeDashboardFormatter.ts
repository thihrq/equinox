import {
  formatRuntimeDashboardReportAsJson,
  formatRuntimeDashboardReportAsMarkdown,
} from '../services/competitive-data/runtime-observability/ActiveV2RuntimeDashboardFormatter';
import { aggregateActiveV2RuntimeMetrics } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeMetricsAggregator';
import type { ActiveV2RuntimeDashboardReport } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeTelemetryTypes';

async function runTests(): Promise<void> {
  const metrics = aggregateActiveV2RuntimeMetrics([], '2026-07-15T00:00:00.000Z', '2026-07-15T01:00:00.000Z');
  const report: ActiveV2RuntimeDashboardReport = {
    policyVersion: 'active-v2-runtime-observability-v1',
    generatedAt: '2026-07-15T02:00:00.000Z',
    metrics,
    manifestHealth: {
      activeSetCount: 4,
      activeSetIdsWithMultipleActiveVersions: [],
      activeManifest: { publishRunId: 'run-1', status: 'active', activeV2DataDigest: 'sha256-abc', recordedRecordCount: 4 },
      manifestRecordCountMatchesActiveSetCount: true,
      recomputedActiveV2DataDigest: 'sha256-abc',
      digestMatchesManifest: true,
    },
    alerts: [{
      code: 'ZERO_ACTIVE_SETS',
      severity: 'critical',
      message: 'Nenhum set ativo | com pipe',
      observedValue: 0,
      thresholdValue: null,
      firedAt: '2026-07-15T02:00:00.000Z',
    }],
    hasCriticalAlert: true,
  };

  // --- Caso de Teste 1: JSON é um round-trip válido e preserva os campos ---
  const json = formatRuntimeDashboardReportAsJson(report);
  const parsed = JSON.parse(json);
  if (parsed.policyVersion !== 'active-v2-runtime-observability-v1') throw new Error('Test 1 failed: expected policyVersion to round-trip');
  if (parsed.alerts.length !== 1) throw new Error('Test 1 failed: expected 1 alert to round-trip');

  // --- Caso de Teste 2: Markdown contém as seções esperadas ---
  const markdown = formatRuntimeDashboardReportAsMarkdown(report);
  if (!markdown.includes('# Relatório de Auditoria — Active V2 Runtime Observability Foundation V1')) {
    throw new Error('Test 2 failed: expected title heading');
  }
  if (!markdown.includes('## 6. Alertas Disparados')) throw new Error('Test 2 failed: expected alerts section heading');
  if (!markdown.includes('ZERO_ACTIVE_SETS')) throw new Error('Test 2 failed: expected alert code in markdown');

  // --- Caso de Teste 3: pipe em mensagem de alerta é escapado na tabela markdown ---
  if (!markdown.includes('Nenhum set ativo \\| com pipe')) {
    throw new Error('Test 3 failed: expected pipe character in alert message to be escaped');
  }

  // --- Caso de Teste 4: relatório sem manifestHealth nem alertas produz seções coerentes ---
  const noManifestReport: ActiveV2RuntimeDashboardReport = { ...report, manifestHealth: null, alerts: [], hasCriticalAlert: false };
  const noManifestMarkdown = formatRuntimeDashboardReportAsMarkdown(noManifestReport);
  if (!noManifestMarkdown.includes('Não avaliado nesta execução')) {
    throw new Error('Test 4 failed: expected placeholder text when manifestHealth is null');
  }
  if (!noManifestMarkdown.includes('Nenhum alerta disparado nesta janela.')) {
    throw new Error('Test 4 failed: expected placeholder text when alerts is empty');
  }

  console.log('[Equinox] Active V2 runtime dashboard formatter validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
