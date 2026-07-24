import { loadChampionsCompetitivePackage } from '../equinox/data-packs/champions/loadChampionsCompetitivePackage';
import { validateChampionsCompetitivePackage } from '../equinox/data-validation/champions/ChampionsPackageValidator';
import { selectPilotPokemon } from '../services/competitive-data/expert/wave2/PilotSelection';
import fs from 'fs';

const pkg = loadChampionsCompetitivePackage();
const validation = validateChampionsCompetitivePackage(pkg);
const generations = JSON.parse(fs.readFileSync('src/equinox/data-packs/competitive/champions-reg-mb-doubles/generations.json', 'utf8'));
const SENTINEL_POKEMON_IDS = ['0003-000', '0006-000', '0009-000', '0015-000', '0018-000', '0024-000', '0025-000', '0026-000', '0036-000', '0038-000'];

const result = selectPilotPokemon({
  pkg, eligiblePokemonIds: validation.eligiblePokemonIds, provisionalPokemonIds: validation.provisionalPokemonIds, blockedPokemonIds: validation.blockedPokemonIds,
  sentinelPokemonIds: SENTINEL_POKEMON_IDS, generationEntries: generations.entries.map((e: { pokemonId: string; speciesGeneration: number }) => ({ pokemonId: e.pokemonId, speciesGeneration: e.speciesGeneration })), targetCount: 20,
});

if (result.selected.length !== 20) throw new Error(`WAVE2_PILOT_SELECTION_COUNT_WRONG: got ${result.selected.length}`);
for (const record of result.selected) {
  if (SENTINEL_POKEMON_IDS.includes(record.pokemonId)) throw new Error(`WAVE2_PILOT_SENTINEL_SPECIES_SELECTED:${record.pokemonId}`);
  if (validation.provisionalPokemonIds.includes(record.pokemonId)) throw new Error(`WAVE2_PILOT_PROVISIONAL_SELECTED:${record.pokemonId}`);
  if (validation.blockedPokemonIds.includes(record.pokemonId)) throw new Error(`WAVE2_PILOT_BLOCKED_SELECTED:${record.pokemonId}`);
}
const distinctIds = new Set(result.selected.map(r => r.pokemonId));
if (distinctIds.size !== 20) throw new Error('WAVE2_PILOT_SELECTION_DUPLICATE_POKEMON');

// Determinism: running again with the same inputs must produce the same 20 species.
const result2 = selectPilotPokemon({ pkg, eligiblePokemonIds: validation.eligiblePokemonIds, provisionalPokemonIds: validation.provisionalPokemonIds, blockedPokemonIds: validation.blockedPokemonIds, sentinelPokemonIds: SENTINEL_POKEMON_IDS, generationEntries: generations.entries.map((e: { pokemonId: string; speciesGeneration: number }) => ({ pokemonId: e.pokemonId, speciesGeneration: e.speciesGeneration })), targetCount: 20 });
if (JSON.stringify(result.selected.map(r => r.pokemonId)) !== JSON.stringify(result2.selected.map(r => r.pokemonId))) throw new Error('WAVE2_PILOT_SELECTION_NOT_DETERMINISTIC');

console.log('wave2 pilot selection tests passed', JSON.stringify({ selectedCount: result.selected.length, representedStrataCount: result.representedStrata.length, missingStrata: result.missingStrata, poolSize: result.poolSize }));
