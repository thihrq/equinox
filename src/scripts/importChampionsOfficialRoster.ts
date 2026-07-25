declare const require: (moduleName: string) => any;
declare const process: { argv: string[]; env: Record<string, string | undefined>; exitCode?: number };

const fs = require('fs') as any;
const path = require('path') as any;
const crypto = require('crypto') as any;
const { importChampionsOfficialRoster } = require('../equinox/data-import/champions/sources/ChampionsOfficialRosterSource') as any;

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Informe o caminho do snapshot oficial de roster.');
  process.exitCode = 2;
} else {
  const content = fs.readFileSync(path.resolve(inputPath), 'utf8');
  const roster = importChampionsOfficialRoster(inputPath);
  const snapshotId = process.env.CHAMPIONS_MB_SNAPSHOT_ID ?? new Date().toISOString().replace(/[-:.]/g, '');
  const outputDirectory = path.resolve('artifacts/champions-import/mb', snapshotId);
  fs.mkdirSync(outputDirectory, { recursive: true });
  const digest = `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
  fs.writeFileSync(path.join(outputDirectory, 'official-roster.raw.json'), `${JSON.stringify({
    snapshotId, regulationId: 'M-B', sourceId: 'official-champions-roster-mb', authority: 'official',
    retrievedAt: new Date().toISOString(), rawDigest: digest, payload: { pokemon: roster },
  }, null, 2)}\n`, 'utf8');
  console.log(`[Equinox] roster oficial importado: ${roster.length} registros; digest=${digest}.`);
}
