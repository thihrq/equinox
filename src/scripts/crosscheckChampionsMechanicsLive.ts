declare const require: (moduleName: string) => any;
declare const process: { argv: string[]; env: Record<string, string | undefined>; exitCode?: number };
const fs = require('fs') as any;
const path = require('path') as any;
const axios = require('axios') as any;
const { assertMechanicsImportAllowed } = require('../config/championsSourceFlags') as any;

async function main(): Promise<void> {
  assertMechanicsImportAllowed();
  const snapshotId = process.argv[2];
  if (!snapshotId) throw new Error('OFFICIAL_ROSTER_SNAPSHOT_MISSING');
  const root = path.resolve('artifacts/champions-import/mb', snapshotId);
  const species = JSON.parse(fs.readFileSync(path.join(root, 'normalized', 'species.json'), 'utf8')) as any[];
  const selected = species.slice(0, 10);
  const comparisons: any[] = [];
  for (const item of selected) {
    const dexNumber = Number(String(item.pokemonId).split('-')[0]);
    const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${dexNumber}`, { timeout: 20000, validateStatus: () => true, headers: { 'User-Agent': 'Equinox-Mechanics-Homologation/1.0' } });
    if (response.status !== 200) { comparisons.push({ pokemonId: item.pokemonId, status: 'unavailable', httpStatus: response.status }); continue; }
    const remote = response.data;
    const types = remote.types.map((entry: any) => entry.type.name).sort();
    const localTypes = [...item.types].map((type: string) => type.toLowerCase()).sort();
    const statsMatch = remote.stats.every((entry: any) => {
      const key = ({ hp: 'hp', attack: 'atk', defense: 'def', 'special-attack': 'spa', 'special-defense': 'spd', speed: 'spe' } as any)[entry.stat.name];
      return item.baseStats[key] === entry.base_stat;
    });
    comparisons.push({ pokemonId: item.pokemonId, status: types.join(',') === localTypes.join(',') && statsMatch ? 'consistent' : 'conflict', typesMatch: types.join(',') === localTypes.join(','), statsMatch });
  }
  const report = { snapshotId, sourceId: 'pokeapi', scope: 'sentinel', recordsCompared: comparisons.length, conflicts: comparisons.filter(item => item.status === 'conflict'), unavailable: comparisons.filter(item => item.status === 'unavailable'), comparisons, mongoReads: 0, mongoWrites: 0, productionWrites: 0 };
  fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(root, 'reports', 'mechanics-crosscheck-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(JSON.stringify({ valid: false, blocker: error instanceof Error ? error.message : String(error) }, null, 2)); process.exitCode = 1; });
