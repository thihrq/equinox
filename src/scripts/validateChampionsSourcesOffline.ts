declare const require: (moduleName: string) => any;
declare const process: { exitCode?: number };

const fs = require('fs') as any;
const path = require('path') as any;

const root = path.resolve('artifacts/champions-import/mb');
const snapshots = fs.readdirSync(root, { withFileTypes: true }).filter((entry: any) => entry.isDirectory() && entry.name.startsWith('champions-mb-official-web-')).map((entry: any) => entry.name).sort();
const snapshot = snapshots.at(-1);
const snapshotRoot = snapshot ? path.join(root, snapshot) : root;
const names = ['pokedex', 'moves', 'abilities', 'items', 'learnsets'];
const missing = names.filter(name => !fs.existsSync(path.join(snapshotRoot, 'mechanics', 'showdown', `${name}.raw.json`)));
const normalizedMissing = ['species', 'moves', 'abilities', 'items', 'learnsets'].filter(name => !fs.existsSync(path.join(snapshotRoot, 'normalized', `${name}.json`)));
const report = {
  mode: 'filesystem',
  snapshotId: snapshot ?? null,
  mongoAccess: false,
  writes: 0,
  rawSnapshots: names.length - missing.length,
  normalizedSnapshots: names.length - normalizedMissing.length,
  missingRawSnapshots: missing,
  missingNormalizedSnapshots: normalizedMissing,
  valid: missing.length === 0 && normalizedMissing.length === 0,
};

console.log(JSON.stringify(report, null, 2));
if (!report.valid) process.exitCode = 1;
