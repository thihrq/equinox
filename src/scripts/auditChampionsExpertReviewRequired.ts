import path from 'path';
import { auditStage4RootCauses } from '../services/competitive-data/expert/Stage4RootCauseAudit';

declare const process: { exitCode?: number };

const root = path.resolve('artifacts/competitive-curation/champions-mb-sentinel-champions-mb-sentinel-v1/expert-validation/champions-mb-expert-validation-v1');
try {
  const result = auditStage4RootCauses(root);
  console.log(JSON.stringify({ valid: true, ...result.summary, candidates: result.candidates }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
