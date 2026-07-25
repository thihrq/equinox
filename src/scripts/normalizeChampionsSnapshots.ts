declare const require: (moduleName: string) => any;
declare const process: { exitCode?: number };

const fs = require('fs') as any;
const path = require('path') as any;
const { normalizeChampionsId } = require('../equinox/data-normalization/champions/ChampionsAliasNormalizer') as { normalizeChampionsId: (value: string) => string };

const directory = path.resolve('artifacts/champions-import/mb');
const normalizedDirectory = path.join(directory, 'normalized');
const files = ['regulation', 'roster', 'moves', 'abilities', 'items', 'learnsets'];

if (!fs.existsSync(directory)) {
  console.error('Nenhum snapshot bruto encontrado. Execute sets:champions:snapshots:import primeiro.');
  process.exitCode = 1;
} else {
  fs.mkdirSync(normalizedDirectory, { recursive: true });
  for (const name of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(directory, `${name}.raw.json`), 'utf8'));
    if (name === 'regulation') {
      fs.writeFileSync(path.join(normalizedDirectory, `${name}.normalized.json`), `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
      continue;
    }
    const records = Array.isArray(raw.payload) ? raw.payload : raw.payload[name] ?? raw.payload.pokemon ?? [];
    const normalized = records.map((record: Record<string, unknown>) => ({
      ...record,
      pokemonId: record.pokemonId ? normalizeChampionsId(String(record.pokemonId)) : record.pokemonId,
      moveId: record.moveId ? normalizeChampionsId(String(record.moveId)) : record.moveId,
      abilityId: record.abilityId ? normalizeChampionsId(String(record.abilityId)) : record.abilityId,
      itemId: record.itemId ? normalizeChampionsId(String(record.itemId)) : record.itemId,
    }));
    fs.writeFileSync(path.join(normalizedDirectory, `${name}.normalized.json`), `${JSON.stringify({ ...raw, payload: normalized }, null, 2)}\n`, 'utf8');
  }
  console.log(`[Equinox] snapshots normalizados em ${normalizedDirectory}.`);
}
