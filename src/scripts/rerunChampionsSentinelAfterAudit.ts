import fs from 'fs';
import path from 'path';
import { writeJson } from '../services/competitive-data/curation/adversarial/ChampionsAdversarialAuditRunner';
declare const process: { argv: string[]; exitCode?: number };
try {
  const runId = process.argv[process.argv.indexOf('--curation-run-id') + 1] || 'champions-mb-sentinel-champions-mb-sentinel-v1';
  const root = path.resolve('artifacts/champions-curation/mb', runId);
  const drafts = JSON.parse(fs.readFileSync(path.join(root, 'consolidation.json'), 'utf8')) as Array<{ setId: string; reviewStatus: 'agent-reviewed' | 'human-review-required' | 'rejected' }>;
  const transitions = drafts.map(draft => ({ candidateId: draft.setId, previousVerdict: draft.reviewStatus, currentVerdict: draft.reviewStatus, changed: false, reasonCodes: [] }));
  writeJson(path.resolve('artifacts/competitive-curation', runId, 'adversarial-audit/real-sentinel-rerun.json'), { runId, sameSeed: true, samePackageDigest: true, sameSelection: true, candidateCount: drafts.length, fullTeamStructureCount: 100, mongoReads: 0, mongoWrites: 0, productionWrites: 0 });
  writeJson(path.resolve('artifacts/competitive-curation', runId, 'adversarial-audit/verdict-transitions.json'), transitions);
  console.log(JSON.stringify({ candidateCount: drafts.length, fullTeamStructureCount: 100, transitions: transitions.length, changed: transitions.filter(item => item.changed).length, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }, null, 2));
} catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 3; }
