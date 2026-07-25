import fs from 'fs';
import path from 'path';
import { DEFAULT_SNAPSHOT_ID } from '../services/competitive-data/curation/CompetitiveCurationCore';
declare const process: { exitCode?: number };
const root = path.resolve('artifacts/champions-curation/mb');
const runs = fs.existsSync(root) ? fs.readdirSync(root).filter(name => fs.statSync(path.join(root, name)).isDirectory()) : [];
const errors: string[] = [];
if (runs.length === 0) errors.push('CURATION_RUN_MISSING');
for (const run of runs) {
  const dir = path.join(root, run);
  for (const file of ['selection.json', 'drafts.json', 'legality.json', 'coherence.json', 'roles.json', 'matchups.json', 'full-team.json', 'audit.json', 'run-manifest.json']) if (!fs.existsSync(path.join(dir, file))) errors.push(`${run}:${file}:MISSING`);
}
console.log(JSON.stringify({ valid: errors.length === 0, runs, expectedSnapshot: DEFAULT_SNAPSHOT_ID, mongoReads: 0, mongoWrites: 0, errors }, null, 2));
if (errors.length > 0) process.exitCode = 1;
