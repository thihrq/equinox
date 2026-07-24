// Wave 2 -- generic, real-data-driven classification used by BOTH the target catalog expansion
// (task: target requirements) and the pilot stratified selection (task: pilot selection). Every
// tag here is derived from a species' real base stats / real learnset move IDs / real ability IDs
// -- never from a candidateId/pokemonId literal -- so the same function classifies any of the 203
// real species uniformly. Move/ability IDs are verified against the real data format (moveIds have
// no separators, e.g. 'trickroom'/'fakeout'/'uturn'; abilityIds are hyphenated, e.g.
// 'sand-stream'/'swift-swim') before being used here -- confirmed by direct lookup against
// moves.json/abilities.json, not assumed from the (differently-formatted) precedent in
// CompetitiveCurationCore.ts's categoriesFor().
import { ChampionsCompetitivePackage, ChampionsMoveRecord, ChampionsSpeciesRecord } from '../../../../equinox/data-packs/champions/ChampionsPackageTypes';
import { TYPE_CHART } from '../../../../utils/TypeChart';
import { calculateTargetStats, TargetSetStats } from '../evidence-generation/TargetSetCatalog';

export interface SpeciesMoveContext { species: ChampionsSpeciesRecord; legalMoves: ChampionsMoveRecord[]; legalAbilityIds: string[]; legalItemIds: string[]; }

export function buildSpeciesMoveContext(species: ChampionsSpeciesRecord, pkg: ChampionsCompetitivePackage): SpeciesMoveContext {
  const learnset = pkg.learnsets.find(item => item.pokemonId === species.pokemonId);
  const moveById = new Map(pkg.moves.map(move => [move.moveId, move]));
  const legalMoves = (learnset?.legalMoveIds ?? []).map(id => moveById.get(id)).filter((m): m is ChampionsMoveRecord => Boolean(m) && m!.globallyAvailableInRegulation);
  return { species, legalMoves, legalAbilityIds: learnset?.legalAbilityIds ?? [], legalItemIds: learnset?.legalItemIds ?? [] };
}

const hasMove = (ctx: SpeciesMoveContext, ...moveIds: string[]): boolean => ctx.legalMoves.some(m => moveIds.includes(m.moveId));
const hasAbility = (ctx: SpeciesMoveContext, ...abilityIds: string[]): boolean => ctx.legalAbilityIds.some(id => abilityIds.includes(id));

// Spread-relevant moves in real doubles play (hit both opponents, or the whole field) -- a fixed,
// well-known move-ID list applied uniformly, the same technique already established by
// CompetitiveCurationCore.categoriesFor() for other tags (not a per-species special case).
const SPREAD_MOVE_IDS = ['earthquake', 'surf', 'discharge', 'muddywater', 'blizzard', 'rockslide', 'heatwave', 'eruption', 'lavaplume', 'dazzlinggleam', 'originpulse', 'precipiceblades', 'bulldoze', 'electroweb'];
const SETUP_MOVE_IDS = ['swordsdance', 'nastyplot', 'calmmind', 'dragondance', 'quiverdance', 'bulkup', 'shellsmash', 'irondefense', 'agility', 'workup', 'growth', 'coil', 'curse'];
const PIVOT_MOVE_IDS = ['uturn', 'voltswitch', 'partingshot', 'flipturn', 'batonpass', 'chillyreception'];
const RECOVERY_MOVE_IDS = ['roost', 'recover', 'wish', 'moonlight', 'morningsun', 'synthesis', 'slackoff', 'softboiled', 'milkdrink', 'shoreup', 'strengthsap'];
const REDIRECTION_MOVE_IDS = ['followme', 'ragepowder'];
const SCREENS_MOVE_IDS = ['lightscreen', 'reflect', 'auroraveil'];
const SPEED_CONTROL_MOVE_IDS = ['trickroom', 'tailwind', 'thunderwave', 'icywind', 'electroweb', 'stickyweb'];
const WEATHER_MOVE_IDS = ['raindance', 'sunnyday', 'sandstorm', 'snowscape', 'hail'];
const TERRAIN_MOVE_IDS = ['electricterrain', 'grassyterrain', 'mistyterrain', 'psychicterrain'];
const WEATHER_ABILITY_IDS = ['drizzle', 'drought', 'sand-stream', 'snow-warning'];
const WEATHER_SPEED_ABILITY_IDS = ['chlorophyll', 'swift-swim', 'sand-rush', 'slush-rush'];

export function hasSpreadMove(ctx: SpeciesMoveContext): boolean { return hasMove(ctx, ...SPREAD_MOVE_IDS); }
export function hasSetupMove(ctx: SpeciesMoveContext): boolean { return hasMove(ctx, ...SETUP_MOVE_IDS); }
export function hasPivotMove(ctx: SpeciesMoveContext): boolean { return hasMove(ctx, ...PIVOT_MOVE_IDS); }
export function hasRecoveryMove(ctx: SpeciesMoveContext): boolean { return hasMove(ctx, ...RECOVERY_MOVE_IDS); }
export function hasRedirectionMove(ctx: SpeciesMoveContext): boolean { return hasMove(ctx, ...REDIRECTION_MOVE_IDS); }
export function hasScreensMove(ctx: SpeciesMoveContext): boolean { return hasMove(ctx, ...SCREENS_MOVE_IDS); }
export function hasSpeedControlMove(ctx: SpeciesMoveContext): boolean { return hasMove(ctx, ...SPEED_CONTROL_MOVE_IDS); }
export function hasTailwindMove(ctx: SpeciesMoveContext): boolean { return hasMove(ctx, 'tailwind'); }
export function hasTrickRoomMove(ctx: SpeciesMoveContext): boolean { return hasMove(ctx, 'trickroom'); }
export function hasWeatherSetter(ctx: SpeciesMoveContext): boolean { return hasMove(ctx, ...WEATHER_MOVE_IDS) || hasAbility(ctx, ...WEATHER_ABILITY_IDS); }
export function hasTerrainSetter(ctx: SpeciesMoveContext): boolean { return hasMove(ctx, ...TERRAIN_MOVE_IDS); }
export function hasFakeOutMove(ctx: SpeciesMoveContext): boolean { return hasMove(ctx, 'fakeout'); }
export function hasPriorityMove(ctx: SpeciesMoveContext): boolean { return ctx.legalMoves.some(m => m.priority > 0 && (m.power ?? 0) > 0); }
export function hasTauntMove(ctx: SpeciesMoveContext): boolean { return hasMove(ctx, 'taunt'); }
export function hasEncoreMove(ctx: SpeciesMoveContext): boolean { return hasMove(ctx, 'encore'); }
export function hasHelpingHandMove(ctx: SpeciesMoveContext): boolean { return hasMove(ctx, 'helpinghand'); }
export function hasWeatherSpeedAbility(ctx: SpeciesMoveContext): boolean { return hasAbility(ctx, ...WEATHER_SPEED_ABILITY_IDS); }
export function isMixedAttacker(species: ChampionsSpeciesRecord): boolean { const { atk, spa } = species.baseStats; const min = Math.min(atk, spa); const max = Math.max(atk, spa); return min > 0 && max > 0 && min / max >= 0.85; }
export function resistedTypeCount(species: ChampionsSpeciesRecord): number {
  const attackingTypes = Object.keys(TYPE_CHART);
  return attackingTypes.filter(attackType => {
    const multiplier = species.types.reduce((acc, defType) => acc * (TYPE_CHART[attackType]?.[defType] ?? 1), 1);
    return multiplier > 0 && multiplier < 1;
  }).length;
}
export function immuneTypeCount(species: ChampionsSpeciesRecord): number {
  const attackingTypes = Object.keys(TYPE_CHART);
  return attackingTypes.filter(attackType => species.types.reduce((acc, defType) => acc * (TYPE_CHART[attackType]?.[defType] ?? 1), 1) === 0).length;
}

/** Physical bulk index = calculated HP x calculated Def at a standard 252HP/252Def, Impish-nature, level-50 EV spread -- a real, generic, uniformly-applied formula, not a base-stat-only cutoff (mission section 15). */
export function physicalBulkIndex(species: ChampionsSpeciesRecord): number {
  const stats = calculateTargetStats(species.baseStats, { hp: 252, attack: 0, defense: 252, specialAttack: 0, specialDefense: 4, speed: 0 }, { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 }, { increasedStat: 'defense', decreasedStat: 'attack' });
  return stats.hp * stats.defense;
}
export function specialBulkIndex(species: ChampionsSpeciesRecord): number {
  const stats = calculateTargetStats(species.baseStats, { hp: 252, attack: 0, defense: 4, specialAttack: 0, specialDefense: 252, speed: 0 }, { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 }, { increasedStat: 'specialDefense', decreasedStat: 'specialAttack' });
  return stats.hp * stats.specialDefense;
}
export function maxCalculatedSpeed(species: ChampionsSpeciesRecord): TargetSetStats['speed'] {
  return calculateTargetStats(species.baseStats, { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 252 }, { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 }, { increasedStat: 'speed', decreasedStat: 'attack' }).speed;
}
export function minCalculatedSpeed(species: ChampionsSpeciesRecord): TargetSetStats['speed'] {
  return calculateTargetStats(species.baseStats, { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 }, { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 0 }, { increasedStat: 'attack', decreasedStat: 'speed' }).speed;
}

export interface PokemonStrata {
  pokemonId: string;
  physicalAttacker: boolean; specialAttacker: boolean; mixedAttacker: boolean;
  fastSpeed: boolean; slowSpeed: boolean; verySlowSpeed: boolean;
  trickRoomCapable: boolean; tailwindCapable: boolean; weatherSetter: boolean; terrainSetter: boolean;
  redirectionCapable: boolean; fakeOutCapable: boolean; priorityCapable: boolean; pivotCapable: boolean;
  wallPhysical: boolean; wallSpecial: boolean;
  isMega: boolean;
}

/** Generic per-species strata tagging, reused identically by target-catalog expansion and pilot selection so both consume the exact same classification logic (no drift between the two consumers). */
export function classifyStrata(species: ChampionsSpeciesRecord, ctx: SpeciesMoveContext, speedPercentiles: { p25: number; p75: number }): PokemonStrata {
  const speed = maxCalculatedSpeed(species);
  return {
    pokemonId: species.pokemonId,
    physicalAttacker: species.baseStats.atk >= species.baseStats.spa,
    specialAttacker: species.baseStats.spa > species.baseStats.atk,
    mixedAttacker: isMixedAttacker(species),
    fastSpeed: speed >= speedPercentiles.p75,
    slowSpeed: speed <= speedPercentiles.p25,
    verySlowSpeed: species.baseStats.spe <= 60,
    trickRoomCapable: hasTrickRoomMove(ctx),
    tailwindCapable: hasTailwindMove(ctx),
    weatherSetter: hasWeatherSetter(ctx),
    terrainSetter: hasTerrainSetter(ctx),
    redirectionCapable: hasRedirectionMove(ctx),
    fakeOutCapable: hasFakeOutMove(ctx),
    priorityCapable: hasPriorityMove(ctx),
    pivotCapable: hasPivotMove(ctx),
    wallPhysical: species.baseStats.def >= species.baseStats.atk && species.baseStats.def >= species.baseStats.spa,
    wallSpecial: species.baseStats.spd >= species.baseStats.atk && species.baseStats.spd >= species.baseStats.spa,
    isMega: Boolean((species as { isMega?: boolean }).isMega),
  };
}
