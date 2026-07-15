import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { validateActiveV2ShadowEvidence } from '../services/competitive-data/acceptance/ActiveV2AcceptanceEvidenceValidator';
import { classifyActiveV2ShadowReport } from '../services/competitive-data/acceptance/ActiveV2AcceptanceClassifier';
import { ACTIVE_V2_ACCEPTANCE_POLICY_V1 } from '../services/competitive-data/acceptance/ActiveV2AcceptancePolicy';
import { evaluateAcceptanceGates } from '../services/competitive-data/acceptance/ActiveV2AcceptanceGates';
import {
  formatAcceptanceReportAsJson,
  formatAcceptanceReportAsMarkdown,
} from '../services/competitive-data/acceptance/ActiveV2AcceptanceReportFormatter';
import { writeArtifactAtomically } from './support/writeActiveV2AcceptanceArtifacts';
import type { ActiveV2AcceptanceReport } from '../services/competitive-data/acceptance/ActiveV2AcceptanceTypes';

function printUsage(): void {
  console.log('Uso:');
  console.log('  ts-node src/scripts/checkActiveV2Acceptance.ts --input <caminho-shadow-report-json> [--output-json <caminho-json>] [--output-markdown <caminho-md>]');
}

function main(): void {
  const args = process.argv.slice(2);
  let inputPath = '';
  let outputJsonPath = '';
  let outputMarkdownPath = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' || args[i] === '-i') {
      inputPath = args[i + 1] || '';
    } else if (args[i] === '--output-json' || args[i] === '-j') {
      outputJsonPath = args[i + 1] || '';
    } else if (args[i] === '--output-markdown' || args[i] === '-m') {
      outputMarkdownPath = args[i + 1] || '';
    }
  }

  // 1. Argumentos CLI inválidos
  if (!inputPath) {
    console.error('Erro: O parametro obrigadorio --input nao foi informado.');
    printUsage();
    process.exit(2);
  }

  const resolvedInputPath = path.resolve(inputPath);

  // 2. Leitura física e tratamento de arquivo ausente / parse inválido
  if (!fs.existsSync(resolvedInputPath)) {
    console.error(`Erro: O arquivo de entrada "${resolvedInputPath}" nao existe.`);
    process.exit(3);
  }

  let inputBuffer: Buffer;
  try {
    inputBuffer = fs.readFileSync(resolvedInputPath);
  } catch (error) {
    console.error(`Erro ao ler o arquivo "${resolvedInputPath}":`, error);
    process.exit(3);
  }

  let parsedEvidence: any;
  try {
    const cleanJson = inputBuffer.toString('utf8').replace(/^\uFEFF/, '');
    parsedEvidence = JSON.parse(cleanJson);
  } catch (error) {
    console.error(`Erro no parse do JSON do arquivo de entrada:`, error);
    process.exit(3);
  }

  // 3. Calcular hash sha256 do arquivo de entrada
  const digest = 'sha256-' + createHash('sha256').update(inputBuffer).digest('hex');

  // 4. Validar integridade física do relatório
  const validationResult = validateActiveV2ShadowEvidence(parsedEvidence);

  let finalReport: ActiveV2AcceptanceReport;

  if (!validationResult.valid) {
    console.warn('[Equinox] O relatorio de Shadow fornecido e invalido/incompleto.');
    finalReport = {
      policyVersion: ACTIVE_V2_ACCEPTANCE_POLICY_V1.version,
      inputEvidenceDigest: digest,
      inputCommitSha: parsedEvidence?.aggregate?.commitSha || 'unknown',
      inputActiveRunId: parsedEvidence?.aggregate?.activeRunId || 'unknown',
      baselineSourceDigest: parsedEvidence?.aggregate?.baselineSourceDigest || '',
      activeV2DataDigest: parsedEvidence?.aggregate?.activeV2DataDigest || '',
      activeV2RecordCount: parsedEvidence?.aggregate?.activeV2RecordCount || 0,
      activeV2DataDigestAlgorithm: parsedEvidence?.aggregate?.activeV2DataDigestAlgorithm || '',
      evidenceValid: false,
      globalBlockers: [
        {
          classification: 'blocker',
          reasonCode: 'SHADOW_EVIDENCE_INVALID',
          explanation: `Integrity check failed: ${validationResult.errors.join(' | ')}`,
        },
      ],
      classificationCounts: {
        blocker: 1,
        regression: 0,
        'human-review-needed': 0,
        improvement: 0,
        'acceptable-divergence': 0,
        equivalent: 0,
      },
      scenarioVerdicts: [],
      gateStatus: 'rejected',
      automaticRolloutApproved: false,
      generatedAt: new Date().toISOString(),
    };
  } else {
    // Evidência válida executa classificação pura e consolidação dos gates
    const classificationReport = classifyActiveV2ShadowReport(parsedEvidence);
    classificationReport.inputEvidenceDigest = digest;
    finalReport = evaluateAcceptanceGates(classificationReport);
  }

  // 5. Formatar saídas
  const formattedJson = formatAcceptanceReportAsJson(finalReport);
  const formattedMarkdown = formatAcceptanceReportAsMarkdown(finalReport);

  // 6. Escrever relatórios em disco de forma atômica
  if (outputJsonPath) {
    try {
      writeArtifactAtomically(outputJsonPath, formattedJson);
      console.log(`[Equinox] Relatorio JSON escrito com sucesso em: ${path.resolve(outputJsonPath)}`);
    } catch (error) {
      console.error(`Erro ao gravar relatorio JSON em "${outputJsonPath}":`, error);
      process.exit(1);
    }
  }

  if (outputMarkdownPath) {
    try {
      writeArtifactAtomically(outputMarkdownPath, formattedMarkdown);
      console.log(`[Equinox] Relatorio Markdown escrito com sucesso em: ${path.resolve(outputMarkdownPath)}`);
    } catch (error) {
      console.error(`Erro ao gravar relatorio Markdown em "${outputMarkdownPath}":`, error);
      process.exit(1);
    }
  }

  // 7. Imprimir resumo elegante no console
  console.log('\n======================================================');
  console.log('  Active V2 Competitive Acceptance Gates - Veredito  ');
  console.log('======================================================');
  console.log(`* Status Global do Portao: [ ${finalReport.gateStatus.toUpperCase()} ]`);
  console.log(`* Aprovacao de Rollout:     [ ${finalReport.automaticRolloutApproved ? 'APROVADO' : 'REJEITADO'} ]`);
  console.log(`* Digest do Relatorio:     ${finalReport.inputEvidenceDigest}`);
  console.log('------------------------------------------------------');
  console.log('  Contagens de Classificacoes:');
  console.log(`  - Blocker:             ${finalReport.classificationCounts.blocker}`);
  console.log(`  - Regression:          ${finalReport.classificationCounts.regression}`);
  console.log(`  - Human Review Needed: ${finalReport.classificationCounts['human-review-needed']}`);
  console.log(`  - Improvement:         ${finalReport.classificationCounts.improvement}`);
  console.log(`  - Acceptable Div:      ${finalReport.classificationCounts['acceptable-divergence']}`);
  console.log(`  - Equivalent:          ${finalReport.classificationCounts.equivalent}`);
  console.log('======================================================\n');

  // 8. Sair com exit code apropriado do portão
  if (finalReport.gateStatus === 'rejected') {
    process.exit(1);
  } else if (finalReport.gateStatus === 'human-review-required') {
    process.exit(4);
  } else {
    process.exit(0);
  }
}

main();
