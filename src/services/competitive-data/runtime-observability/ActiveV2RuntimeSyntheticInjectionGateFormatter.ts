import type { SyntheticInjectionGateReport } from './ActiveV2RuntimeSyntheticInjectionGate';

export function formatSyntheticInjectionGateReportAsJson(report: SyntheticInjectionGateReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatSyntheticInjectionGateReportAsMarkdown(report: SyntheticInjectionGateReport): string {
  const lines: string[] = [];

  lines.push('# Relatório de Auditoria — Active V2 Runtime Observability Synthetic Injection Gate V1');
  lines.push('');
  lines.push(`**Gerado em:** ${report.generatedAt}`);
  lines.push('');

  lines.push('## 1. Resumo Executivo');
  lines.push('');
  lines.push(`*   **Versão da Política:** \`${report.policyVersion}\``);
  lines.push(`*   **SLA de disparo:** \`${report.slaMs}ms\``);
  lines.push(`*   **Todos os alertas dispararam:** \`${report.allFired ? 'SIM' : 'NÃO'}\``);
  lines.push(`*   **Todos dentro do SLA:** \`${report.allWithinSla ? 'SIM' : 'NÃO'}\``);
  lines.push(`*   **Gate da Fase 2A:** \`${report.gatePassed ? 'APROVADO' : 'REPROVADO'}\``);
  lines.push('');
  lines.push(`> **Limitação assumida:** ${report.limitation}`);
  lines.push('');

  lines.push('## 2. Cenários de Injeção Sintética');
  lines.push('');
  lines.push('| Alerta | Disparou | Tempo (ms) | Dentro do SLA | Descrição |');
  lines.push('| :--- | :--- | :--- | :--- | :--- |');
  report.scenarios.forEach(scenario => {
    lines.push(`| ${scenario.alertCode} | ${scenario.fired ? 'SIM' : 'NÃO'} | ${scenario.elapsedMs} | ${scenario.withinSla ? 'SIM' : 'NÃO'} | ${scenario.description.replace(/\|/g, '\\|')} |`);
  });
  lines.push('');

  return lines.join('\n');
}
