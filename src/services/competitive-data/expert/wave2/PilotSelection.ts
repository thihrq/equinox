// Wave 2 -- deterministic, stratified selection of 20 real Pokemon outside the Wave 1 sentinel
// (mission section 22). Generalizes CompetitiveCurationCore.selectSentinel()'s greedy
// category-coverage algorithm (already an accepted, real pattern in this codebase) to the wider
// strata list the mission requires, and hard-excludes sentinel species and any provisional/blocked
// species -- exclusions are asserted, not merely hoped for.
import { ChampionsCompetitivePackage } from '../../../../equinox/data-packs/champions/ChampionsPackageTypes';
import { buildSpeciesMoveContext, classifyStrata, maxCalculatedSpeed, PokemonStrata } from './PokemonProfileClassifier';

export interface GenerationEntry { pokemonId: string; speciesGeneration: number; }
export interface PilotSelectionInput {
  pkg: ChampionsCompetitivePackage;
  eligiblePokemonIds: string[];
  provisionalPokemonIds: string[];
  blockedPokemonIds: string[];
  sentinelPokemonIds: string[];
  generationEntries: GenerationEntry[];
  targetCount: number;
}
export interface PilotSelectionRecord { pokemonId: string; reasonCode: string; strataMatched: string[]; generation: number | null; speedClass: string; isMega: boolean; }
export interface PilotExclusionRecord { pokemonId: string; reasonCode: 'SENTINEL_SPECIES_EXCLUDED' | 'PROVISIONAL_EXCLUDED' | 'BLOCKED_EXCLUDED' | 'NOT_SELECTED_COVERAGE_ALREADY_SATISFIED'; }
export interface PilotSelectionResult { selected: PilotSelectionRecord[]; excluded: PilotExclusionRecord[]; representedStrata: string[]; missingStrata: string[]; poolSize: number; }

export const PILOT_SELECTION_POLICY_ID = 'wave2-pilot-selection-policy';
export const PILOT_SELECTION_POLICY_VERSION = 'wave2-pilot-selection-v1';

const STRATA_UNIVERSE = [
  'mega', 'alternate-form', 'physical-attacker', 'special-attacker', 'mixed-attacker', 'support',
  'fast', 'slow', 'very-slow', 'trick-room', 'tailwind', 'weather', 'terrain', 'redirection',
  'fake-out', 'priority', 'pivot', 'wall-physical', 'wall-special', 'bulky-attacker',
] as const;

function strataFor(strata: PokemonStrata, hasSupportSignal: boolean, generation: number | null): string[] {
  const tags: string[] = [];
  if (strata.isMega) tags.push('mega');
  if (strata.pokemonId.includes('-') && strata.pokemonId.split('-')[1] !== '000') tags.push('alternate-form');
  if (strata.physicalAttacker) tags.push('physical-attacker');
  if (strata.specialAttacker) tags.push('special-attacker');
  if (strata.mixedAttacker) tags.push('mixed-attacker');
  if (hasSupportSignal) tags.push('support');
  if (strata.fastSpeed) tags.push('fast');
  if (strata.slowSpeed) tags.push('slow');
  if (strata.verySlowSpeed) tags.push('very-slow');
  if (strata.trickRoomCapable) tags.push('trick-room');
  if (strata.tailwindCapable) tags.push('tailwind');
  if (strata.weatherSetter) tags.push('weather');
  if (strata.terrainSetter) tags.push('terrain');
  if (strata.redirectionCapable) tags.push('redirection');
  if (strata.fakeOutCapable) tags.push('fake-out');
  if (strata.priorityCapable) tags.push('priority');
  if (strata.pivotCapable) tags.push('pivot');
  if (strata.wallPhysical) tags.push('wall-physical');
  if (strata.wallSpecial) tags.push('wall-special');
  if ((strata.wallPhysical || strata.wallSpecial) && (strata.physicalAttacker || strata.specialAttacker)) tags.push('bulky-attacker');
  if (generation !== null) tags.push(`gen-${generation}`);
  return tags;
}

export function selectPilotPokemon(input: PilotSelectionInput): PilotSelectionResult {
  const { pkg, eligiblePokemonIds, provisionalPokemonIds, blockedPokemonIds, sentinelPokemonIds, generationEntries, targetCount } = input;
  const speciesById = new Map(pkg.species.map(s => [s.pokemonId, s]));
  const generationByPokemonId = new Map(generationEntries.map(e => [e.pokemonId, e.speciesGeneration]));

  const excluded: PilotExclusionRecord[] = [];
  const pool = eligiblePokemonIds.filter(id => {
    if (sentinelPokemonIds.includes(id)) { excluded.push({ pokemonId: id, reasonCode: 'SENTINEL_SPECIES_EXCLUDED' }); return false; }
    if (provisionalPokemonIds.includes(id)) { excluded.push({ pokemonId: id, reasonCode: 'PROVISIONAL_EXCLUDED' }); return false; }
    if (blockedPokemonIds.includes(id)) { excluded.push({ pokemonId: id, reasonCode: 'BLOCKED_EXCLUDED' }); return false; }
    return speciesById.has(id);
  });

  const speeds = pool.map(id => maxCalculatedSpeed(speciesById.get(id)!)).sort((a, b) => a - b);
  const percentile = (p: number) => speeds[Math.floor(speeds.length * p)] ?? speeds[speeds.length - 1];
  const speedPercentiles = { p25: percentile(0.25), p75: percentile(0.75) };

  const catalogued = pool.map(id => {
    const species = speciesById.get(id)!;
    const ctx = buildSpeciesMoveContext(species, pkg);
    const strata = classifyStrata(species, ctx, speedPercentiles);
    const generation = generationByPokemonId.get(id) ?? null;
    const hasSupportSignal = strata.redirectionCapable || strata.fakeOutCapable || strata.tailwindCapable || strata.trickRoomCapable || ctx.legalMoves.some(m => m.category === 'status');
    return { id, tags: strataFor(strata, hasSupportSignal, generation), generation, speedClass: strata.verySlowSpeed ? 'very-slow' : strata.slowSpeed ? 'slow' : strata.fastSpeed ? 'fast' : 'medium', isMega: strata.isMega };
  });

  const selected: PilotSelectionRecord[] = [];
  const represented = new Set<string>();
  const selectedIds = new Set<string>();
  while (selected.length < targetCount && selected.length < catalogued.length) {
    const next = catalogued.filter(item => !selectedIds.has(item.id)).sort((a, b) => {
      const aGain = a.tags.filter(tag => !represented.has(tag)).length;
      const bGain = b.tags.filter(tag => !represented.has(tag)).length;
      return bGain - aGain || a.id.localeCompare(b.id);
    })[0];
    if (!next) break;
    selectedIds.add(next.id);
    next.tags.forEach(tag => represented.add(tag));
    selected.push({ pokemonId: next.id, reasonCode: 'STRATIFIED_COVERAGE_SELECTION', strataMatched: next.tags, generation: next.generation, speedClass: next.speedClass, isMega: next.isMega });
  }
  for (const item of catalogued) if (!selectedIds.has(item.id)) excluded.push({ pokemonId: item.id, reasonCode: 'NOT_SELECTED_COVERAGE_ALREADY_SATISFIED' });

  const missingStrata = STRATA_UNIVERSE.filter(tag => !represented.has(tag));
  return { selected, excluded, representedStrata: [...represented].sort(), missingStrata, poolSize: pool.length };
}
