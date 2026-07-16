import type { ActiveV2AcceptanceReport } from './ActiveV2AcceptanceTypes';

export function formatAcceptanceReportAsJson(report: ActiveV2AcceptanceReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatAcceptanceReportAsMarkdown(report: ActiveV2AcceptanceReport): string {
  const lines: string[] = [];

  lines.push('# Relatório de Auditoria — Active V2 Competitive Acceptance Gates V1');
  lines.push('');
  lines.push(`**Gerado em:** ${report.generatedAt}`);
  lines.push('');

  lines.push('## 1. Resumo Executivo');
  lines.push('');
  lines.push(`*   **Status do Portão (Gate Status):** \`${report.gateStatus}\``);
  lines.push(`*   **Aprovação Automática de Rollout:** \`${report.automaticRolloutApproved ? 'SIM' : 'NÃO'}\``);
  lines.push(`*   **Integridade da Evidência (Evidence Valid):** \`${report.evidenceValid ? 'VÁLIDA' : 'INVÁLIDA'}\``);
  lines.push('');

  if (report.globalBlockers.length > 0) {
    lines.push('### ⚠️ Bloqueantes Globais Detectados');
    lines.push('');
    report.globalBlockers.forEach(blocker => {
      lines.push(`*   **Código de Razão:** \`${blocker.reasonCode}\``);
      lines.push(`    *   **Explicação:** ${blocker.explanation}`);
    });
    lines.push('');
  }

  lines.push('## 2. Metadados e Rastreabilidade');
  lines.push('');
  lines.push(`*   **Versão da Política:** \`${report.policyVersion}\``);
  lines.push(`*   **Digest da Evidência Shadow (Input):** \`${report.inputEvidenceDigest}\``);
  lines.push(`*   **SHA do Commit:** \`${report.inputCommitSha}\``);
  lines.push(`*   **Active Run ID:** \`${report.inputActiveRunId}\``);
  lines.push('');

  lines.push('## 3. Métricas de Classificação Agregada');
  lines.push('');
  lines.push('| Classificação Competitiva | Quantidade de Cenários |');
  lines.push('| :--- | :--- |');
  lines.push(`| Blocker (Bloqueante) | ${report.classificationCounts.blocker} |`);
  lines.push(`| Regression (Regressão) | ${report.classificationCounts.regression} |`);
  lines.push(`| Human Review Needed (Revisão Humana) | ${report.classificationCounts['human-review-needed']} |`);
  lines.push(`| Improvement (Melhoria) | ${report.classificationCounts.improvement} |`);
  lines.push(`| Acceptable Divergence (Divergência Aceitável) | ${report.classificationCounts['acceptable-divergence']} |`);
  lines.push(`| Equivalent (Equivalente) | ${report.classificationCounts.equivalent} |`);
  lines.push('');

  lines.push('## 4. Vereditos Detalhados por Cenário');
  lines.push('');

  report.scenarioVerdicts.forEach(verdict => {
    lines.push(`### Cenário: \`${verdict.scenarioId}\``);
    lines.push('');
    lines.push(`*   **Classificação Final do Cenário:** \`${verdict.scenarioClassification}\``);
    lines.push(`*   **Aprovado Automaticamente:** \`${verdict.automaticApproval ? 'Sim' : 'Não'}\``);
    lines.push(`*   **Requer Revisão Humana:** \`${verdict.requiresHumanReview ? 'Sim' : 'Não'}\``);
    lines.push('');

    lines.push('| Comparador | Status da Dif | Classificação Competitiva | Código de Razão | Explicação |');
    lines.push('| :--- | :--- | :--- | :--- | :--- |');

    verdict.comparatorClassifications.forEach(c => {
      lines.push(`| ${c.comparator} | ${c.diffStatus} | ${c.classification} | ${c.reasonCode} | ${c.explanation.replace(/\|/g, '\\|')} |`);
    });
    lines.push('');
  });

  return lines.join('\n');
}
