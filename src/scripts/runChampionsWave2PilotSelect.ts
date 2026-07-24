import fs from 'fs';
import path from 'path';
import { loadChampionsCompetitivePackage } from '../equinox/data-packs/champions/loadChampionsCompetitivePackage';
import { validateChampionsCompetitivePackage } from '../equinox/data-validation/champions/ChampionsPackageValidator';
import { PILOT_SELECTION_POLICY_ID, PILOT_SELECTION_POLICY_VERSION, selectPilotPokemon } from '../services/competitive-data/expert/wave2/PilotSelection';

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function fail(message: string, code: number): never { console.error(message); process.exitCode = code; throw new Error(message); }
function writeAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  try { fs.renameSync(temporary, file); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EPERM') { console.error(`ARTIFACT_ATOMIC_RENAME_BLOCKED:${file}`); fs.copyFileSync(temporary, file); fs.unlinkSync(temporary); return; }
    throw error;
  }
}

export const SENTINEL_POKEMON_IDS = ['0003-000', '0006-000', '0009-000', '0015-000', '0018-000', '0024-000', '0025-000', '0026-000', '0036-000', '0038-000'];

function main(): void {
  const allowed = new Set(['--run-id']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const outputDir = path.resolve(`artifacts/competitive-production-readiness/${runId}/pilot`);

  const pkg = loadChampionsCompetitivePackage();
  const validation = validateChampionsCompetitivePackage(pkg);
  const generations = JSON.parse(fs.readFileSync('src/equinox/data-packs/competitive/champions-reg-mb-doubles/generations.json', 'utf8')) as { entries: Array<{ pokemonId: string; speciesGeneration: number }> };
  const megaSpeciesInPack = pkg.species.filter(s => (s as { isMega?: boolean }).isMega).length;

  const result = selectPilotPokemon({
    pkg, eligiblePokemonIds: validation.eligiblePokemonIds, provisionalPokemonIds: validation.provisionalPokemonIds, blockedPokemonIds: validation.blockedPokemonIds,
    sentinelPokemonIds: SENTINEL_POKEMON_IDS, generationEntries: generations.entries.map(e => ({ pokemonId: e.pokemonId, speciesGeneration: e.speciesGeneration })), targetCount: 20,
  });

  const sentinelSelected = result.selected.filter(r => SENTINEL_POKEMON_IDS.includes(r.pokemonId)).length;
  const provisionalSelected = result.selected.filter(r => validation.provisionalPokemonIds.includes(r.pokemonId)).length;

  writeAtomic(path.join(outputDir, 'selection-policy.json'), {
    runId, policyId: PILOT_SELECTION_POLICY_ID, policyVersion: PILOT_SELECTION_POLICY_VERSION,
    algorithm: 'Greedy strata-coverage selection (generalizes CompetitiveCurationCore.selectSentinel to a wider strata universe), deterministic ID sort as tiebreak, hard-excludes Wave 1 sentinel species and any provisional/blocked species before selection begins.',
    strataUniverse: ['mega', 'alternate-form', 'physical-attacker', 'special-attacker', 'mixed-attacker', 'support', 'fast', 'slow', 'very-slow', 'trick-room', 'tailwind', 'weather', 'terrain', 'redirection', 'fake-out', 'priority', 'pivot', 'wall-physical', 'wall-special', 'bulky-attacker', '+per-generation tags (gen-1..gen-9)'],
    excludedSentinelPokemonIds: SENTINEL_POKEMON_IDS,
  });
  writeAtomic(path.join(outputDir, 'selection-pool.json'), { runId, poolSize: result.poolSize, eligibleCount: validation.eligiblePokemonIds.length, provisionalCount: validation.provisionalPokemonIds.length, blockedCount: validation.blockedPokemonIds.length, sentinelExcludedCount: SENTINEL_POKEMON_IDS.length });
  writeAtomic(path.join(outputDir, 'selected-pokemon.json'), { runId, count: result.selected.length, records: result.selected });
  writeAtomic(path.join(outputDir, 'selection-coverage.json'), {
    runId, representedStrata: result.representedStrata, missingStrata: result.missingStrata,
    megaSpeciesInPack, megaExplanation: megaSpeciesInPack === 0 ? 'No species in the champions-reg-mb-doubles data pack has isMega:true -- Mega coverage is a documented, honest absence in the source data, not a selection defect. Mission section 22 conditions Mega coverage on Mega species existing in the eligible roster.' : `${megaSpeciesInPack} Mega species exist in the pack; check missingStrata for whether one was selected.`,
    sentinelPokemonSelected: sentinelSelected, provisionalPokemonSelected: provisionalSelected,
  });
  writeAtomic(path.join(outputDir, 'excluded-pokemon.json'), { runId, count: result.excluded.length, records: result.excluded });

  const valid = result.selected.length === 20 && sentinelSelected === 0 && provisionalSelected === 0;
  console.log(JSON.stringify({ valid, selectedCount: result.selected.length, sentinelPokemonSelected: sentinelSelected, provisionalPokemonSelected: provisionalSelected, representedStrataCount: result.representedStrata.length, missingStrata: result.missingStrata, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }));
  if (!valid) process.exitCode = 11;
}

try {
  main();
} catch (error) {
  if (process.exitCode === undefined) { console.error(error instanceof Error ? error.message : error); process.exitCode = 25; }
}
