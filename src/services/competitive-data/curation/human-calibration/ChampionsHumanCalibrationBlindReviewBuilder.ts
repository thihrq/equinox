import { buildCalibrationBatch } from './ChampionsHumanCalibrationBatchBuilder';
export function buildBlindReviewPackage(curationRunId: string, auditRunId: string, seed: string): ReturnType<typeof buildCalibrationBatch>['batch'] { return buildCalibrationBatch(curationRunId, auditRunId, seed).batch; }
