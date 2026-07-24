declare const require: (moduleName: string) => any;
declare const process: { argv: string[]; exitCode?: number };

const fs = require('fs') as any;
const path = require('path') as any;

const snapshotId = process.argv[2];
if (!snapshotId || !/^champions-mb-roster-\d{8}T\d{9}Z$/.test(snapshotId)) {
  console.error('Use um snapshotId imutavel no formato champions-mb-roster-YYYYMMDDTHHmmssfffZ.');
  process.exitCode = 2;
} else {
  const root = path.resolve('artifacts/champions-import/mb', snapshotId);
  const evidence = path.join(root, 'evidence');
  const mechanics = path.join(root, 'mechanics');
  fs.mkdirSync(evidence, { recursive: true });
  fs.mkdirSync(mechanics, { recursive: true });
  fs.writeFileSync(path.join(root, 'official-roster-ingame-capture.json'), `${JSON.stringify({
    snapshotId, regulationId: 'M-B', capturedAt: '', capturedBy: '', gameVersion: '', locale: '',
    captureComplete: false, entries: [], reviewerAttestations: [],
  }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(root, 'capture-manifest.json'), `${JSON.stringify({
    snapshotId, regulationId: 'M-B', capturedAt: '', locale: '', gameVersion: '', capturedBy: '',
    captureComplete: false, files: [], reviewerAttestations: [],
  }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(mechanics, 'mechanics-manifest.json'), `${JSON.stringify({
    sourceId: '', sourceRevision: '', retrievedAt: '', files: [],
  }, null, 2)}\n`, 'utf8');
  console.log(`[Equinox] esqueleto criado em ${root}; nenhum dado ou hash foi preenchido.`);
}
