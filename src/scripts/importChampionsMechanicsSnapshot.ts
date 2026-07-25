declare const require: (moduleName: string) => any;
declare const process: { argv: string[]; env: Record<string, string | undefined>; exitCode?: number };

const fs = require('fs') as any;
const path = require('path') as any;
const crypto = require('crypto') as any;

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Informe o caminho do snapshot mecanico versionado.');
  process.exitCode = 2;
} else {
  const absolutePath = path.resolve(inputPath);
  if (!fs.existsSync(absolutePath)) {
    console.error('MECHANICS_SOURCE_UNAVAILABLE');
    process.exitCode = 1;
  } else {
    const content = fs.readFileSync(absolutePath, 'utf8');
    const snapshotId = process.env.CHAMPIONS_MB_SNAPSHOT_ID ?? new Date().toISOString().replace(/[-:.]/g, '');
    const outputDirectory = path.resolve('artifacts/champions-import/mb', snapshotId);
    fs.mkdirSync(outputDirectory, { recursive: true });
    const digest = `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
    fs.writeFileSync(path.join(outputDirectory, 'mechanics-showdown.raw.json'), `${JSON.stringify({
      snapshotId, regulationId: 'M-B', sourceId: 'pokemon-showdown', authority: 'canonical-mechanics',
      sourceVersion: process.env.CHAMPIONS_MECHANICS_VERSION ?? 'unversioned-input-rejected-for-release',
      retrievedAt: new Date().toISOString(), rawDigest: digest, payload: JSON.parse(content),
    }, null, 2)}\n`, 'utf8');
    console.log(`[Equinox] snapshot mecanico importado; digest=${digest}.`);
  }
}
