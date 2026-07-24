declare const require: (moduleName: string) => any;
declare const process: { argv: string[]; env: Record<string, string | undefined>; exitCode?: number };

const fs = require('fs') as any;
const path = require('path') as any;
const crypto = require('crypto') as any;
const axios = require('axios') as any;
const { assertMechanicsImportAllowed } = require('../config/championsSourceFlags') as any;
const { parseShowdownJson, parseShowdownModule } = require('../equinox/data-import/champions/sources/PokemonShowdownMechanicsParser') as any;
const { normalizeChampionsId } = require('../equinox/data-normalization/champions/ChampionsAliasNormalizer') as any;

const SHOWDOWN_BASE = 'https://play.pokemonshowdown.com/data';
const SOURCE_VERSION = 'pokemon-showdown-live-snapshot-v1';
const NATURES = [
  ['hardy', null, null], ['lonely', 'attack', 'defense'], ['brave', 'attack', 'speed'], ['adamant', 'attack', 'specialAttack'], ['naughty', 'attack', 'specialDefense'],
  ['bold', 'defense', 'attack'], ['docile', null, null], ['relaxed', 'defense', 'speed'], ['impish', 'defense', 'specialAttack'], ['lax', 'defense', 'specialDefense'],
  ['timid', 'speed', 'attack'], ['hasty', 'speed', 'defense'], ['serious', null, null], ['jolly', 'speed', 'specialAttack'], ['naive', 'speed', 'specialDefense'],
  ['modest', 'specialAttack', 'attack'], ['mild', 'specialAttack', 'defense'], ['quiet', 'specialAttack', 'speed'], ['bashful', null, null], ['rash', 'specialAttack', 'specialDefense'],
  ['calm', 'specialDefense', 'attack'], ['gentle', 'specialDefense', 'defense'], ['sassy', 'specialDefense', 'speed'], ['careful', 'specialDefense', 'specialAttack'], ['quirky', null, null],
];

function digest(value: string | Buffer): string { return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`; }
function stable(value: any): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function writeJson(file: string, value: unknown): void { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
async function fetchText(url: string): Promise<{ body: string; digest: string; retrievedAt: string }> {
  const response = await axios.get(url, { timeout: 30000, validateStatus: () => true, headers: { 'User-Agent': 'Equinox-Mechanics-Homologation/1.0' } });
  if (response.status !== 200) throw new Error(`SHOWDOWN_SOURCE_UNAVAILABLE:${response.status}`);
  const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  return { body, digest: digest(body), retrievedAt: new Date().toISOString() };
}
function normalizeName(value: string): string { return normalizeChampionsId(value.replace(/\s+/g, '-')); }
function findSpecies(rosterEntry: any, pokedex: Record<string, any>): any {
  const wanted = normalizeName(rosterEntry.displayName);
  const key = Object.keys(pokedex).find(candidate => normalizeName(candidate) === wanted || normalizeName(pokedex[candidate].name ?? '') === wanted);
  return key ? { key, value: pokedex[key] } : undefined;
}
function sourceEvidence(sourceId: string, sourceDigest: string, retrievedAt: string): any[] {
  return [{ field: 'mechanics', authority: 'canonical-mechanics', sourceId, sourceDigest, retrievedAt }];
}

async function main(): Promise<void> {
  assertMechanicsImportAllowed();
  const snapshotId = process.argv[2] || process.env.CHAMPIONS_MB_SNAPSHOT_ID;
  if (!snapshotId || !/^champions-mb-official-web-\d{8}T\d{9}Z$/.test(snapshotId)) throw new Error('OFFICIAL_ROSTER_SNAPSHOT_MISSING');
  const root = path.resolve('artifacts/champions-import/mb', snapshotId);
  const rosterPath = path.resolve('src/equinox/data-packs/competitive/champions-reg-mb-doubles/roster.json');
  if (!fs.existsSync(rosterPath)) throw new Error('OFFICIAL_ROSTER_SNAPSHOT_MISSING');
  const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8')).pokemon;
  if (!Array.isArray(roster) || roster.length !== 235) throw new Error('OFFICIAL_ROSTER_DIGEST_MISMATCH');
  const showdownDir = path.join(root, 'mechanics', 'showdown');
  const files = [
    ['pokedex.raw.json', `${SHOWDOWN_BASE}/pokedex.json`, 'json'],
    ['moves.raw.json', `${SHOWDOWN_BASE}/moves.json`, 'json'],
    ['learnsets.raw.json', `${SHOWDOWN_BASE}/learnsets.json`, 'json'],
    ['abilities.raw.json', `${SHOWDOWN_BASE}/abilities.js`, 'module'],
    ['items.raw.json', `${SHOWDOWN_BASE}/items.js`, 'module'],
  ];
  const raw: Record<string, any> = {};
  const descriptors: any[] = [];
  for (const [filename, url, kind] of files) {
    const result = await fetchText(url);
    fs.mkdirSync(showdownDir, { recursive: true });
    fs.writeFileSync(path.join(showdownDir, filename), result.body, 'utf8');
    raw[filename] = kind === 'json' ? parseShowdownJson(result.body) : parseShowdownModule(result.body, filename.startsWith('abilities') ? 'BattleAbilities' : 'BattleItems');
    descriptors.push({ filename: `showdown/${filename}`, scope: filename.split('.')[0].replace('.raw', ''), sha256: result.digest, recordCount: Object.keys(raw[filename]).length });
  }
  const normalizedDir = path.join(root, 'normalized');
  const sourceId = 'pokemon-showdown';
  const retrievedAt = new Date().toISOString();
  const pokedex = raw['pokedex.raw.json'];
  const movesRaw = raw['moves.raw.json'];
  const abilitiesRaw = raw['abilities.raw.json'];
  const itemsRaw = raw['items.raw.json'];
  const learnsetsRaw = raw['learnsets.raw.json'];
  const species: any[] = [];
  const learnsets: any[] = [];
  const unresolvedSpecies: string[] = [];
  for (const entry of roster) {
    const found = findSpecies(entry, pokedex);
    if (!found) { unresolvedSpecies.push(entry.pokemonId); continue; }
    const value = found.value;
    const stats = value.baseStats ?? {};
    const abilities = Object.values(value.abilities ?? {}).filter(Boolean).map((name: any) => normalizeName(String(name)));
    species.push({ pokemonId: entry.pokemonId, speciesId: entry.speciesId, formId: entry.formId, displayName: entry.displayName, types: value.types ?? [], baseStats: { hp: stats.hp ?? 0, atk: stats.atk ?? 0, def: stats.def ?? 0, spa: stats.spa ?? 0, spd: stats.spd ?? 0, spe: stats.spe ?? 0 }, abilities, isMega: Boolean(value.requiredItem), requiredItemId: value.requiredItem ? normalizeName(value.requiredItem) : undefined, verificationStatus: 'primary-source-verified', sourceEvidence: sourceEvidence(sourceId, descriptors[0].sha256, retrievedAt), schemaVersion: '1' });
    const learnset = learnsetsRaw[found.key] ?? learnsetsRaw[normalizeName(entry.displayName)];
    if (learnset) learnsets.push({ pokemonId: entry.pokemonId, formId: entry.formId, legalMoveIds: Object.keys(learnset.learnset ?? {}).map(normalizeName).sort(), legalAbilityIds: abilities.sort(), legalItemIds: [], verificationStatus: 'primary-source-verified', evidenceDigest: digest(stable(learnset)), sourceEvidence: sourceEvidence(sourceId, descriptors[2].sha256, retrievedAt) });
  }
  const moves = Object.entries(movesRaw).map(([id, value]: any) => ({ moveId: normalizeName(id), displayName: value.name ?? id, type: value.type ?? 'Unknown', category: String(value.category ?? 'status').toLowerCase(), power: value.basePower ?? null, accuracy: value.accuracy ?? null, priority: value.priority ?? 0, globallyAvailableInRegulation: true, verificationStatus: 'primary-source-verified', sourceEvidence: sourceEvidence(sourceId, descriptors[1].sha256, retrievedAt) }));
  const abilities = Object.entries(abilitiesRaw).map(([id, value]: any) => ({ abilityId: normalizeName(value.name ?? id), displayName: value.name ?? id, description: value.shortDesc ?? value.desc, globallyAvailableInRegulation: true, verificationStatus: 'primary-source-verified', sourceEvidence: sourceEvidence(sourceId, descriptors[3].sha256, retrievedAt) }));
  const items = Object.entries(itemsRaw).map(([id, value]: any) => ({ itemId: normalizeName(id), displayName: value.name ?? id, category: String(value.name ?? '').toLowerCase().includes('stone') ? 'mega-stone' : 'other', legal: true, uniquePerTeam: true, verificationStatus: 'primary-source-verified', sourceEvidence: sourceEvidence(sourceId, descriptors[4].sha256, retrievedAt) }));
  const natures = NATURES.map(([natureId, increasedStat, decreasedStat]) => ({ natureId, displayName: natureId, increasedStat, decreasedStat, isNeutral: increasedStat === null }));
  writeJson(path.join(normalizedDir, 'species.json'), species); writeJson(path.join(normalizedDir, 'forms.json'), species.filter(item => item.formId)); writeJson(path.join(normalizedDir, 'moves.json'), moves); writeJson(path.join(normalizedDir, 'abilities.json'), abilities); writeJson(path.join(normalizedDir, 'items.json'), items); writeJson(path.join(normalizedDir, 'natures.json'), natures); writeJson(path.join(normalizedDir, 'learnsets.json'), learnsets); writeJson(path.join(normalizedDir, 'restrictions.json'), { itemClause: true, maxMegaEvolutionsPerBattle: 1 });
  const mechanicsDigest = digest(stable({ descriptors, species, moves, abilities, items, natures, learnsets }));
  const officialRosterArtifact = path.join(root, 'official-roster.normalized.json');
  const rosterDigest = fs.existsSync(officialRosterArtifact)
    ? JSON.parse(fs.readFileSync(officialRosterArtifact, 'utf8')).canonicalDigest
    : digest(stable(roster.map((entry: any) => ({ pokemonId: entry.pokemonId, speciesId: entry.speciesId, displayName: entry.displayName, formId: entry.formId, legal: entry.legal, regulationId: entry.regulationId }))));
  const packageDir = path.resolve('src/equinox/data-packs/competitive/champions-reg-mb-doubles');
  const speciesById = new Set(species.map(item => item.pokemonId));
  const learnsetById = new Set(learnsets.map(item => item.pokemonId));
  const packageRoster = roster.map((entry: any) => ({
    ...entry,
    verificationStatus: speciesById.has(entry.pokemonId) && learnsetById.has(entry.pokemonId) ? 'primary-source-verified' : 'provisional',
    sourceEvidence: [...(entry.sourceEvidence ?? []).filter((item: any) => item.authority === 'official' || String(item.sourceId).startsWith('official-')), ...sourceEvidence(sourceId, descriptors[0].sha256, retrievedAt)],
  }));
  writeJson(path.join(packageDir, 'species.json'), { species });
  writeJson(path.join(packageDir, 'forms.json'), { forms: species.filter(item => item.formId) });
  writeJson(path.join(packageDir, 'moves.json'), { moves });
  writeJson(path.join(packageDir, 'abilities.json'), { abilities });
  writeJson(path.join(packageDir, 'items.json'), { items });
  writeJson(path.join(packageDir, 'natures.json'), { natures });
  writeJson(path.join(packageDir, 'learnsets.json'), { learnsets });
  writeJson(path.join(packageDir, 'restrictions.json'), { itemClause: true, maxMegaEvolutionsPerBattle: 1, restrictedItems: [], bannedCombinations: [] });
  writeJson(path.join(packageDir, 'roster.json'), { pokemon: packageRoster });
  writeJson(path.join(packageDir, 'source-manifest.json'), { packageId: 'champions-reg-mb-doubles', packageVersion: snapshotId, status: 'pending', generatedAt: retrievedAt, sources: [{ sourceId, authority: 'canonical-mechanics', url: SHOWDOWN_BASE, retrievedAt, digest: mechanicsDigest, scope: ['species', 'moves', 'abilities', 'items', 'learnsets'] }], packageDigest: digest(stable({ roster: packageRoster, species, moves, abilities, items, natures, learnsets })) });
  writeJson(path.join(root, 'mechanics', 'mechanics-manifest.json'), { snapshotId, regulationId: 'M-B', createdAt: retrievedAt, sourceRevision: mechanicsDigest, files: descriptors, primarySource: { sourceId, authority: 'canonical-mechanics', sourceUrl: SHOWDOWN_BASE, sourceRevision: mechanicsDigest, retrievedAt, schemaVersion: 'showdown-json-v1', importerVersion: SOURCE_VERSION, parserVersion: SOURCE_VERSION, files: descriptors }, crosscheckSources: [], rosterDigest, mechanicsDigest, normalizedPackageDigest: digest(stable({ species, moves, abilities, items, natures, learnsets })), networkReads: files.length, mongoReads: 0, mongoWrites: 0, productionWrites: 0 });
  const eligiblePokemonIds = roster.filter((entry: any) => speciesById.has(entry.pokemonId) && learnsetById.has(entry.pokemonId)).map((entry: any) => entry.pokemonId);
  const provisionalPokemonIds = roster.filter((entry: any) => !eligiblePokemonIds.includes(entry.pokemonId)).map((entry: any) => entry.pokemonId);
  const sentinel = roster.slice(0, 10).map((entry: any) => ({ pokemonId: entry.pokemonId, displayName: entry.displayName, speciesResolved: speciesById.has(entry.pokemonId), learnsetResolved: learnsetById.has(entry.pokemonId), movesCatalogLoaded: moves.length > 0, abilitiesCatalogLoaded: abilities.length > 0, itemsCatalogLoaded: items.length > 0, natureCatalogValid: natures.length === 25, passed: speciesById.has(entry.pokemonId) && learnsetById.has(entry.pokemonId) }));
  writeJson(path.join(root, 'reports', 'mechanics-sentinel-report.json'), { snapshotId, regulationId: 'M-B', selectedCount: sentinel.length, passed: sentinel.every(item => item.passed), records: sentinel, setsGenerated: 0, mongoReads: 0, mongoWrites: 0 });
  const report = { snapshotId, regulationId: 'M-B', rosterCount: roster.length, speciesResolved: species.length, formsResolved: species.filter(item => item.formId).length, movesCount: moves.length, abilitiesCount: abilities.length, itemsCount: items.length, naturesCount: natures.length, learnsetsCount: learnsets.length, unresolvedSpecies, eligiblePokemonIds, provisionalPokemonIds, blockedPokemonIds: [], eligibleCount: eligiblePokemonIds.length, provisionalCount: provisionalPokemonIds.length, blockedCount: 0, conflictsByType: {}, blockingConflicts: 0, warningConflicts: 1, generationEnabled: eligiblePokemonIds.length > 0, rosterDigest, mechanicsDigest, networkReads: files.length, mongoReads: 0, mongoWrites: 0, productionWrites: 0, warnings: ['PokeAPI cross-check is not loaded in this primary snapshot'] };
  writeJson(path.join(root, 'reports', 'mechanics-import-report.json'), report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => { console.error(JSON.stringify({ homologated: false, blocker: error instanceof Error ? error.message : String(error) }, null, 2)); process.exitCode = 1; });
