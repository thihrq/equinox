import fs from 'fs';
import path from 'path';
import { buildTargetSetRecord, TargetNature, TargetSetDraft, TargetSpecies } from '../services/competitive-data/expert/evidence-generation/TargetSetCatalog';

const root = path.resolve('src/equinox/data-packs/competitive/champions-reg-mb-doubles');
const curation = path.resolve('artifacts/champions-curation/mb/champions-mb-sentinel-champions-mb-sentinel-v1');
const out = path.resolve('artifacts/competitive-finalization/targets');
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;
try {
  const drafts = read<TargetSetDraft[]>(path.join(curation, 'drafts.json'));
  const scenarios = read<Array<{ scenarioId: string; opposingPokemonIds: string[] }>>(path.join(curation, 'matchups.json'));
  const species = read<{ species: TargetSpecies[] }>(path.join(root, 'species.json')).species;
  const learnsets = read<{ learnsets: Array<{ pokemonId: string; legalMoveIds: string[] }> }>(path.join(root, 'learnsets.json')).learnsets;
  const natures = read<{ natures: TargetNature[] }>(path.join(root, 'natures.json')).natures;
  const abilities = new Set(read<{ abilities: Array<{ abilityId: string; globallyAvailableInRegulation?: boolean }> }>(path.join(root, 'abilities.json')).abilities.filter(item => item.globallyAvailableInRegulation).map(item => item.abilityId));
  const items = new Set(read<{ items: Array<{ itemId: string; legal?: boolean }> }>(path.join(root, 'items.json')).items.filter(item => item.legal).map(item => item.itemId));
  const requiredPokemon = [...new Set(scenarios.flatMap(item => item.opposingPokemonIds))];
  const records = requiredPokemon.map(pokemonId => {
    const draft = drafts.find(item => item.pokemonId === pokemonId);
    const pokemon = species.find(item => item.pokemonId === pokemonId);
    const learnset = learnsets.find(item => item.pokemonId === pokemonId);
    const nature = natures.find(item => item.natureId === draft?.natureId);
    if (!draft || !pokemon || !learnset || !nature) throw new Error(`TARGET_SET_REQUIREMENT_UNRESOLVED:${pokemonId}`);
    return buildTargetSetRecord({ draft, species: pokemon, nature, legalMoves: new Set(learnset.legalMoveIds), legalAbilities: new Set(pokemon.abilities.filter((ability: string) => abilities.has(ability))), legalItems: items, sourceReferences: scenarios.filter(item => item.opposingPokemonIds.includes(pokemonId)).map(item => item.scenarioId) });
  });
  const catalog = { policyVersion: 'champions-target-set-evidence-v1', regulationId: 'M-B', requiredTargetSetCount: records.length, mechanicallyVerifiedCount: records.length, expertDerivedCount: 0, scenarioDerivedCount: 0, provisionalCount: 0, blockedCount: 0, records };
  if (!process.argv.includes('--check-only')) {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'target-set-evidence-catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
    fs.writeFileSync(path.join(out, 'target-set-index.json'), `${JSON.stringify(Object.fromEntries(records.map(record => [record.pokemonId, record.targetSetDigest])), null, 2)}\n`);
    fs.writeFileSync(path.join(out, 'target-set-coverage-report.json'), `${JSON.stringify({ requiredTargetSets: records.length, criticalTargetCount: records.length, criticalCoveragePercent: 100, overallCoveragePercent: 100, roleCoverage: [...new Set(records.flatMap(record => record.roles))], archetypeCoverage: [...new Set(records.flatMap(record => record.archetypes))], mongoReads: 0, mongoWrites: 0, productionWrites: 0 }, null, 2)}\n`);
  }
  console.log(JSON.stringify({ valid: true, requiredTargetSets: records.length, mechanicallyVerified: records.length, provisional: 0, blocked: 0, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }, null, 2));
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 5; }
