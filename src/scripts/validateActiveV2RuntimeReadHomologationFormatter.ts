import {
  formatRuntimeReadHomologationAsJson,
  formatRuntimeReadHomologationAsMarkdown,
} from '../services/competitive-data/runtime-read/ActiveV2RuntimeReadHomologationFormatter';
import type { ActiveV2RuntimeReadHomologationResult } from '../services/competitive-data/runtime-read/ActiveV2RuntimeReadTypes';

async function runTests(): Promise<void> {
  const result: ActiveV2RuntimeReadHomologationResult = {
    mode: 'active-v2-read',
    approved: false,
    recordCount: 1,
    manifestHealth: {
      activeSetCount: 1,
      activeSetIdsWithMultipleActiveVersions: [],
      activeManifest: { publishRunId: 'run-1', status: 'active', activeV2DataDigest: 'sha256-abc', recordedRecordCount: 1 },
      manifestRecordCountMatchesActiveSetCount: true,
      recomputedActiveV2DataDigest: 'sha256-abc',
      digestMatchesManifest: true,
    },
    recordIssues: [{ setId: 'set-a', reason: 'SCHEMA_INVALID', detail: 'missing item | pipe test' }],
    legacyCollectionAccessed: false,
    writesAttempted: false,
    generatedAt: '2026-07-16T00:00:00.000Z',
  };

  // --- Caso de Teste 1: JSON é um round-trip válido ---
  const json = formatRuntimeReadHomologationAsJson(result);
  const parsed = JSON.parse(json);
  if (parsed.mode !== 'active-v2-read') throw new Error('Test 1 failed: expected mode to round-trip');
  if (parsed.recordIssues.length !== 1) throw new Error('Test 1 failed: expected 1 issue to round-trip');

  // --- Caso de Teste 2: Markdown contém as seções esperadas e escapa pipe ---
  const markdown = formatRuntimeReadHomologationAsMarkdown(result);
  if (!markdown.includes('# Relatório de Auditoria — Active V2 Production Runtime Read Homologation V1')) {
    throw new Error('Test 2 failed: expected title heading');
  }
  if (!markdown.includes('missing item \\| pipe test')) throw new Error('Test 2 failed: expected pipe to be escaped');

  // --- Caso de Teste 3: modo baseline-only sem manifestHealth produz texto de placeholder ---
  const baselineResult: ActiveV2RuntimeReadHomologationResult = { ...result, mode: 'baseline-only', manifestHealth: null, recordIssues: [] };
  const baselineMarkdown = formatRuntimeReadHomologationAsMarkdown(baselineResult);
  if (!baselineMarkdown.includes('Não avaliado (modo `baseline-only`')) {
    throw new Error('Test 3 failed: expected baseline-only placeholder text');
  }
  if (!baselineMarkdown.includes('Nenhum problema encontrado.')) {
    throw new Error('Test 3 failed: expected empty-issues placeholder text');
  }

  console.log('[Equinox] Active V2 runtime read homologation formatter validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
