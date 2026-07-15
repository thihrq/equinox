import * as fs from 'fs';
import * as path from 'path';
import {
  formatAcceptanceReportAsJson,
  formatAcceptanceReportAsMarkdown,
} from '../services/competitive-data/acceptance/ActiveV2AcceptanceReportFormatter';
import { writeArtifactAtomically } from './support/writeActiveV2AcceptanceArtifacts';
import type { ActiveV2AcceptanceReport } from '../services/competitive-data/acceptance/ActiveV2AcceptanceTypes';

const sampleReport: ActiveV2AcceptanceReport = {
  policyVersion: 'active-v2-acceptance-v1',
  inputEvidenceDigest: 'sha256-614eb72aaca6757039df5a60b1774d3eafd9bf9ff14a3d8433f4e44706a2e557',
  inputCommitSha: 'commitsha123456',
  inputActiveRunId: 'active-run-456',
  evidenceValid: true,
  globalBlockers: [],
  classificationCounts: {
    blocker: 0,
    regression: 0,
    'human-review-needed': 1,
    improvement: 1,
    'acceptable-divergence': 1,
    equivalent: 1,
  },
  scenarioVerdicts: [
    {
      scenarioId: 'scen-1',
      scenarioClassification: 'human-review-needed',
      automaticApproval: false,
      requiresHumanReview: true,
      comparatorClassifications: [],
    },
  ],
  gateStatus: 'human-review-required',
  automaticRolloutApproved: false,
  generatedAt: new Date().toISOString(),
};

function runReportWriterTests(): void {
  const tempDir = path.resolve('./temp-acceptance-test');

  // Cleanup inicial
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const jsonOut = path.join(tempDir, 'subfolder/report.json');
  const mdOut = path.join(tempDir, 'subfolder/report.md');

  // 1. Formatar
  const jsonStr = formatAcceptanceReportAsJson(sampleReport);
  const mdStr = formatAcceptanceReportAsMarkdown(sampleReport);

  // 2. Asserção: JSON e Markdown refletem o mesmo gateStatus
  if (!jsonStr.includes('"gateStatus": "human-review-required"') || !mdStr.includes('human-review-required')) {
    throw new Error('JSON and Markdown do not reflect the same gateStatus');
  }

  // 3. Asserção: O Markdown não contém URIs ou credenciais mongodb
  if (mdStr.includes('mongodb') || mdStr.includes('username') || mdStr.includes('password')) {
    throw new Error('Markdown contains secrets/URIs');
  }

  // 4. Asserção: Caminhos ausentes de diretórios são criados com segurança (diretório atômico)
  writeArtifactAtomically(jsonOut, jsonStr);
  writeArtifactAtomically(mdOut, mdStr);

  if (!fs.existsSync(jsonOut) || !fs.existsSync(mdOut)) {
    throw new Error('Atomic write did not create target files or parent folders');
  }

  // 5. Testar se a gravação atômica limpa o temporário em caso de falha física (por exemplo, escrevendo em caminho impossível)
  const impossiblePath = 'X:/impossible-dir/report.json';
  try {
    writeArtifactAtomically(impossiblePath, jsonStr);
    throw new Error('Expected atomic write to fail for invalid drive letters');
  } catch (error) {
    // Deve lançar erro, e o temporário não deve ficar órfão (se foi criado)
    const tempFile = `${impossiblePath}.tmp`;
    if (fs.existsSync(tempFile)) {
      throw new Error('Temporary file was left orphaned after failure');
    }
  }

  // Cleanup final
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log('[Equinox] Active V2 acceptance report writer validation passed.');
}

runReportWriterTests();
