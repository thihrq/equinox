import * as fs from 'fs';
import * as path from 'path';
import { writeArtifactAtomically } from '../../../scripts/support/writeActiveV2AcceptanceArtifacts';
import { ACTIVE_V2_RUNTIME_CONTROL_POLICY_V1 } from './ActiveV2RuntimeControlPolicy';
import type { ActiveV2RuntimeControlChangelogEntry } from './ActiveV2RuntimeControlTypes';

const HEADER = [
  '# Active V2 Runtime Flag Changelog',
  '',
  'Registro obrigatório (adendo 4.2) de toda mudança de estado do circuit breaker dinâmico',
  '(`active-v2-runtime-control`). Uma linha por mudança — nunca editar linhas existentes,',
  'apenas anexar.',
  '',
  '| Timestamp UTC | Responsável | Aprovador | Valor Anterior | Valor Novo | Motivo | Canary Campaign ID | Publish Run ID | Resultado |',
  '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
].join('\n');

function formatEntryAsRow(entry: ActiveV2RuntimeControlChangelogEntry): string {
  const escape = (value: string) => value.replace(/\|/g, '\\|');
  return `| ${entry.timestampUtc} | ${escape(entry.responsavel)} | ${entry.aprovador ? escape(entry.aprovador) : 'n/a'} | ${entry.valorAnterior} | ${entry.valorNovo} | ${escape(entry.motivo)} | ${entry.canaryCampaignId ?? 'n/a'} | ${entry.publishRunId ?? 'n/a'} | ${entry.resultado} |`;
}

/**
 * Anexa uma entrada ao changelog versionado obrigatório de mudanças de flag/estado
 * do circuit breaker. Cria o arquivo com cabeçalho se ainda não existir.
 */
export function appendActiveV2RuntimeControlChangelogEntry(
  entry: ActiveV2RuntimeControlChangelogEntry,
  filePath: string = ACTIVE_V2_RUNTIME_CONTROL_POLICY_V1.changelogPath
): void {
  const resolvedPath = path.resolve(filePath);
  const existingContent = fs.existsSync(resolvedPath) ? fs.readFileSync(resolvedPath, 'utf8').trimEnd() : HEADER;
  const newContent = `${existingContent}\n${formatEntryAsRow(entry)}\n`;
  writeArtifactAtomically(resolvedPath, newContent);
}
