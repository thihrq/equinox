import fs from 'fs';
import { assertAdversarialFlags } from '../services/competitive-data/curation/adversarial/ChampionsAdversarialAuditRunner';
import { auditScenarios } from '../services/competitive-data/curation/adversarial/ChampionsScenarioAudit';
declare const process: { env: Record<string, string | undefined>; exitCode?: number };
try { assertAdversarialFlags(); const root = 'artifacts/champions-curation/mb/champions-mb-sentinel-champions-mb-sentinel-v1'; const scenarios = JSON.parse(fs.readFileSync(`${root}/matchups.json`, 'utf8')); const selection = JSON.parse(fs.readFileSync(`${root}/selection.json`, 'utf8')); const result = auditScenarios(scenarios, selection.selectedPokemonIds); console.log(JSON.stringify(result, null, 2)); if (!result.valid) process.exitCode = 1; } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 2; }
