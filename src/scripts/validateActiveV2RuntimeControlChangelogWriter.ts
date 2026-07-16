import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { appendActiveV2RuntimeControlChangelogEntry } from '../services/competitive-data/runtime-control/ActiveV2RuntimeControlChangelogWriter';

async function runTests(): Promise<void> {
  const tempFile = path.join(os.tmpdir(), `active-v2-runtime-flag-changelog-test-${Date.now()}.md`);

  try {
    // --- Caso de Teste 1: primeira escrita cria o arquivo com cabeçalho e uma linha ---
    appendActiveV2RuntimeControlChangelogEntry(
      {
        timestampUtc: '2026-07-15T12:00:00.000Z',
        responsavel: 'operator-1',
        aprovador: null,
        valorAnterior: 'normal',
        valorNovo: 'force-baseline',
        motivo: 'teste de disparo manual',
        canaryCampaignId: null,
        publishRunId: null,
        resultado: 'success',
      },
      tempFile
    );

    const contentAfterFirst = fs.readFileSync(tempFile, 'utf8');
    if (!contentAfterFirst.includes('# Active V2 Runtime Flag Changelog')) {
      throw new Error('Test 1 failed: expected header to be created');
    }
    if (!contentAfterFirst.includes('operator-1')) throw new Error('Test 1 failed: expected first entry to be present');

    // --- Caso de Teste 2: segunda escrita anexa sem sobrescrever a primeira ---
    appendActiveV2RuntimeControlChangelogEntry(
      {
        timestampUtc: '2026-07-15T13:00:00.000Z',
        responsavel: 'approver-1 + approver-2',
        aprovador: 'approver-1, approver-2',
        valorAnterior: 'force-baseline',
        valorNovo: 'normal',
        motivo: 'teste de reativacao | com pipe',
        canaryCampaignId: 'campaign-1',
        publishRunId: 'run-1',
        resultado: 'success',
      },
      tempFile
    );

    const contentAfterSecond = fs.readFileSync(tempFile, 'utf8');
    if (!contentAfterSecond.includes('operator-1')) throw new Error('Test 2 failed: expected first entry to persist');
    if (!contentAfterSecond.includes('approver-1, approver-2')) throw new Error('Test 2 failed: expected second entry to be appended');
    if (!contentAfterSecond.includes('teste de reativacao \\| com pipe')) {
      throw new Error('Test 2 failed: expected pipe character in motivo to be escaped');
    }

    const rowCount = contentAfterSecond.split('\n').filter(line => line.startsWith('| 2026-07-15')).length;
    if (rowCount !== 2) throw new Error(`Test 2 failed: expected 2 data rows, got ${rowCount}`);

    console.log('[Equinox] Active V2 runtime control changelog writer validation passed.');
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
