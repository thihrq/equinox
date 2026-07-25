import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { loadChampionsCompetitivePackage } from '../equinox/data-packs/champions/loadChampionsCompetitivePackage';
import { ChampionsRosterEntry } from '../equinox/data-packs/champions/ChampionsPackageTypes';
import { digest } from '../services/competitive-data/curation/CompetitiveCurationCore';
import { DEFAULT_SNAPSHOT_ID } from '../services/competitive-data/curation/CompetitiveCurationCore';
import { canonicalizeShowdownId, normalizeGenerationAlias, resolveGenerationAlias } from '../services/competitive-data/expert/validators/ChampionsGenerationAliasResolver';
import { GENERATION_CATALOG_SCHEMA_VERSION, GENERATION_CATALOG_SOURCE_REVISION, resolveFormGeneration, resolveSpeciesGeneration } from '../services/competitive-data/expert/validators/ChampionsGenerationCatalogPolicy';
import { ChampionsGenerationCatalog, PokemonGenerationCatalogEntry } from '../services/competitive-data/expert/validators/GenerationCatalogTypes';

interface ShowdownPokedexEntry {
  num: number;
  name: string;
  baseSpecies?: string;
  forme?: string;
}

interface ShowdownPokedex {
  [id: string]: ShowdownPokedexEntry;
}

function readPokedex(snapshotId: string): ShowdownPokedex {
  const file = path.resolve('artifacts/champions-import/mb', snapshotId, 'mechanics/showdown/pokedex.raw.json');
  if (!fs.existsSync(file)) throw new Error('GENERATION_MECHANICS_SNAPSHOT_MISSING');
  return JSON.parse(fs.readFileSync(file, 'utf8')) as ShowdownPokedex;
}

function sourceEvidence(sourceId: string, sourceRevision: string, input: string, result: string, description: string) {
  return { evidenceId: `${sourceId}:${input}`, kind: 'source' as const, sourceId, sourceRevision, inputDigest: digest(input), resultDigest: digest(result), description };
}

function formFlags(showdownId: string, entry: ShowdownPokedexEntry): Pick<PokemonGenerationCatalogEntry, 'isBaseSpecies' | 'isRegionalForm' | 'isMega' | 'isAlternativeForm'> {
  const canonicalId = canonicalizeShowdownId(showdownId);
  const isMega = canonicalId.includes('-mega');
  const isRegionalForm = /-(alola|galar|hisui|paldea)/.test(canonicalId);
  const isBaseSpecies = !entry.baseSpecies && !entry.forme;
  return { isBaseSpecies, isRegionalForm, isMega, isAlternativeForm: !isBaseSpecies && !isMega && !isRegionalForm };
}

function resolveShowdownId(rosterEntry: ChampionsRosterEntry, availableIds: ReadonlySet<string>): string {
  const resolution = resolveGenerationAlias(rosterEntry.displayName, availableIds);
  if (!resolution.showdownId || resolution.ambiguous) throw new Error(`GENERATION_ALIAS_${resolution.ambiguous ? 'AMBIGUOUS' : 'UNRESOLVED'}:${rosterEntry.pokemonId}`);
  return resolution.showdownId;
}

function buildEntry(rosterEntry: ChampionsRosterEntry, pokedex: ShowdownPokedex, availableIds: ReadonlySet<string>, packageDigest: string, mechanicsRevision: string, learnsetIds: ReadonlySet<string>, speciesIds: ReadonlySet<string>): PokemonGenerationCatalogEntry {
  const showdownId = resolveShowdownId(rosterEntry, availableIds);
  const showdownEntry = pokedex[showdownId];
  if (!showdownEntry) throw new Error(`GENERATION_SOURCE_NOT_FOUND:${rosterEntry.pokemonId}`);
  const baseCanonicalId = showdownEntry.baseSpecies ? normalizeGenerationAlias(showdownEntry.baseSpecies) : canonicalizeShowdownId(showdownId);
  const baseShowdownId = [...availableIds].find(id => canonicalizeShowdownId(id) === baseCanonicalId);
  const baseEntry = (baseShowdownId ? pokedex[baseShowdownId] : undefined) ?? showdownEntry;
  const speciesGeneration = resolveSpeciesGeneration(baseEntry.num);
  if (!speciesGeneration) throw new Error(`SPECIES_GENERATION_UNRESOLVED:${rosterEntry.pokemonId}`);
  const canonicalId = canonicalizeShowdownId(showdownId);
  const formGeneration = resolveFormGeneration(canonicalId, speciesGeneration);
  const flags = formFlags(showdownId, showdownEntry);
  const rosterVerified = rosterEntry.legal && rosterEntry.regulationId === 'M-B';
  const mechanicsVerified = speciesIds.has(rosterEntry.speciesId) && learnsetIds.has(rosterEntry.pokemonId) && rosterEntry.verificationStatus !== 'provisional';
  const status: PokemonGenerationCatalogEntry['verificationStatus'] = rosterEntry.verificationStatus === 'provisional' ? 'provisional' : 'primary-source-verified';
  const entryWithoutDigest = {
    pokemonId: rosterEntry.pokemonId,
    speciesId: rosterEntry.speciesId,
    showdownId,
    nationalDexNumber: showdownEntry.num,
    speciesGeneration,
    formGeneration,
    introducedGeneration: formGeneration,
    ...flags,
    rosterVerified,
    mechanicsVerified,
    verificationStatus: status,
    sourceEvidence: [
      sourceEvidence('pokemon-showdown', mechanicsRevision, canonicalId, `${showdownEntry.num}:${showdownEntry.name}`, 'Showdown snapshot resolves species/form identity and national dex number.'),
      sourceEvidence('equinox-generation-catalog', GENERATION_CATALOG_SOURCE_REVISION, canonicalId, `${speciesGeneration}:${formGeneration}`, 'Versioned generation catalog resolves species, form, and introduction generations.'),
      sourceEvidence('official-champions-roster', packageDigest, rosterEntry.pokemonId, rosterEntry.verificationStatus, 'Official Champions roster controls seasonal permission.'),
    ],
  };
  return { ...entryWithoutDigest, entryDigest: digest(entryWithoutDigest) };
}

function main(): void {
  const snapshotFlagIndex = process.argv.indexOf('--snapshot-id');
  const snapshotId = snapshotFlagIndex >= 0 ? process.argv[snapshotFlagIndex + 1] : DEFAULT_SNAPSHOT_ID;
  const data = loadChampionsCompetitivePackage();
  const pokedex = readPokedex(snapshotId);
  const availableIds = new Set(Object.keys(pokedex));
  const packageDigest = data.sourceManifest.packageDigest;
  const mechanicsRevision = data.sourceManifest.sources.find(source => source.sourceId === 'pokemon-showdown')?.digest ?? 'missing';
  const entries = data.roster.map(entry => buildEntry(entry, pokedex, availableIds, packageDigest, mechanicsRevision, new Set(data.learnsets.map(item => item.pokemonId)), new Set(data.species.map(item => item.pokemonId))));
  const catalog: ChampionsGenerationCatalog = {
    catalogVersion: GENERATION_CATALOG_SCHEMA_VERSION,
    sourceRevision: GENERATION_CATALOG_SOURCE_REVISION,
    packageDigest,
    mechanicsSourceRevision: mechanicsRevision,
    entries,
    catalogDigest: digest(entries),
  };
  const output = path.resolve('src/equinox/data-packs/competitive/champions-reg-mb-doubles/generations.json');
  fs.writeFileSync(output, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(JSON.stringify({ output, generationCatalogCount: entries.length, speciesGenerationsResolved: entries.filter(item => Boolean(item.speciesGeneration)).length, formGenerationsResolved: entries.filter(item => Boolean(item.formGeneration)).length, crossSourceVerifiedCount: entries.filter(item => item.verificationStatus === 'cross-source-verified').length, primarySourceVerifiedCount: entries.filter(item => item.verificationStatus === 'primary-source-verified').length, provisionalCount: entries.filter(item => item.verificationStatus === 'provisional').length, conflictCount: entries.filter(item => item.verificationStatus === 'conflict').length, aliasConflictCount: 0, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }, null, 2));
}

main();
