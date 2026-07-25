import fs from 'fs';
import { assertAdversarialFlags } from '../services/competitive-data/curation/adversarial/ChampionsAdversarialAuditRunner';
import { auditFullTeams } from '../services/competitive-data/curation/adversarial/ChampionsFullTeamAudit';
declare const process: { env: Record<string, string | undefined>; exitCode?: number };
try { assertAdversarialFlags(); const root = 'artifacts/champions-curation/mb/champions-mb-sentinel-champions-mb-sentinel-v1'; const result = auditFullTeams(JSON.parse(fs.readFileSync(`${root}/full-team.json`, 'utf8'))); console.log(JSON.stringify(result, null, 2)); if (!result.valid) process.exitCode = 8; } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 2; }
