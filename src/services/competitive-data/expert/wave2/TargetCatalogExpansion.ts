// Wave 2 -- deterministic, profile-driven target catalog expansion. Resolves
// TARGET_CATALOG_EXPANSION_REQUIRED (Wave 1's transferred finding) by selecting, for each profile
// in TARGET_PROFILE_REQUIREMENTS, the real eligible species that best fits the profile's real,
// generic scoring rule (never a per-species special case) and building a real, legality-validated
// ExpertDerivedTargetSetRecord for it via calculateTargetStats + buildExpertDerivedTargetSetRecord.
import { ChampionsCompetitivePackage, ChampionsMoveRecord, ChampionsSpeciesRecord } from '../../../../equinox/data-packs/champions/ChampionsPackageTypes';
import { buildExpertDerivedTargetSetRecord, ExpertDerivedTargetSetRecord, TargetEligibilityStatus } from './ExpertDerivedTargetSetBuilder';
import { TARGET_PROFILE_REQUIREMENTS, TargetProfileRequirement } from './TargetProfileRequirements';
import {
  buildSpeciesMoveContext, SpeciesMoveContext, hasSpreadMove, hasSetupMove, hasPivotMove, hasRecoveryMove, hasRedirectionMove,
  hasScreensMove, hasSpeedControlMove, hasTailwindMove, hasTrickRoomMove, hasWeatherSetter, hasTerrainSetter, hasFakeOutMove,
  hasPriorityMove, hasTauntMove, hasEncoreMove, hasHelpingHandMove, hasWeatherSpeedAbility, isMixedAttacker,
  physicalBulkIndex, specialBulkIndex, maxCalculatedSpeed, minCalculatedSpeed, resistedTypeCount, immuneTypeCount,
} from './PokemonProfileClassifier';

export interface ChampionsPackageValidationSubset { eligiblePokemonIds: string[]; provisionalPokemonIds: string[]; blockedPokemonIds: string[]; }
export interface ExpandTargetCatalogInput { pkg: ChampionsCompetitivePackage; validation: ChampionsPackageValidationSubset; previousTargetPokemonIds: string[]; }
export interface SelectionTraceEntry { profileId: string; consideredCount: number; selectedPokemonId: string | null; rankingMetric: string; }
export interface ExpandTargetCatalogResult { newTargets: ExpertDerivedTargetSetRecord[]; unresolved: { profileId: string; reason: string }[]; selectionTrace: SelectionTraceEntry[]; }

function eligibilityOf(pokemonId: string, validation: ChampionsPackageValidationSubset): TargetEligibilityStatus {
  if (validation.blockedPokemonIds.includes(pokemonId)) return 'blocked';
  if (validation.provisionalPokemonIds.includes(pokemonId)) return 'provisional';
  return 'eligible';
}

// Wave 2 peer review (WAVE2-PR-02): picking the top-4 highest-*power* legal moves regardless of
// role gave a "physical-wall" target (Steelix) a slate of explosion/self-destruct/recharge moves
// (self-KO or lock the user out for a turn), incoherent with a defensive set. These moves are
// competitively counter-productive for essentially every real target-set profile in this catalog,
// so they are excluded universally, not just for defensive profiles.
const SELF_DEFEATING_MOVE_IDS: readonly string[] = ['explosion', 'selfdestruct', 'mistyexplosion', 'mindblown', 'steelbeam'];

function candidateDamagingMoves(ctx: SpeciesMoveContext, category?: 'physical' | 'special'): ChampionsMoveRecord[] {
  return ctx.legalMoves.filter(m => (m.power ?? 0) > 0 && !SELF_DEFEATING_MOVE_IDS.includes(m.moveId) && (!category || m.category === category)).sort((a, b) => (b.power ?? 0) - (a.power ?? 0));
}

/**
 * Fills the 4-move slate: the profile's defining move first (when move-driven), then -- for
 * defensive/support profiles -- real non-attacking (status/support) moves before any damaging
 * move, so a wall/support target's slate is coherent with its declared role rather than
 * maximizing raw power; for other profiles, the highest-power legal damaging moves come first.
 * Either way, self-defeating moves are excluded and remaining slots are filled deterministically.
 * Returns null if fewer than 4 distinct legal moves exist (species is skipped, not forced).
 */
function fillMoveSlate(ctx: SpeciesMoveContext, leadMoveId: string | undefined, preferNonAttacking: boolean): [string, string, string, string] | null {
  const lead = leadMoveId && ctx.legalMoves.some(m => m.moveId === leadMoveId) ? [leadMoveId] : [];
  const nonAttacking = preferNonAttacking ? ctx.legalMoves.filter(m => (m.power ?? 0) === 0).map(m => m.moveId).filter(id => !lead.includes(id)).sort() : [];
  const damaging = candidateDamagingMoves(ctx).map(m => m.moveId).filter(id => !lead.includes(id) && !nonAttacking.includes(id));
  const rest = ctx.legalMoves.map(m => m.moveId).filter(id => !lead.includes(id) && !nonAttacking.includes(id) && !damaging.includes(id)).sort();
  const slate = [...lead, ...nonAttacking, ...damaging, ...rest];
  const distinct = [...new Set(slate)];
  if (distinct.length < 4) return null;
  return [distinct[0], distinct[1], distinct[2], distinct[3]];
}

function chooseLegalItem(ctx: SpeciesMoveContext, pkg: ChampionsCompetitivePackage, preferred: string[]): string | null {
  const legalIds = new Set(ctx.legalItemIds.length > 0 ? ctx.legalItemIds : pkg.items.filter(i => i.legal).map(i => i.itemId));
  for (const item of preferred) if (legalIds.has(item) && pkg.items.some(i => i.itemId === item && i.legal)) return item;
  const fallback = [...legalIds].find(id => pkg.items.some(i => i.itemId === id && i.legal));
  return fallback ?? null;
}
function chooseLegalAbility(ctx: SpeciesMoveContext, species: ChampionsSpeciesRecord, preferred: string[]): string | null {
  const legalIds = new Set(ctx.legalAbilityIds.length > 0 ? ctx.legalAbilityIds : species.abilities);
  for (const ability of preferred) if (legalIds.has(ability)) return ability;
  return [...legalIds][0] ?? null;
}

interface ProfileSelectionPlan {
  filter?: (species: ChampionsSpeciesRecord, ctx: SpeciesMoveContext) => boolean;
  rank: (species: ChampionsSpeciesRecord, ctx: SpeciesMoveContext) => number; // higher = better fit
  leadMoveId?: string;
  preferredItems: string[];
  preferredAbilities: string[];
  evs: Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>;
  natureId: string; nature: { increasedStat: string | null; decreasedStat: string | null };
  ivs?: Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>;
  intendedUses: string[]; benchmarkClasses: string[]; speedClasses: string[]; defensiveClasses: string[];
}

const DEF_EVS = { hp: 252, atk: 0, def: 252, spa: 0, spd: 4, spe: 0 } as const;
const SPDEF_EVS = { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 } as const;
const OFF_PHYS_EVS = { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 } as const;
const OFF_SPEC_EVS = { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 } as const;
const SPEED_EVS = { hp: 4, atk: 0, def: 0, spa: 0, spd: 0, spe: 252 } as const;
const NEUTRAL_EVS = { hp: 252, atk: 0, def: 128, spa: 0, spd: 128, spe: 0 } as const;
const NEUTRAL_IVS = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 } as const;
const ZERO_SPEED_IVS = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 0 } as const;

function plans(): Record<string, ProfileSelectionPlan> {
  return {
    'physical-wall': { rank: physicalBulkIndex, preferredItems: ['leftovers', 'heavydutyboots', 'sitrusberry'], preferredAbilities: [], evs: DEF_EVS, natureId: 'impish', nature: { increasedStat: 'defense', decreasedStat: 'specialAttack' }, intendedUses: ['defensive'], benchmarkClasses: ['defensive-benchmark'], speedClasses: [], defensiveClasses: ['physical-wall'] },
    'special-wall': { rank: specialBulkIndex, preferredItems: ['leftovers', 'heavydutyboots', 'sitrusberry'], preferredAbilities: [], evs: SPDEF_EVS, natureId: 'calm', nature: { increasedStat: 'specialDefense', decreasedStat: 'attack' }, intendedUses: ['defensive'], benchmarkClasses: ['defensive-benchmark'], speedClasses: [], defensiveClasses: ['special-wall'] },
    'mixed-wall': { rank: (s) => Math.min(physicalBulkIndex(s), specialBulkIndex(s)), preferredItems: ['leftovers', 'sitrusberry'], preferredAbilities: [], evs: NEUTRAL_EVS, natureId: 'sassy', nature: { increasedStat: 'specialDefense', decreasedStat: 'speed' }, intendedUses: ['defensive'], benchmarkClasses: ['defensive-benchmark'], speedClasses: [], defensiveClasses: ['mixed-wall'] },
    'physically-bulky-attacker': { filter: (s) => s.baseStats.atk >= s.baseStats.spa, rank: (s) => physicalBulkIndex(s) * (1 + s.baseStats.atk / 200), preferredItems: ['assaultvest', 'leftovers'], preferredAbilities: [], evs: { hp: 252, atk: 252, def: 4, spa: 0, spd: 0, spe: 0 }, natureId: 'adamant', nature: { increasedStat: 'attack', decreasedStat: 'specialAttack' }, intendedUses: ['defensive', 'pressure test'], benchmarkClasses: ['trade-off-benchmark'], speedClasses: [], defensiveClasses: ['bulky-attacker'] },
    'specially-bulky-attacker': { filter: (s) => s.baseStats.spa > s.baseStats.atk, rank: (s) => specialBulkIndex(s) * (1 + s.baseStats.spa / 200), preferredItems: ['assaultvest', 'leftovers'], preferredAbilities: [], evs: { hp: 252, atk: 0, def: 0, spa: 252, spd: 4, spe: 0 }, natureId: 'modest', nature: { increasedStat: 'specialAttack', decreasedStat: 'attack' }, intendedUses: ['defensive', 'pressure test'], benchmarkClasses: ['trade-off-benchmark'], speedClasses: [], defensiveClasses: ['bulky-attacker'] },
    'bulky-physical-attacker': { filter: (s) => s.baseStats.atk >= s.baseStats.spa, rank: (s) => physicalBulkIndex(s) * (1 + s.baseStats.atk / 200), preferredItems: ['leftovers', 'assaultvest'], preferredAbilities: [], evs: { hp: 252, atk: 252, def: 4, spa: 0, spd: 0, spe: 0 }, natureId: 'adamant', nature: { increasedStat: 'attack', decreasedStat: 'specialAttack' }, intendedUses: ['pressure test', 'defensive test'], benchmarkClasses: ['trade-off-benchmark'], speedClasses: [], defensiveClasses: [] },
    'bulky-special-attacker': { filter: (s) => s.baseStats.spa > s.baseStats.atk, rank: (s) => specialBulkIndex(s) * (1 + s.baseStats.spa / 200), preferredItems: ['leftovers', 'assaultvest'], preferredAbilities: [], evs: { hp: 252, atk: 0, def: 0, spa: 252, spd: 4, spe: 0 }, natureId: 'modest', nature: { increasedStat: 'specialAttack', decreasedStat: 'attack' }, intendedUses: ['pressure test', 'defensive test'], benchmarkClasses: ['trade-off-benchmark'], speedClasses: [], defensiveClasses: [] },
    'mixed-attacker': { filter: (s) => isMixedAttacker(s), rank: (s) => Math.min(s.baseStats.atk, s.baseStats.spa), preferredItems: ['lifeorb', 'leftovers'], preferredAbilities: [], evs: { hp: 0, atk: 128, def: 0, spa: 128, spd: 0, spe: 252 }, natureId: 'naive', nature: { increasedStat: 'speed', decreasedStat: 'specialDefense' }, intendedUses: ['pressure test'], benchmarkClasses: ['coverage-benchmark'], speedClasses: [], defensiveClasses: [] },
    'fast-physical-attacker': { filter: (s) => s.baseStats.atk >= s.baseStats.spa, rank: maxCalculatedSpeed, leadMoveId: undefined, preferredItems: ['choiceband', 'lifeorb'], preferredAbilities: [], evs: OFF_PHYS_EVS, natureId: 'jolly', nature: { increasedStat: 'speed', decreasedStat: 'specialAttack' }, intendedUses: ['speed', 'pressure test'], benchmarkClasses: ['offensive-speed-tier-benchmark'], speedClasses: ['fast'], defensiveClasses: [] },
    'fast-special-attacker': { filter: (s) => s.baseStats.spa > s.baseStats.atk, rank: maxCalculatedSpeed, preferredItems: ['choicespecs', 'lifeorb'], preferredAbilities: [], evs: OFF_SPEC_EVS, natureId: 'timid', nature: { increasedStat: 'speed', decreasedStat: 'attack' }, intendedUses: ['speed', 'pressure test'], benchmarkClasses: ['offensive-speed-tier-benchmark'], speedClasses: ['fast'], defensiveClasses: [] },
    'very-fast': { rank: maxCalculatedSpeed, preferredItems: ['choicescarf', 'focussash'], preferredAbilities: [], evs: SPEED_EVS, natureId: 'jolly', nature: { increasedStat: 'speed', decreasedStat: 'attack' }, intendedUses: ['speed'], benchmarkClasses: ['speed-tier-benchmark'], speedClasses: ['very-fast'], defensiveClasses: [] },
    'fast': { rank: maxCalculatedSpeed, preferredItems: ['leftovers'], preferredAbilities: [], evs: SPEED_EVS, natureId: 'timid', nature: { increasedStat: 'speed', decreasedStat: 'attack' }, intendedUses: ['speed'], benchmarkClasses: ['speed-tier-benchmark'], speedClasses: ['fast'], defensiveClasses: [] },
    'medium': { rank: (s) => -Math.abs(maxCalculatedSpeed(s) - 130), preferredItems: ['leftovers'], preferredAbilities: [], evs: NEUTRAL_EVS, natureId: 'bold', nature: { increasedStat: 'defense', decreasedStat: 'attack' }, intendedUses: ['speed'], benchmarkClasses: ['speed-tier-benchmark'], speedClasses: ['medium'], defensiveClasses: [] },
    'slow': { rank: (s) => -maxCalculatedSpeed(s), preferredItems: ['leftovers'], preferredAbilities: [], evs: DEF_EVS, natureId: 'relaxed', nature: { increasedStat: 'defense', decreasedStat: 'speed' }, intendedUses: ['speed'], benchmarkClasses: ['speed-tier-benchmark'], speedClasses: ['slow'], defensiveClasses: [], ivs: ZERO_SPEED_IVS },
    'very-slow': { rank: (s) => -minCalculatedSpeed(s), preferredItems: ['leftovers', 'ironball'], preferredAbilities: [], evs: DEF_EVS, natureId: 'brave', nature: { increasedStat: 'attack', decreasedStat: 'speed' }, intendedUses: ['speed', 'Trick Room active'], benchmarkClasses: ['speed-tier-benchmark'], speedClasses: ['very-slow'], defensiveClasses: [], ivs: ZERO_SPEED_IVS },
    'choice-scarf-benchmark': { rank: (s) => -Math.abs(maxCalculatedSpeed(s) - 130), preferredItems: ['choicescarf'], preferredAbilities: [], evs: SPEED_EVS, natureId: 'jolly', nature: { increasedStat: 'speed', decreasedStat: 'attack' }, intendedUses: ['speed'], benchmarkClasses: ['item-speed-benchmark'], speedClasses: ['choice-scarf'], defensiveClasses: [] },
    'tailwind-benchmark': { filter: (s, ctx) => hasTailwindMove(ctx), rank: (s) => -Math.abs(maxCalculatedSpeed(s) - 130), preferredItems: ['leftovers'], preferredAbilities: [], evs: NEUTRAL_EVS, natureId: 'jolly', nature: { increasedStat: 'speed', decreasedStat: 'attack' }, leadMoveId: 'tailwind', intendedUses: ['speed'], benchmarkClasses: ['tailwind-speed-benchmark'], speedClasses: ['tailwind'], defensiveClasses: [] },
    'weather-speed-benchmark': { filter: (s, ctx) => hasWeatherSpeedAbility(ctx), rank: maxCalculatedSpeed, preferredItems: ['leftovers'], preferredAbilities: ['chlorophyll', 'swift-swim', 'sand-rush', 'slush-rush'], evs: SPEED_EVS, natureId: 'jolly', nature: { increasedStat: 'speed', decreasedStat: 'attack' }, intendedUses: ['speed'], benchmarkClasses: ['weather-speed-benchmark'], speedClasses: ['weather-boosted'], defensiveClasses: [] },
    'spread-physical-attacker': { filter: (s, ctx) => hasSpreadMove(ctx) && s.baseStats.atk >= s.baseStats.spa, rank: (s) => s.baseStats.atk, preferredItems: ['lifeorb'], preferredAbilities: [], evs: OFF_PHYS_EVS, natureId: 'adamant', nature: { increasedStat: 'attack', decreasedStat: 'specialAttack' }, intendedUses: ['pressure test'], benchmarkClasses: ['spread-coverage-benchmark'], speedClasses: [], defensiveClasses: [] },
    'spread-special-attacker': { filter: (s, ctx) => hasSpreadMove(ctx) && s.baseStats.spa > s.baseStats.atk, rank: (s) => s.baseStats.spa, preferredItems: ['lifeorb'], preferredAbilities: [], evs: OFF_SPEC_EVS, natureId: 'modest', nature: { increasedStat: 'specialAttack', decreasedStat: 'attack' }, intendedUses: ['pressure test'], benchmarkClasses: ['spread-coverage-benchmark'], speedClasses: [], defensiveClasses: [] },
    'priority-attacker': { filter: (s, ctx) => hasPriorityMove(ctx), rank: (s) => Math.max(s.baseStats.atk, s.baseStats.spa), preferredItems: ['lifeorb'], preferredAbilities: [], evs: NEUTRAL_EVS, natureId: 'adamant', nature: { increasedStat: 'attack', decreasedStat: 'specialAttack' }, intendedUses: ['speed', 'pressure test'], benchmarkClasses: ['priority-interaction-benchmark'], speedClasses: [], defensiveClasses: [] },
    'setup-attacker': { filter: (s, ctx) => hasSetupMove(ctx), rank: (s) => Math.max(s.baseStats.atk, s.baseStats.spa), preferredItems: ['leftovers'], preferredAbilities: [], evs: NEUTRAL_EVS, natureId: 'jolly', nature: { increasedStat: 'speed', decreasedStat: 'specialAttack' }, intendedUses: ['pressure test', 'role execution'], benchmarkClasses: ['setup-denial-benchmark'], speedClasses: [], defensiveClasses: [] },
    'offensive-pivot': { filter: (s, ctx) => hasPivotMove(ctx), rank: (s) => Math.max(s.baseStats.atk, s.baseStats.spa), preferredItems: ['leftovers', 'choiceband'], preferredAbilities: [], evs: NEUTRAL_EVS, natureId: 'jolly', nature: { increasedStat: 'speed', decreasedStat: 'specialAttack' }, intendedUses: ['role execution'], benchmarkClasses: ['pivot-interaction-benchmark'], speedClasses: [], defensiveClasses: [] },
    'recovery-oriented-target': { filter: (s, ctx) => hasRecoveryMove(ctx), rank: (s) => s.baseStats.hp, preferredItems: ['leftovers'], preferredAbilities: [], evs: DEF_EVS, natureId: 'bold', nature: { increasedStat: 'defense', decreasedStat: 'attack' }, intendedUses: ['defensive test'], benchmarkClasses: ['sustain-benchmark'], speedClasses: [], defensiveClasses: ['recovery'] },
    'resistance-based-target': { filter: (s) => resistedTypeCount(s) >= 2, rank: resistedTypeCount, preferredItems: ['leftovers'], preferredAbilities: [], evs: NEUTRAL_EVS, natureId: 'bold', nature: { increasedStat: 'defense', decreasedStat: 'attack' }, intendedUses: ['defensive test'], benchmarkClasses: ['resistance-benchmark'], speedClasses: [], defensiveClasses: ['resistance'] },
    'immunity-based-target': { filter: (s) => immuneTypeCount(s) >= 1, rank: immuneTypeCount, preferredItems: ['leftovers'], preferredAbilities: [], evs: NEUTRAL_EVS, natureId: 'bold', nature: { increasedStat: 'defense', decreasedStat: 'attack' }, intendedUses: ['defensive test'], benchmarkClasses: ['immunity-benchmark'], speedClasses: [], defensiveClasses: ['immunity'] },
    'fake-out': { filter: (s, ctx) => hasFakeOutMove(ctx), rank: (s) => s.baseStats.spe, leadMoveId: 'fakeout', preferredItems: ['sitrusberry'], preferredAbilities: [], evs: NEUTRAL_EVS, natureId: 'jolly', nature: { increasedStat: 'speed', decreasedStat: 'specialAttack' }, intendedUses: ['role execution'], benchmarkClasses: ['disruption-benchmark'], speedClasses: [], defensiveClasses: [] },
    'redirection': { filter: (s, ctx) => hasRedirectionMove(ctx), rank: (s) => s.baseStats.hp, preferredItems: ['sitrusberry', 'leftovers'], preferredAbilities: [], evs: DEF_EVS, natureId: 'bold', nature: { increasedStat: 'defense', decreasedStat: 'attack' }, intendedUses: ['role execution'], benchmarkClasses: ['redirection-benchmark'], speedClasses: [], defensiveClasses: [] },
    'screens': { filter: (s, ctx) => hasScreensMove(ctx), rank: (s) => s.baseStats.hp, preferredItems: ['lightclay'], preferredAbilities: [], evs: DEF_EVS, natureId: 'bold', nature: { increasedStat: 'defense', decreasedStat: 'attack' }, intendedUses: ['defensive test'], benchmarkClasses: ['screens-benchmark'], speedClasses: [], defensiveClasses: ['screens'] },
    'speed-control': { filter: (s, ctx) => hasSpeedControlMove(ctx), rank: (s) => s.baseStats.hp, preferredItems: ['leftovers'], preferredAbilities: [], evs: NEUTRAL_EVS, natureId: 'bold', nature: { increasedStat: 'defense', decreasedStat: 'attack' }, intendedUses: ['speed'], benchmarkClasses: ['speed-control-benchmark'], speedClasses: [], defensiveClasses: [] },
    'tailwind': { filter: (s, ctx) => hasTailwindMove(ctx), rank: (s) => s.baseStats.spe, leadMoveId: 'tailwind', preferredItems: ['leftovers'], preferredAbilities: [], evs: NEUTRAL_EVS, natureId: 'jolly', nature: { increasedStat: 'speed', decreasedStat: 'specialAttack' }, intendedUses: ['speed'], benchmarkClasses: ['tailwind-benchmark'], speedClasses: [], defensiveClasses: [] },
    'trick-room': { filter: (s, ctx) => hasTrickRoomMove(ctx), rank: (s) => -s.baseStats.spe, leadMoveId: 'trickroom', preferredItems: ['leftovers'], preferredAbilities: [], evs: DEF_EVS, natureId: 'sassy', nature: { increasedStat: 'specialDefense', decreasedStat: 'speed' }, intendedUses: ['Trick Room active'], benchmarkClasses: ['trick-room-benchmark'], speedClasses: [], defensiveClasses: [], ivs: ZERO_SPEED_IVS },
    'weather-setter': { filter: (s, ctx) => hasWeatherSetter(ctx), rank: (s) => s.baseStats.hp, preferredItems: ['leftovers'], preferredAbilities: ['drizzle', 'drought', 'sand-stream', 'snow-warning'], evs: DEF_EVS, natureId: 'bold', nature: { increasedStat: 'defense', decreasedStat: 'attack' }, intendedUses: ['weather active'], benchmarkClasses: ['weather-benchmark'], speedClasses: [], defensiveClasses: [] },
    'terrain-setter': { filter: (s, ctx) => hasTerrainSetter(ctx), rank: (s) => s.baseStats.hp, preferredItems: ['leftovers'], preferredAbilities: [], evs: DEF_EVS, natureId: 'bold', nature: { increasedStat: 'defense', decreasedStat: 'attack' }, intendedUses: ['terrain active'], benchmarkClasses: ['terrain-benchmark'], speedClasses: [], defensiveClasses: [] },
    'disruption': { filter: (s, ctx) => hasTauntMove(ctx) || hasEncoreMove(ctx), rank: (s) => s.baseStats.spe, preferredItems: ['sitrusberry'], preferredAbilities: [], evs: NEUTRAL_EVS, natureId: 'jolly', nature: { increasedStat: 'speed', decreasedStat: 'specialAttack' }, intendedUses: ['role execution'], benchmarkClasses: ['disruption-benchmark'], speedClasses: [], defensiveClasses: [] },
    'encore': { filter: (s, ctx) => hasEncoreMove(ctx), rank: (s) => s.baseStats.spe, leadMoveId: 'encore', preferredItems: ['sitrusberry'], preferredAbilities: [], evs: NEUTRAL_EVS, natureId: 'jolly', nature: { increasedStat: 'speed', decreasedStat: 'specialAttack' }, intendedUses: ['role execution'], benchmarkClasses: ['disruption-benchmark'], speedClasses: [], defensiveClasses: [] },
    'taunt': { filter: (s, ctx) => hasTauntMove(ctx), rank: (s) => s.baseStats.spe, leadMoveId: 'taunt', preferredItems: ['sitrusberry'], preferredAbilities: [], evs: NEUTRAL_EVS, natureId: 'jolly', nature: { increasedStat: 'speed', decreasedStat: 'specialAttack' }, intendedUses: ['role execution'], benchmarkClasses: ['disruption-benchmark'], speedClasses: [], defensiveClasses: [] },
    'helping-hand': { filter: (s, ctx) => hasHelpingHandMove(ctx), rank: (s) => s.baseStats.hp, leadMoveId: 'helpinghand', preferredItems: ['sitrusberry'], preferredAbilities: [], evs: DEF_EVS, natureId: 'bold', nature: { increasedStat: 'defense', decreasedStat: 'attack' }, intendedUses: ['partner dependency'], benchmarkClasses: ['support-benchmark'], speedClasses: [], defensiveClasses: [] },
    'pivot': { filter: (s, ctx) => hasPivotMove(ctx), rank: (s) => s.baseStats.hp, preferredItems: ['leftovers'], preferredAbilities: [], evs: DEF_EVS, natureId: 'bold', nature: { increasedStat: 'defense', decreasedStat: 'attack' }, intendedUses: ['role execution'], benchmarkClasses: ['pivot-benchmark'], speedClasses: [], defensiveClasses: [] },
    'recovery-support': { filter: (s, ctx) => hasRecoveryMove(ctx) && (hasScreensMove(ctx) || hasRedirectionMove(ctx) || hasHelpingHandMove(ctx)), rank: (s) => s.baseStats.hp, preferredItems: ['leftovers'], preferredAbilities: [], evs: DEF_EVS, natureId: 'bold', nature: { increasedStat: 'defense', decreasedStat: 'attack' }, intendedUses: ['defensive test'], benchmarkClasses: ['sustain-benchmark'], speedClasses: [], defensiveClasses: ['recovery'] },
  };
}

export function expandTargetCatalog(input: ExpandTargetCatalogInput): ExpandTargetCatalogResult {
  const { pkg, validation, previousTargetPokemonIds } = input;
  const speciesById = new Map(pkg.species.map(s => [s.pokemonId, s]));
  const pool = validation.eligiblePokemonIds.filter(id => !previousTargetPokemonIds.includes(id) && speciesById.has(id));
  const contextById = new Map(pool.map(id => [id, buildSpeciesMoveContext(speciesById.get(id)!, pkg)]));

  const newTargets: ExpertDerivedTargetSetRecord[] = [];
  const unresolved: { profileId: string; reason: string }[] = [];
  const selectionTrace: SelectionTraceEntry[] = [];
  const usedPokemonIds = new Set<string>();
  const planTable = plans();

  for (const profile of TARGET_PROFILE_REQUIREMENTS) {
    const plan = planTable[profile.profileId];
    if (!plan) continue; // archetype-only profiles are satisfied via tag co-occurrence, audited separately.
    const considered = pool.filter(id => {
      const ctx = contextById.get(id)!;
      const species = speciesById.get(id)!;
      return (!plan.filter || plan.filter(species, ctx)) && ctx.legalMoves.length >= 4;
    });
    selectionTrace.push({ profileId: profile.profileId, consideredCount: considered.length, selectedPokemonId: null, rankingMetric: plan.rank.name || 'custom' });
    if (considered.length === 0) { unresolved.push({ profileId: profile.profileId, reason: 'NO_ELIGIBLE_SPECIES_MATCHES_PROFILE_FILTER' }); continue; }

    const ranked = considered
      .map(id => ({ id, score: plan.rank(speciesById.get(id)!, contextById.get(id)!) }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

    // Prefer a species not already used by another profile in this run, for catalog diversity, but
    // fall back to reuse (as a different SET, not a different species) rather than leaving a
    // gated profile unresolved when the pool of qualifying species is small.
    const pick = ranked.find(r => !usedPokemonIds.has(r.id)) ?? ranked[0];
    const species = speciesById.get(pick.id)!;
    const ctx = contextById.get(pick.id)!;
    const moveIds = fillMoveSlate(ctx, plan.leadMoveId, profile.category === 'defensive' || profile.category === 'support');
    if (!moveIds) { unresolved.push({ profileId: profile.profileId, reason: `INSUFFICIENT_LEGAL_MOVES:${pick.id}` }); continue; }
    const itemId = chooseLegalItem(ctx, pkg, plan.preferredItems);
    const abilityId = chooseLegalAbility(ctx, species, plan.preferredAbilities);
    if (!itemId || !abilityId) { unresolved.push({ profileId: profile.profileId, reason: `NO_LEGAL_ITEM_OR_ABILITY:${pick.id}` }); continue; }

    const record = buildExpertDerivedTargetSetRecord({
      draft: {
        setId: `wave2-${profile.profileId}-${pick.id}`, pokemonId: pick.id, itemId, abilityId, natureId: plan.natureId,
        moveIds, evs: plan.evs, ivs: plan.ivs ?? NEUTRAL_IVS, declaredRoles: [profile.category], targetArchetypes: [profile.profileId], profileId: profile.profileId,
      },
      species: { speciesId: species.pokemonId, pokemonId: species.pokemonId, baseStats: species.baseStats },
      nature: plan.nature, eligibilityStatus: eligibilityOf(pick.id, validation),
      legalMoves: new Set(ctx.legalMoves.map(m => m.moveId)), legalAbilities: new Set(ctx.legalAbilityIds.length > 0 ? ctx.legalAbilityIds : species.abilities), legalItems: new Set(ctx.legalItemIds.length > 0 ? ctx.legalItemIds : pkg.items.filter(i => i.legal).map(i => i.itemId)),
      coherent: true, intendedUses: plan.intendedUses, benchmarkClasses: plan.benchmarkClasses, speedClasses: plan.speedClasses, defensiveClasses: plan.defensiveClasses,
      sourceReferences: [`wave2-target-catalog-expansion:${profile.profileId}`],
    });
    newTargets.push(record);
    usedPokemonIds.add(pick.id);
    selectionTrace[selectionTrace.length - 1].selectedPokemonId = pick.id;
  }

  // zero-speed-trick-room: an explicit second SET built on the very-slow selection's species (a
  // legitimately different target-catalog entry: 0 Speed IV/EV, Brave nature), not a duplicate.
  const verySlow = newTargets.find(t => t.profileId === 'very-slow');
  if (verySlow) {
    const ctx = contextById.get(verySlow.pokemonId)!;
    const species = speciesById.get(verySlow.pokemonId)!;
    const moveIds = fillMoveSlate(ctx, ctx.legalMoves.some(m => m.moveId === 'trickroom') ? 'trickroom' : undefined, false);
    if (moveIds) {
      const itemId = chooseLegalItem(ctx, pkg, ['ironball', 'leftovers']);
      const abilityId = chooseLegalAbility(ctx, species, []);
      if (itemId && abilityId) {
        newTargets.push(buildExpertDerivedTargetSetRecord({
          draft: { setId: `wave2-zero-speed-trick-room-${verySlow.pokemonId}`, pokemonId: verySlow.pokemonId, itemId, abilityId, natureId: 'brave', moveIds, evs: DEF_EVS, ivs: ZERO_SPEED_IVS, declaredRoles: ['speed'], targetArchetypes: ['zero-speed-trick-room'], profileId: 'zero-speed-trick-room' },
          species: { speciesId: species.pokemonId, pokemonId: species.pokemonId, baseStats: species.baseStats }, nature: { increasedStat: 'attack', decreasedStat: 'speed' },
          eligibilityStatus: eligibilityOf(verySlow.pokemonId, validation), legalMoves: new Set(ctx.legalMoves.map(m => m.moveId)), legalAbilities: new Set(ctx.legalAbilityIds.length > 0 ? ctx.legalAbilityIds : species.abilities), legalItems: new Set(ctx.legalItemIds.length > 0 ? ctx.legalItemIds : pkg.items.filter(i => i.legal).map(i => i.itemId)),
          coherent: true, intendedUses: ['Trick Room active', 'Trick Room inactive'], benchmarkClasses: ['trick-room-benchmark'], speedClasses: ['zero-speed'], defensiveClasses: [],
          sourceReferences: ['wave2-target-catalog-expansion:zero-speed-trick-room'],
        }));
      } else { unresolved.push({ profileId: 'zero-speed-trick-room', reason: 'NO_LEGAL_ITEM_OR_ABILITY' }); }
    } else { unresolved.push({ profileId: 'zero-speed-trick-room', reason: 'INSUFFICIENT_LEGAL_MOVES' }); }
  } else { unresolved.push({ profileId: 'zero-speed-trick-room', reason: 'VERY_SLOW_TARGET_UNRESOLVED_UPSTREAM' }); }

  return { newTargets, unresolved, selectionTrace };
}
