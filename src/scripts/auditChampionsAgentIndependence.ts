import { assertAdversarialFlags } from '../services/competitive-data/curation/adversarial/ChampionsAdversarialAuditRunner';
import { auditAgentIndependence } from '../services/competitive-data/curation/adversarial/ChampionsAgentIndependenceAudit';
import { loadPositiveCandidate } from '../services/competitive-data/curation/adversarial/ChampionsAdversarialFixtureFactory';
declare const process: { env: Record<string, string | undefined>; exitCode?: number };
try { assertAdversarialFlags(); const result = auditAgentIndependence(loadPositiveCandidate('champions-mb-sentinel-champions-mb-sentinel-v1')); console.log(JSON.stringify(result, null, 2)); if (!result.passed) process.exitCode = 7; } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 2; }
