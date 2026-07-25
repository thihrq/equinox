import { assertAdversarialFlags } from '../services/competitive-data/curation/adversarial/ChampionsAdversarialAuditRunner';
import { auditPromotionGuards } from '../services/competitive-data/curation/adversarial/ChampionsPromotionGuardAudit';
declare const process: { env: Record<string, string | undefined>; exitCode?: number };
try { assertAdversarialFlags(); const result = auditPromotionGuards('champions-mb-sentinel-champions-mb-sentinel-v1'); console.log(JSON.stringify(result, null, 2)); if (!result.valid) process.exitCode = 9; } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 2; }
