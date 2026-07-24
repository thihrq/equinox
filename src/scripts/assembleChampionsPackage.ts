declare const require: (moduleName: string) => any;
declare const process: { exitCode?: number };

const fs = require('fs') as any;
const path = require('path') as any;

const root = path.resolve('artifacts/champions-import/mb');
const normalized = path.join(root, 'normalized');
const output = path.join(root, 'assembled-package.json');
const required = ['regulation', 'roster', 'moves', 'abilities', 'items', 'learnsets'];

function fail(message: string): void {
  console.error(`[Equinox] montagem bloqueada: ${message}`);
  process.exitCode = 1;
}

if (!required.every(name => fs.existsSync(path.join(normalized, `${name}.normalized.json`)))) {
  fail('todos os snapshots normalizados sao obrigatorios');
} else {
  const read = (name: string): unknown => JSON.parse(
    fs.readFileSync(path.join(normalized, `${name}.normalized.json`), 'utf8'),
  ).payload;
  const packagePayload = {
    regulation: read('regulation'),
    roster: read('roster'),
    species: [],
    moves: read('moves'),
    abilities: read('abilities'),
    items: read('items'),
    learnsets: read('learnsets'),
    assembledFrom: 'artifacts/champions-import/mb/normalized',
    status: 'pending',
  };

  fs.writeFileSync(output, `${JSON.stringify(packagePayload, null, 2)}\n`, 'utf8');
  console.log(`[Equinox] pacote de trabalho montado em ${output}; status=pending.`);
}
