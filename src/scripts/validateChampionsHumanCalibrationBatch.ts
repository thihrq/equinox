import fs from 'fs';
import path from 'path';
import { assertHumanCalibrationFlags } from '../services/competitive-data/curation/human-calibration/ChampionsHumanCalibrationPolicy';
declare const process: { argv: string[]; env: Record<string, string | undefined>; exitCode?: number };
try {
  assertHumanCalibrationFlags();
  const batchId = process.argv[process.argv.indexOf('--calibration-batch-id') + 1];
  const file = path.resolve('artifacts/competitive-curation', batchId, 'human-calibration/calibration-batch.json');
  if (!batchId || !fs.existsSync(file)) throw new Error('CHAMPIONS_HUMAN_CALIBRATION_BATCH_MISSING');
  const batch = JSON.parse(fs.readFileSync(file, 'utf8')) as { reviewItems: Array<{ reviewItemId: string; hiddenDuringBlindReview: Record<string, boolean> }>; candidateCount: number };
  const valid = batch.candidateCount === 20 && batch.reviewItems.length === 20 && new Set(batch.reviewItems.map(item => item.reviewItemId)).size === 20 && batch.reviewItems.every(item => item.hiddenDuringBlindReview.agentVerdict && item.hiddenDuringBlindReview.aggregateScores && item.hiddenDuringBlindReview.candidatePairPosition && item.hiddenDuringBlindReview.finalConsolidationRationale);
  console.log(JSON.stringify({ valid, candidateCount: batch.candidateCount, reviewItems: batch.reviewItems.length, reviewsPending: 20, state: 'awaiting-human-review', mongoReads: 0, mongoWrites: 0, productionWrites: 0 }, null, 2));
  if (!valid) process.exitCode = 4;
} catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 2; }
