import fs from 'fs';
import { buildCalibrationBatch, writeCalibrationArtifact } from '../services/competitive-data/curation/human-calibration/ChampionsHumanCalibrationBatchBuilder';
import { assertHumanCalibrationFlags } from '../services/competitive-data/curation/human-calibration/ChampionsHumanCalibrationPolicy';
declare const process: { argv: string[]; env: Record<string, string | undefined>; exitCode?: number };
function arg(name: string, fallback = ''): string { const index = process.argv.indexOf(name); return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback; }
try {
  assertHumanCalibrationFlags();
  const curationRunId = arg('--curation-run-id', 'champions-mb-sentinel-champions-mb-sentinel-v1');
  const auditRunId = arg('--audit-run-id', 'champions-mb-adversarial-champions-mb-adversarial-v1');
  const seed = arg('--seed', 'champions-mb-human-calibration-v1');
  const mode = arg('--review-mode', 'single-reviewer');
  if (mode !== 'single-reviewer' && mode !== 'dual-reviewer') throw new Error('HUMAN_CALIBRATION_REVIEW_MODE_INVALID');
  const result = buildCalibrationBatch(curationRunId, auditRunId, seed);
  writeCalibrationArtifact(result.batch.calibrationBatchId, 'calibration-batch.json', result.batch);
  writeCalibrationArtifact(result.batch.calibrationBatchId, 'internal-mapping.json', result.internalMapping);
  writeCalibrationArtifact(result.batch.calibrationBatchId, 'calibration-run-manifest.json', { ...result.manifest, reviewMode: mode });
  const blindReviewItems = result.batch.reviewItems.map(({ hiddenDuringBlindReview: _hidden, ...item }) => item);
  writeCalibrationArtifact(result.batch.calibrationBatchId, 'blind-review-package.json', { calibrationBatchId: result.batch.calibrationBatchId, regulationId: result.batch.regulationId, reviewPolicyVersion: result.batch.reviewPolicyVersion, anonymizationVersion: result.batch.anonymizationVersion, reviewOrderSeed: result.batch.reviewOrderSeed, candidateCount: result.batch.candidateCount, reviewItems: blindReviewItems });
  writeCalibrationArtifact(result.batch.calibrationBatchId, 'review-form.json', { schemaVersion: '1', calibrationBatchId: result.batch.calibrationBatchId, requiredFields: ['reviewId', 'reviewItemId', 'candidateId', 'candidateDigest', 'reviewerId', 'reviewerRole', 'humanVerdict', 'confidence', 'legalityConfirmed', 'coherenceConfirmed', 'abilityConfirmed', 'itemConfirmed', 'natureConfirmed', 'evSpreadConfirmed', 'ivSpreadConfirmed', 'movesConfirmed', 'roleConfirmed', 'archetypeFitConfirmed', 'fullTeamFitConfirmed', 'matchupAssessmentConfirmed', 'findings', 'suggestedChanges', 'reviewNotes', 'reviewedAt', 'attestation'], allowedVerdicts: ['approved', 'revise', 'rejected'], allowedConfidence: ['high', 'medium', 'low'], note: 'Preencha somente com avaliacao humana real. Nao use verdict de agente.' });
  const instructions = `# Revisao humana Champions M-B\n\nBatch: ${result.batch.calibrationBatchId}\n\nAvalie os 20 itens no arquivo blind-review-package.json. Use a Regulation M-B e registre uma resposta por item no formato review-form.json.\n\nNao altere moves, item, ability, nature, EVs, IVs ou candidateDigest. Nao presuma que ausencia de problema seja aprovacao. Para cada item, informe verdict, confianca, campos confirmados, findings, notas e attestation.\n\nA revisao deve ser realizada por uma pessoa. O campo performedByHuman deve ser true e agentGeneratedDecision deve ser false.\n\nDepois salve o JSON de respostas fora do pacote cego e importe-o somente pelo comando documentado.\n`;
  const root = `artifacts/competitive-curation/${result.batch.calibrationBatchId}/human-calibration`;
  fs.writeFileSync(`${root}/review-instructions.md`, instructions, 'utf8');
  fs.writeFileSync(`${root}/review-package.md`, `# Pacote de revisao humana\n\nItens: 20\nEstado: awaiting-human-review\n\nUse o JSON cego e as instrucoes anexas. Verdicts de agentes, scores agregados e posicao do candidato nao fazem parte deste pacote.\n`, 'utf8');
  console.log(JSON.stringify({ calibrationBatchId: result.batch.calibrationBatchId, state: 'awaiting-human-review', reviewsPending: 20, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }, null, 2));
  process.exitCode = 20;
} catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 3; }
