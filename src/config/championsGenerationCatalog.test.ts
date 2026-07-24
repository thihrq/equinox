import { normalizeGenerationAlias, resolveGenerationAlias } from '../services/competitive-data/expert/validators/ChampionsGenerationAliasResolver';
import { resolveFormGeneration, resolveSpeciesGeneration } from '../services/competitive-data/expert/validators/ChampionsGenerationCatalogPolicy';
import { validatePokemonFormGeneration } from '../services/competitive-data/expert/validators/PokemonFormGenerationValidator';
import { validatePokemonGeneration } from '../services/competitive-data/expert/validators/PokemonGenerationValidator';
import { PokemonGenerationCatalogEntry } from '../services/competitive-data/expert/validators/GenerationCatalogTypes';

function assert(condition: boolean, message: string): void { if (!condition) throw new Error(message); }
function entry(overrides: Partial<PokemonGenerationCatalogEntry> = {}): PokemonGenerationCatalogEntry {
  return { pokemonId: '0006-000', speciesId: '0006-000', showdownId: 'charizard', nationalDexNumber: 6, speciesGeneration: 1, formGeneration: 1, introducedGeneration: 1, isBaseSpecies: true, isRegionalForm: false, isMega: false, isAlternativeForm: false, rosterVerified: true, mechanicsVerified: true, verificationStatus: 'primary-source-verified', sourceEvidence: [], entryDigest: 'sha256:test', ...overrides };
}

assert(resolveSpeciesGeneration(6) === 1, 'base species generation failed');
assert(resolveSpeciesGeneration(905) === 8, 'dex catalog generation failed');
assert(resolveFormGeneration('charizard-mega-x', 1) === 6, 'Mega form generation failed');
assert(normalizeGenerationAlias('Raichu (Alolan Form)') === 'raichu-alola', 'regional alias failed');
assert(resolveGenerationAlias('Charizard', new Set(['charizard'])).ambiguous === false, 'valid alias became ambiguous');
assert(resolveGenerationAlias('Rotom', new Set(['rotom', 'rotom-heat'])).ambiguous === false, 'exact alias should win');
assert(resolveGenerationAlias('Unknown', new Set(['unknown-a', 'unknown-b'])).ambiguous === true, 'ambiguous alias not detected');
assert(validatePokemonGeneration(entry()).valid, 'valid generation rejected');
assert(validatePokemonGeneration(entry({ isMega: true, formGeneration: 1 })).blockers.some(item => item.code === 'GENERATION_FORM_MISMATCH'), 'Mega mismatch not blocked');
assert(validatePokemonFormGeneration(entry({ showdownId: 'missing-form', isBaseSpecies: false, isAlternativeForm: true }), new Set(['charizard'])).some(item => item.code === 'FORM_NOT_FOUND'), 'missing form not blocked');
assert(validatePokemonGeneration(entry({ mechanicsVerified: false })).valid, 'missing mechanics should remain provisional, not generation-invalid');
console.log('[Equinox] Champions generation catalog tests passed.');
