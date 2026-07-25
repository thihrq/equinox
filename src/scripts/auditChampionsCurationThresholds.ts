import { assertAdversarialFlags } from '../services/competitive-data/curation/adversarial/ChampionsAdversarialAuditRunner';
import { auditThresholds } from '../services/competitive-data/curation/adversarial/ChampionsThresholdAudit';
declare const process: { env: Record<string, string | undefined>; exitCode?: number };
try { assertAdversarialFlags(); const result = auditThresholds(); console.log(JSON.stringify(result, null, 2)); if (!result.blockersOverrideScores || !result.evidenceRequirementsEnforced || !result.humanReviewReachable) process.exitCode = 5; } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 2; }
