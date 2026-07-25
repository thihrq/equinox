declare const require: (moduleName: string) => any;
declare const process: { argv: string[]; env: Record<string, string | undefined>; exitCode?: number };

const fs = require('fs') as any;
const path = require('path') as any;
const crypto = require('crypto') as any;

const snapshotDirectory = process.env.CHAMPIONS_MB_SNAPSHOT_DIR ?? process.argv[2];
const outputDirectory = path.resolve('artifacts/champions-import/mb');
const files = ['regulation', 'roster', 'moves', 'abilities', 'items', 'learnsets'];

if (!snapshotDirectory) {
  console.error('CHAMPIONS_MB_SNAPSHOT_DIR ou primeiro argumento e obrigatorio.');
  process.exitCode = 2;
} else {
  fs.mkdirSync(outputDirectory, { recursive: true });
  for (const name of files) {
    const inputPath = path.resolve(snapshotDirectory, `${name}.json`);
    if (!fs.existsSync(inputPath)) throw new Error(`snapshot ausente: ${inputPath}`);
    const content = fs.readFileSync(inputPath, 'utf8');
    const envelope = {
      sourceId: `champions-mb-${name}`,
      sourceAuthority: name === 'regulation' || name === 'roster' ? 'official' : 'canonical-mechanics',
      retrievedAt: new Date().toISOString(),
      sourceUrl: process.env[`CHAMPIONS_MB_${name.toUpperCase()}_URL`] ?? 'local-supplied-snapshot',
      contentDigest: `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`,
      parserVersion: 'champions-snapshot-import-v1',
      payload: JSON.parse(content),
    };
    fs.writeFileSync(path.join(outputDirectory, `${name}.raw.json`), `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
  }
  console.log(`[Equinox] ${files.length} snapshots brutos importados em ${outputDirectory}.`);
}
