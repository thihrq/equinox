import fs from 'fs';
import path from 'path';
import { loadChampionsCompetitivePackage } from '../equinox/data-packs/champions/loadChampionsCompetitivePackage';
import { validateChampionsCompetitivePackage } from '../equinox/data-validation/champions/ChampionsPackageValidator';
import { validatePokemonFormGeneration } from '../services/competitive-data/expert/validators/PokemonFormGenerationValidator';
import { validatePokemonGeneration } from '../services/competitive-data/expert/validators/PokemonGenerationValidator';
import { ChampionsGenerationCatalog } from '../services/competitive-data/expert/validators/GenerationCatalogTypes';

declare const process: { exitCode?: number };
function assert(condition: boolean, message: string): void { if (!condition) throw new Error(message); }

const catalogPath = path.resolve('src/equinox/data-packs/competitive/champions-reg-mb-doubles/generations.json');
try {
  if (!fs.existsSync(catalogPath)) throw new Error('GENERATION_CATALOG_MISSING');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')) as ChampionsGenerationCatalog;
  const data = loadChampionsCompetitivePackage();
  const packageResult = validateChampionsCompetitivePackage(data);
  const knownShowdownIds = new Set(catalog.entries.map(entry => entry.showdownId));
  const results = catalog.entries.map(entry => ({ generation: validatePokemonGeneration(entry), form: validatePokemonFormGeneration(entry, knownShowdownIds) }));
  const blockers = results.flatMap(result => [...result.generation.blockers, ...result.form.filter(item => item.blocking)]);
  const aliasConflictCount = catalog.entries.filter(entry => entry.verificationStatus === 'conflict').length;
  assert(catalog.entries.length === data.roster.length && catalog.entries.length === 235, 'GENERATION_CATALOG_COUNT_INVALID');
  assert(packageResult.eligiblePokemonIds.length === 203, 'ELIGIBLE_COUNT_CHANGED');
  assert(packageResult.provisionalPokemonIds.length === 32, 'PROVISIONAL_COUNT_CHANGED');
  assert(results.every(result => result.generation.speciesGenerationResolved && result.generation.formGenerationResolved), 'GENERATION_RESOLUTION_INCOMPLETE');
  assert(blockers.length === 0, `GENERATION_BLOCKERS_PRESENT:${blockers.map(item => item.code).join(',')}`);
  assert(aliasConflictCount === 0, 'ALIAS_CONFLICT_PRESENT');
  console.log(JSON.stringify({ valid: true, generationCatalogCount: catalog.entries.length, speciesGenerationsResolved: results.filter(result => result.generation.speciesGenerationResolved).length, formGenerationsResolved: results.filter(result => result.generation.formGenerationResolved).length, crossSourceVerifiedCount: catalog.entries.filter(entry => entry.verificationStatus === 'cross-source-verified').length, primarySourceVerifiedCount: catalog.entries.filter(entry => entry.verificationStatus === 'primary-source-verified').length, provisionalCount: catalog.entries.filter(entry => entry.verificationStatus === 'provisional').length, conflictCount: catalog.entries.filter(entry => entry.verificationStatus === 'conflict').length, aliasConflictCount, eligibleCount: packageResult.eligiblePokemonIds.length, provisionalEligibleCount: packageResult.provisionalPokemonIds.length, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
