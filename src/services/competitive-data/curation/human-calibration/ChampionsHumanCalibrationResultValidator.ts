import fs from 'fs';
import path from 'path';
import { ChampionsHumanCalibrationBatch } from './ChampionsHumanCalibrationTypes';
export function validateCalibrationBatch(batchId: string): { valid: boolean; errors: string[]; batch?: ChampionsHumanCalibrationBatch } {
  const file = path.resolve('artifacts/competitive-curation', batchId, 'human-calibration/calibration-batch.json');
  if (!fs.existsSync(file)) return { valid: false, errors: ['CHAMPIONS_HUMAN_CALIBRATION_BATCH_MISSING'] };
  const batch = JSON.parse(fs.readFileSync(file, 'utf8')) as ChampionsHumanCalibrationBatch;
  const errors: string[] = [];
  if (batch.candidateCount !== 20 || batch.reviewItems.length !== 20) errors.push('CHAMPIONS_HUMAN_CALIBRATION_BATCH_INVALID');
  if (new Set(batch.reviewItems.map(item => item.reviewItemId)).size !== 20) errors.push('HUMAN_REVIEW_ITEM_DUPLICATE');
  if (batch.reviewItems.some(item => !item.hiddenDuringBlindReview.agentVerdict || !item.hiddenDuringBlindReview.aggregateScores || !item.hiddenDuringBlindReview.candidatePairPosition || !item.hiddenDuringBlindReview.finalConsolidationRationale)) errors.push('HUMAN_CALIBRATION_BLIND_FIELDS_EXPOSED');
  return { valid: errors.length === 0, errors, batch };
}
