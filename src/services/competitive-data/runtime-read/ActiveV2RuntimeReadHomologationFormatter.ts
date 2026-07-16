import type { ActiveV2RuntimeReadHomologationResult } from './ActiveV2RuntimeReadTypes';

export function formatRuntimeReadHomologationAsJson(result: ActiveV2RuntimeReadHomologationResult): string {
  return JSON.stringify(result, null, 2);
}

export function formatRuntimeReadHomologationAsMarkdown(result: ActiveV2RuntimeReadHomologationResult): string {
  const lines: string[] = [];

  lines.push('# Relatório de Auditoria — Active V2 Production Runtime Read Homologation V1');
  lines.push('');
  lines.push(`**Gerado em:** ${result.generatedAt}`);
  lines.push('');

  lines.push('## 1. Resumo Executivo');
  lines.push('');
  lines.push(`*   **Modo:** \`${result.mode}\``);
  lines.push(`*   **Aprovado:** \`${result.approved ? 'SIM' : 'NÃO'}\``);
  lines.push(`*   **Registros lidos:** \`${result.recordCount}\``);
  lines.push(`*   **Coleção legada acessada:** \`${result.legacyCollectionAccessed ? 'SIM' : 'NÃO'}\``);
  lines.push(`*   **Escritas tentadas:** \`${result.writesAttempted ? 'SIM' : 'NÃO'}\``);
  lines.push('');

  lines.push('## 2. Saúde do Manifesto');
  lines.push('');
  if (result.manifestHealth) {
    lines.push(`*   **Sets ativos:** \`${result.manifestHealth.activeSetCount}\``);
    lines.push(`*   **setId(s) com múltiplas versões ativas:** \`${result.manifestHealth.activeSetIdsWithMultipleActiveVersions.join(', ') || 'nenhum'}\``);
    lines.push(`*   **recordCount do manifesto confere com sets ativos:** \`${result.manifestHealth.manifestRecordCountMatchesActiveSetCount ? 'SIM' : 'NÃO'}\``);
    lines.push(`*   **Digest recalculado confere com o manifesto:** \`${result.manifestHealth.digestMatchesManifest ? 'SIM' : 'NÃO'}\``);
  } else {
    lines.push('*   Não avaliado (modo `baseline-only` — a leitura do Active V2 nem foi tentada).');
  }
  lines.push('');

  lines.push('## 3. Problemas Encontrados');
  lines.push('');
  if (result.recordIssues.length === 0) {
    lines.push('Nenhum problema encontrado.');
  } else {
    lines.push('| setId | Motivo | Detalhe |');
    lines.push('| :--- | :--- | :--- |');
    result.recordIssues.forEach(issue => {
      lines.push(`| ${issue.setId} | ${issue.reason} | ${issue.detail.replace(/\|/g, '\\|')} |`);
    });
  }
  lines.push('');

  return lines.join('\n');
}
