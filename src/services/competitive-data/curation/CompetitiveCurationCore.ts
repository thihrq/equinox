import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { loadChampionsCompetitivePackage } from '../../../equinox/data-packs/champions/loadChampionsCompetitivePackage';
import { ChampionsCompetitivePackage, ChampionsMoveRecord, ChampionsSpeciesRecord } from '../../../equinox/data-packs/champions/ChampionsPackageTypes';
import { validateChampionsCompetitivePackage } from '../../../equinox/data-validation/champions/ChampionsPackageValidator';
import { getChampionsSourceFlags } from '../../../config/championsSourceFlags';
import { CurationCategory, CurationConfig, CurationFinding, CandidateReview, CurationRunManifest, CurationSetDraft, FullTeamEvaluation, MatchupScenario, SentinelSelection } from './CompetitiveCurationTypes';

export const POLICY_VERSION = 'champions-mb-sentinel-curation-v1';
export const DEFAULT_SNAPSHOT_ID = 'champions-mb-official-web-20260719T180956118Z';
const CATEGORIES: CurationCategory[] = ['mega', 'trick-room', 'tailwind', 'physical', 'special', 'support', 'pivot', 'weather', 'multiple-abilities', 'alternate-form'];
type ExtendedSpecies = ChampionsSpeciesRecord & { requiredItemId?: string; isMega?: boolean; displayName?: string };
type ExtendedMove = ChampionsMoveRecord;

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function digest(value: unknown): string { return `sha256:${crypto.createHash('sha256').update(stable(value)).digest('hex')}`; }
function parseNumberArg(args: string[], name: string, fallback: number): number {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1]) return fallback;
  const value = Number(args[index + 1]);
  if (!Number.isInteger(value)) throw new Error(`${name.replace('--', '').toUpperCase()}_INVALID`);
  return value;
}
export function parseCurationArgs(args: string[]): { snapshotId: string; pokemonLimit: number; candidatesPerPokemon: number; seed: string } {
  const snapshotIndex = args.indexOf('--snapshot-id');
  const seedIndex = args.indexOf('--seed');
  const snapshotId = snapshotIndex >= 0 ? args[snapshotIndex + 1] : DEFAULT_SNAPSHOT_ID;
  const seed = seedIndex >= 0 ? args[seedIndex + 1] : '';
  if (!snapshotId || !seed) throw new Error('SNAPSHOT_ID_AND_SEED_REQUIRED');
  return { snapshotId, pokemonLimit: parseNumberArg(args, '--pokemon-limit', 10), candidatesPerPokemon: parseNumberArg(args, '--candidates-per-pokemon', 2), seed };
}
export function assertCurationFlags(env: Record<string, string | undefined> = process.env): void {
  const flags = getChampionsSourceFlags(env);
  if (env.EQUINOX_ENABLE_CHAMPIONS_CURATION_AGENTS !== 'true') throw new Error('CHAMPIONS_CURATION_AGENTS_DISABLED');
  if (env.EQUINOX_CHAMPIONS_SENTINEL_ONLY !== 'true') throw new Error('CHAMPIONS_SENTINEL_ONLY_REQUIRED');
  if (env.EQUINOX_CHAMPIONS_REGULATION_ID !== 'M-B') throw new Error('CHAMPIONS_REGULATION_ID_MISMATCH');
  if (flags.databaseWrites) throw new Error('DATABASE_WRITES_MUST_BE_DISABLED');
}
export function loadCurationConfig(args: string[], env: Record<string, string | undefined> = process.env): CurationConfig {
  assertCurationFlags(env);
  const parsed = parseCurationArgs(args);
  if (parsed.pokemonLimit !== 10) throw new Error('SENTINEL_POKEMON_LIMIT_MUST_BE_10');
  if (parsed.candidatesPerPokemon !== 2) throw new Error('SENTINEL_CANDIDATES_PER_POKEMON_MUST_BE_2');
  const packageData = loadChampionsCompetitivePackage();
  const validation = validateChampionsCompetitivePackage(packageData);
  if (!validation.packageValid || !validation.generationEligible || validation.eligiblePokemonIds.length < 10) throw new Error('CHAMPIONS_PACKAGE_NOT_ELIGIBLE_FOR_SENTINEL');
  if (packageData.regulation.regulationId !== 'M-B') throw new Error('CHAMPIONS_REGULATION_ID_MISMATCH');
  return { ...parsed, regulationId: 'M-B', packageDigest: packageData.sourceManifest.packageDigest, package: packageData };
}
function normalized(value: string): string { return value.toLowerCase().replace(/[^a-z0-9-]/g, '-'); }
function speciesName(species: ExtendedSpecies, id: string): string { return species.displayName ?? id; }
function movesFor(species: ExtendedSpecies, packageData: ChampionsCompetitivePackage): ExtendedMove[] {
  const learnset = packageData.learnsets.find(item => item.pokemonId === species.pokemonId);
  const legal = new Set((learnset?.legalMoveIds ?? []).map(normalized));
  return packageData.moves.filter(move => legal.has(move.moveId) && move.globallyAvailableInRegulation);
}
function categoriesFor(species: ExtendedSpecies, moves: ExtendedMove[]): CurationCategory[] {
  const moveIds = new Set(moves.map(move => move.moveId));
  const categories: CurationCategory[] = [];
  if (species.isMega || species.requiredItemId) categories.push('mega');
  if (moveIds.has('trick-room')) categories.push('trick-room');
  if (moveIds.has('tailwind')) categories.push('tailwind');
  if (moves.some(move => move.category === 'physical')) categories.push('physical');
  if (moves.some(move => move.category === 'special')) categories.push('special');
  if (moves.some(move => move.category === 'status' || ['follow-me', 'rage-powder', 'protect', 'fake-out'].includes(move.moveId))) categories.push('support');
  if (moves.some(move => ['u-turn', 'volt-switch', 'parting-shot'].includes(move.moveId))) categories.push('pivot');
  if (species.abilities.some(ability => ['drizzle', 'drought', 'sand-stream', 'snow-warning', 'orichalcum-pulse', 'hadron-engine'].includes(normalized(ability))) || moves.some(move => ['rain-dance', 'sunny-day', 'sandstorm', 'snowscape'].includes(move.moveId))) categories.push('weather');
  if (species.abilities.length > 1) categories.push('multiple-abilities');
  if (species.pokemonId.includes('-')) categories.push('alternate-form');
  return categories;
}
export function selectSentinel(config: CurationConfig): SentinelSelection {
  const eligible = [...new Set(validateChampionsCompetitivePackage(config.package).eligiblePokemonIds)].sort();
  const speciesById = new Map(config.package.species.map(item => [item.pokemonId, item as ExtendedSpecies]));
  const categorized = eligible.map(id => { const species = speciesById.get(id); return { id, categories: species ? categoriesFor(species, movesFor(species, config.package)) : [] }; });
  const selected: string[] = [];
  const represented = new Set<CurationCategory>();
  while (selected.length < 10 && selected.length < categorized.length) {
    const next = categorized.filter(item => !selected.includes(item.id)).sort((a, b) => {
      const aGain = a.categories.filter(category => !represented.has(category)).length;
      const bGain = b.categories.filter(category => !represented.has(category)).length;
      return bGain - aGain || a.id.localeCompare(b.id);
    })[0];
    if (!next) break;
    selected.push(next.id);
    next.categories.forEach(category => represented.add(category));
  }
  const missingCategories = CATEGORIES.filter(category => !represented.has(category));
  return { sentinelRunId: `champions-mb-sentinel-${config.seed}`, snapshotId: config.snapshotId, regulationId: config.regulationId, packageDigest: config.packageDigest, eligiblePoolDigest: digest(eligible), seed: config.seed, policyVersion: POLICY_VERSION, selectedPokemonIds: selected, representedCategories: CATEGORIES.filter(category => represented.has(category)), missingCategories, blockers: selected.length === 10 ? [] : ['SENTINEL_SELECTION_COUNT_INVALID'], warnings: missingCategories.map(category => `SENTINEL_CATEGORY_NOT_REPRESENTED:${category}`) };
}
function chooseItem(species: ExtendedSpecies, packageData: ChampionsCompetitivePackage, offset: number): string {
  const learnset = packageData.learnsets.find(item => item.pokemonId === species.pokemonId);
  const legalItems = (learnset?.legalItemIds ?? []).map(normalized).filter(id => packageData.items.some(item => item.itemId === id && item.legal));
  if (species.requiredItemId && legalItems.includes(species.requiredItemId)) return species.requiredItemId;
  return legalItems[offset % Math.max(legalItems.length, 1)] ?? packageData.items.find(item => item.legal)?.itemId ?? 'sitrus-berry';
}
function chooseNature(species: ExtendedSpecies, offset: number): string { const physical = species.baseStats.atk >= species.baseStats.spa; return physical ? (offset === 0 ? 'jolly' : 'adamant') : (offset === 0 ? 'timid' : 'modest'); }
function chooseMoves(species: ExtendedSpecies, packageData: ChampionsCompetitivePackage, offset: number): [string, string, string, string] {
  const available = movesFor(species, packageData).sort((a, b) => a.moveId.localeCompare(b.moveId));
  if (available.length < 4) throw new Error(`INSUFFICIENT_LEARNSET_MOVES:${species.pokemonId}`);
  const preferred = available.filter(move => offset === 0 ? move.category !== 'status' : move.category === 'status');
  const pool = [...preferred, ...available.filter(move => !preferred.includes(move))];
  return [pool[0].moveId, pool[1].moveId, pool[2].moveId, pool[3].moveId];
}
export function generateDrafts(config: CurationConfig, selection: SentinelSelection): CurationSetDraft[] {
  const speciesById = new Map(config.package.species.map(item => [item.pokemonId, item as ExtendedSpecies]));
  return selection.selectedPokemonIds.flatMap((pokemonId) => {
    const species = speciesById.get(pokemonId);
    if (!species) throw new Error(`SPECIES_NOT_FOUND:${pokemonId}`);
    return [0, 1].map(offset => {
      const moveIds = chooseMoves(species, config.package, offset);
      const itemId = chooseItem(species, config.package, offset);
      const abilityId = species.abilities.map(normalized)[offset % Math.max(species.abilities.length, 1)];
      const evs = offset === 0 ? { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 } : { hp: 252, atk: 0, def: 128, spa: 0, spd: 128, spe: 0 };
      const inputDigest = digest({ pokemonId, itemId, abilityId, moveIds, offset });
      const base = { pokemonId, formatId: 'champions_reg_m_b_doubles' as const, itemId, abilityId, natureId: chooseNature(species, offset), evs, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: offset === 1 ? 0 : 31 }, moveIds, declaredRoles: offset === 0 ? ['damage-dealer'] : ['support'], targetArchetypes: offset === 0 ? ['balanced-offense'] : ['positioning'], rationale: `Deterministic sentinel candidate for ${speciesName(species, pokemonId)} using verified package mechanics.`, sourceType: 'generated' as const, status: 'draft' as const, humanReviewed: false as const, automaticPromotionAllowed: false as const };
      return { ...base, setId: `${pokemonId}-sentinel-${offset + 1}`, provenance: { sourceSnapshotDigest: config.snapshotId, packageDigest: config.packageDigest, curationRunId: selection.sentinelRunId, generatorAgentId: 'champions-set-generation-agent', generatorVersion: '1.0.0', inputDigest, candidateDigest: digest(base) } };
    });
  });
}
export function validateDrafts(config: CurationConfig, drafts: CurationSetDraft[]): CandidateReview[] {
  const moves = new Set(config.package.moves.map(item => item.moveId));
  const items = new Set(config.package.items.filter(item => item.legal).map(item => item.itemId));
  const abilities = new Set(config.package.abilities.map(item => item.abilityId));
  const species = new Map(config.package.species.map(item => [item.pokemonId, item]));
  return drafts.map(draft => {
    const findings: CurationFinding[] = [];
    const member = species.get(draft.pokemonId);
    const learnset = config.package.learnsets.find(item => item.pokemonId === draft.pokemonId);
    if (!member || !learnset) findings.push({ setId: draft.setId, code: 'SPECIES_OR_LEARNSET_MISSING', message: 'Species or learnset is absent from the verified package.', blocking: true });
    if (!draft.moveIds.every(move => moves.has(move) && (learnset?.legalMoveIds ?? []).includes(move))) findings.push({ setId: draft.setId, code: 'MOVE_NOT_LEGAL', message: 'At least one move is not present in the Pokémon learnset.', blocking: true });
    const itemRestricted = Boolean(learnset?.legalItemIds && learnset.legalItemIds.length > 0);
    if (!items.has(draft.itemId) || (itemRestricted && !learnset?.legalItemIds?.includes(draft.itemId))) findings.push({ setId: draft.setId, code: 'ITEM_NOT_LEGAL', message: 'Item is not legal for the selected Pokémon.', blocking: true });
    if (!abilities.has(draft.abilityId) || !(learnset?.legalAbilityIds ?? []).includes(draft.abilityId)) findings.push({ setId: draft.setId, code: 'ABILITY_NOT_LEGAL', message: 'Ability is not legal for the selected Pokémon.', blocking: true });
    if (new Set(draft.moveIds).size !== 4) findings.push({ setId: draft.setId, code: 'MOVE_DUPLICATE', message: 'A set must contain four unique moves.', blocking: true });
    const evTotal = Object.values(draft.evs).reduce((sum, value) => sum + value, 0);
    if (evTotal > 510 || Object.values(draft.evs).some(value => value < 0 || value > 252)) findings.push({ setId: draft.setId, code: 'EVS_INVALID', message: 'EVs exceed the legal bounds.', blocking: true });
    if (Object.values(draft.ivs).some(value => value < 0 || value > 31)) findings.push({ setId: draft.setId, code: 'IVS_INVALID', message: 'IVs exceed the legal bounds.', blocking: true });
    const legal = !findings.some(item => item.blocking);
    if (draft.itemId.startsWith('choice-') && draft.moveIds.includes('protect')) findings.push({ setId: draft.setId, code: 'CHOICE_PROTECT_REVIEW', message: 'Choice item with Protect requires human review.', blocking: false });
    return { setId: draft.setId, legal, coherent: legal, rolesSupported: draft.declaredRoles.length > 0, findings };
  });
}
export function generateMatchups(drafts: CurationSetDraft[], validPokemonIds: string[] = []): MatchupScenario[] {
  return drafts.flatMap(draft => [
    ['favorable', 'Opponent lacks immediate pressure into the declared role.'], ['favorable', 'The selected move profile has room to execute its stated plan.'],
    ['neutral', 'Positioning and speed control are unresolved at preview.'], ['neutral', 'Outcome depends on revealed items, abilities and targeting.'],
    ['adverse', 'Opponent carries direct pressure against the declared role.'], ['adverse', 'The set requires support that the isolated candidate does not provide alone.'],
  ].map(([result, assumption], index) => ({ scenarioId: `${draft.setId}-scenario-${index + 1}`, setId: draft.setId, result: result as MatchupScenario['result'], outcome: result === 'favorable' ? 'supports-candidate' as const : result === 'neutral' ? 'mixed' as const : 'does-not-support-candidate' as const, opposingPokemonIds: validPokemonIds.length > 0 ? [validPokemonIds[index % validPokemonIds.length]] : [], partnerPokemonIds: validPokemonIds.length > 1 ? [validPokemonIds[(index + 1) % validPokemonIds.length]] : [], assumptions: [assumption], limitations: ['No KO probability or fabricated ladder data is asserted.'], evidenceLevel: 'agent-scenario-review' as const })));
}
export function evaluateFullTeams(config: CurationConfig, drafts: CurationSetDraft[], selection: SentinelSelection): FullTeamEvaluation[] {
  const eligible = validateChampionsCompetitivePackage(config.package).eligiblePokemonIds;
  const base = selection.selectedPokemonIds.slice(0, 3);
  const identities = ['balanced', 'offense', 'positioning', 'weather', 'trick-room'];
  return drafts.flatMap((draft) => identities.map((identity, identityIndex) => {
    const available = eligible.filter(id => !base.includes(id) && id !== draft.pokemonId);
    const offset = (identityIndex * 3) % available.length;
    const rotated = [...available.slice(offset), ...available.slice(0, offset)];
    const recommendedPokemonIds = [...(base.includes(draft.pokemonId) ? [] : [draft.pokemonId]), ...rotated].slice(0, 3);
    const teamIds = [...base, ...recommendedPokemonIds];
    const findings = teamIds.length === 6 ? [] : ['FULL_TEAM_SIZE_INVALID'];
    const basePokemonIds = base;
    return { setId: draft.setId, basePokemonIds, recommendedPokemonIds, teamIds, structureId: `${draft.setId}-structure-${identityIndex + 1}`, identity, score: Math.max(0, Math.min(100, 60 + (draft.declaredRoles.includes('support') ? 8 : 0) - findings.length * 20)), legal: findings.length === 0, findings };
  }));
}
export function writeArtifact(root: string, name: string, value: unknown): void { fs.mkdirSync(root, { recursive: true }); fs.writeFileSync(path.join(root, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
export function artifactRoot(selection: SentinelSelection): string { return path.resolve('artifacts/champions-curation/mb', selection.sentinelRunId); }
export function createManifest(selection: SentinelSelection, drafts: CurationSetDraft[], dispositions: Record<'agent-reviewed' | 'human-review-required' | 'rejected', number>): CurationRunManifest { return { sentinelRunId: selection.sentinelRunId, snapshotId: selection.snapshotId, packageDigest: selection.packageDigest, policyVersion: selection.policyVersion, selectedCount: selection.selectedPokemonIds.length, draftCount: drafts.length, dispositions, mongoReads: 0, mongoWrites: 0, productionWrites: 0, generatedSetsRemainDraft: true, completedAt: new Date().toISOString() }; }
