declare const require: (moduleName: string) => any;
declare const process: { exitCode?: number };

const fs = require('fs') as any;
const path = require('path') as any;
const directory = path.resolve('artifacts/champions-import/mb/normalized');
const outputPath = path.resolve('artifacts/champions-import/mb/cross-source-differences.json');
const required = ['roster', 'moves', 'abilities', 'items', 'learnsets'];

if (!required.every(name => fs.existsSync(path.join(directory, `${name}.normalized.json`)))) {
  console.error('Snapshots normalizados incompletos; cross-check interrompido.');
  process.exitCode = 1;
} else {
  const read = (name: string): any[] => JSON.parse(fs.readFileSync(path.join(directory, `${name}.normalized.json`), 'utf8')).payload;
  const roster = read('roster');
  const learnsets = new Set(read('learnsets').map(item => item.pokemonId));
  const differences = roster
    .filter(item => item.legal === true && !learnsets.has(item.pokemonId))
    .map(item => ({ pokemonId: item.pokemonId, code: 'LEARNSET_EMPTY' }));
  fs.writeFileSync(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), differences }, null, 2)}\n`, 'utf8');
  console.log(`[Equinox] cross-check concluido: ${differences.length} divergencias.`);
}
