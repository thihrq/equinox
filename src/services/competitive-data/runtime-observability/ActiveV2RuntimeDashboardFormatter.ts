import type { ActiveV2RuntimeDashboardReport } from './ActiveV2RuntimeTelemetryTypes';

export function formatRuntimeDashboardReportAsJson(report: ActiveV2RuntimeDashboardReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatRuntimeDashboardReportAsMarkdown(report: ActiveV2RuntimeDashboardReport): string {
  const lines: string[] = [];
  const { metrics, manifestHealth, alerts } = report;

  lines.push('# Relatório de Auditoria — Active V2 Runtime Observability Foundation V1');
  lines.push('');
  lines.push(`**Gerado em:** ${report.generatedAt}`);
  lines.push('');

  lines.push('## 1. Resumo Executivo');
  lines.push('');
  lines.push(`*   **Versão da Política:** \`${report.policyVersion}\``);
  lines.push(`*   **Janela Avaliada:** \`${metrics.windowStartedAt}\` até \`${metrics.windowEndedAt}\``);
  lines.push(`*   **Requisições na Janela:** \`${metrics.requestCount}\``);
  lines.push(`*   **Alertas Disparados:** \`${alerts.length}\``);
  lines.push(`*   **Possui Alerta Crítico:** \`${report.hasCriticalAlert ? 'SIM' : 'NÃO'}\``);
  lines.push('');

  lines.push('## 2. Métricas Agregadas');
  lines.push('');
  lines.push('| Métrica | Baseline | Active V2 |');
  lines.push('| :--- | :--- | :--- |');
  lines.push(`| Sucessos | ${metrics.baseline.successCount} | ${metrics.v2.successCount} |`);
  lines.push(`| Erros | ${metrics.baseline.errorCount} | ${metrics.v2.errorCount} |`);
  lines.push(`| Timeouts | n/a | ${metrics.v2.timeoutCount} |`);
  lines.push(`| Latência p50 (ms) | ${metrics.baseline.latency.p50} | ${metrics.v2.latency.p50} |`);
  lines.push(`| Latência p95 (ms) | ${metrics.baseline.latency.p95} | ${metrics.v2.latency.p95} |`);
  lines.push(`| Latência p99 (ms) | ${metrics.baseline.latency.p99} | ${metrics.v2.latency.p99} |`);
  lines.push('');
  lines.push(`*   **Fallback total:** \`${metrics.fallback.count}\``);
  Object.entries(metrics.fallback.reasonCounts)
    .filter(([, count]) => count > 0)
    .forEach(([reason, count]) => lines.push(`    *   \`${reason}\`: ${count}`));
  lines.push('');

  lines.push('## 3. Classificações Competitivas Observadas');
  lines.push('');
  lines.push('| Classificação | Quantidade |');
  lines.push('| :--- | :--- |');
  Object.entries(metrics.classificationCounts).forEach(([classification, count]) => {
    lines.push(`| ${classification} | ${count} |`);
  });
  lines.push('');

  lines.push('## 4. Rastreabilidade de Publicação');
  lines.push('');
  lines.push(`*   **publishRunId(s) observados:** \`${metrics.observedPublishRunIds.join(', ') || 'nenhum'}\``);
  lines.push(`*   **activeV2DataDigest(s) observados:** \`${metrics.observedActiveV2DataDigests.join(', ') || 'nenhum'}\``);
  lines.push('');

  lines.push('## 5. Saúde do Manifesto');
  lines.push('');
  if (manifestHealth) {
    lines.push(`*   **Sets ativos:** \`${manifestHealth.activeSetCount}\``);
    lines.push(`*   **setId(s) com múltiplas versões ativas:** \`${manifestHealth.activeSetIdsWithMultipleActiveVersions.join(', ') || 'nenhum'}\``);
    lines.push(`*   **Manifesto ativo (publishRunId):** \`${manifestHealth.activeManifest?.publishRunId ?? 'nenhum'}\``);
    lines.push(`*   **recordCount do manifesto confere com sets ativos:** \`${manifestHealth.manifestRecordCountMatchesActiveSetCount ? 'SIM' : 'NÃO'}\``);
    lines.push(`*   **Digest recalculado confere com o manifesto:** \`${manifestHealth.digestMatchesManifest ? 'SIM' : 'NÃO'}\``);
  } else {
    lines.push('*   Não avaliado nesta execução (nenhuma conexão Mongo fornecida).');
  }
  lines.push('');

  lines.push('## 6. Alertas Disparados');
  lines.push('');
  if (alerts.length === 0) {
    lines.push('Nenhum alerta disparado nesta janela.');
  } else {
    lines.push('| Código | Severidade | Observado | Limite | Mensagem |');
    lines.push('| :--- | :--- | :--- | :--- | :--- |');
    alerts.forEach(alert => {
      lines.push(`| ${alert.code} | ${alert.severity} | ${alert.observedValue} | ${alert.thresholdValue ?? 'n/a'} | ${alert.message.replace(/\|/g, '\\|')} |`);
    });
  }
  lines.push('');

  return lines.join('\n');
}
