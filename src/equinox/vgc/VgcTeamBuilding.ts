import { PokemonData } from '../core/AnalysisContext';
import type { TacticalInsight } from './TacticalInsightTypes';
import { analyzeTacticalInteractions } from './TacticalInteractionAnalyzer';
import { validateModeContract } from './VgcModeContractValidator';
import { getPokemonTypes, getVariant } from '../utils/PokemonUtils';
import { getDamageMultiplier } from '../utils/DamageMultiplier';
import {
  getVgcMechanicTags,
  hasTerrainSleepConflict,
  hasVgcMechanicTag,
  isVgcMechanicRedirectionSupport,
  isVgcMechanicTailwindSetter,
  isVgcMechanicTerrainAbuser,
  isVgcMechanicTerrainSetter,
  isVgcMechanicTrickRoomAbuser,
  isVgcMechanicTrickRoomSetter,
  isVgcMechanicWeatherAbuser,
  isVgcMechanicWeatherSetter,
  VgcTerrainFamily,
  VgcWeatherFamily,
} from './VgcMechanicProfiles';
import {
  evaluateVgcMechanicBlueprint,
  evaluateVgcMechanicCandidateFit,
  evaluateVgcCandidateArchetypeCompatibility,
  VgcMechanicCoverage,
} from './VgcArchetypeBlueprints';

export type VgcRole =
  | 'Weather Setter'
  | 'Weather Abuser'
  | 'Speed Control'
  | 'Turn Control'
  | 'Redirection'
  | 'Pivot'
  | 'Physical Damage'
  | 'Special Damage'
  | 'Spread Damage'
  | 'Anti Trick Room'
  | 'Anti Weather'
  | 'Defensive Glue'
  | 'Late Game Cleaner'
  | 'Priority'
  | 'Setup Pressure';

export type VgcArchetypeId =
  | 'sun_offense'
  | 'sun_trick_room'
  | 'rain_offense'
  | 'rain_tailwind'
  | 'rain_trick_room'
  | 'sand_balance'
  | 'snow_balance'
  | 'tailwind_balance'
  | 'hard_trick_room'
  | 'setup_redirection'
  | 'terrain_balance'
  | 'terrain_offense'
  | 'psychic_terrain_trick_room'
  | 'bulky_offense'
  | 'hyper_offense'
  | 'balance';

export interface VgcArchetypeAnalysis {
  id: VgcArchetypeId;
  label: string;
  confidence: number;
  signals: string[];
}

export interface VgcRoleCoverageAnalysis {
  detectedRoles: Record<VgcRole, string[]>;
  missingCriticalRoles: VgcRole[];
  missingImportantRoles: VgcRole[];
  redundancyWarnings: string[];
  coverageScore: number;
}

export interface VgcLeadEvaluation {
  lead: string[];
  score: number;
  reasons: string[];
}

export interface VgcModeEvaluation {
  selectedFour: string[];
  lead: string[];
  backline: string[];
  contractValid: boolean;
  contractErrors: string[];
  warnings: string[];
  score: number;
  leadOptions: VgcLeadEvaluation[];
  reasons: string[];
  tacticalInsights: TacticalInsight[];
}

export interface VgcModeAnalysis {
  modeConsistencyScore: number;
  viableModeCount: number;
  viableModes: VgcModeEvaluation[];
  bestLeads: VgcLeadEvaluation[];
}

export interface VgcMatchupReadiness {
  rain: number;
  trickRoom: number;
  tailwindOffense: number;
  setupRedirection: number;
  weatherWar: number;
  overallScore: number;
  notes: string[];
}

export interface VgcTeamPlanAnalysis {
  archetype: VgcArchetypeAnalysis;
  roleCoverage: VgcRoleCoverageAnalysis;
  mechanicCoverage: VgcMechanicCoverage;
  modeAnalysis: VgcModeAnalysis;
  matchupReadiness: VgcMatchupReadiness;
  recommendations: string[];
  concerns: string[];
  planSummary: string;
  score: number;
  teamInsights: TacticalInsight[];
  leadMetrics?: {
    mechanicalValidity: number;
    initialTurnExecution: number;
    disruptionResistance: number;
    offensiveConversion: number;
    strategicIndex: number;
  };
}

interface RoleRequirementProfile {
  critical: VgcRole[];
  important: VgcRole[];
}

const ALL_ROLES: VgcRole[] = [
  'Weather Setter',
  'Weather Abuser',
  'Speed Control',
  'Turn Control',
  'Redirection',
  'Pivot',
  'Physical Damage',
  'Special Damage',
  'Spread Damage',
  'Anti Trick Room',
  'Anti Weather',
  'Defensive Glue',
  'Late Game Cleaner',
  'Priority',
  'Setup Pressure',
];

const REQUIREMENTS: Record<VgcArchetypeId, RoleRequirementProfile> = {
  sun_offense: {
    critical: ['Weather Setter', 'Weather Abuser', 'Speed Control', 'Turn Control', 'Anti Trick Room', 'Physical Damage', 'Special Damage'],
    important: ['Anti Weather', 'Redirection', 'Pivot', 'Defensive Glue', 'Spread Damage', 'Late Game Cleaner'],
  },
  sun_trick_room: {
    critical: ['Weather Setter', 'Weather Abuser', 'Speed Control', 'Turn Control', 'Redirection', 'Physical Damage', 'Special Damage'],
    important: ['Anti Trick Room', 'Pivot', 'Defensive Glue', 'Spread Damage', 'Late Game Cleaner'],
  },
  rain_trick_room: {
    critical: ['Weather Setter', 'Weather Abuser', 'Speed Control', 'Turn Control', 'Redirection', 'Physical Damage', 'Special Damage'],
    important: ['Anti Trick Room', 'Pivot', 'Defensive Glue', 'Spread Damage', 'Late Game Cleaner'],
  },
  rain_offense: {
    critical: ['Weather Setter', 'Weather Abuser', 'Speed Control', 'Turn Control', 'Physical Damage', 'Special Damage'],
    important: ['Anti Weather', 'Redirection', 'Pivot', 'Anti Trick Room', 'Spread Damage', 'Late Game Cleaner'],
  },
  rain_tailwind: {
    critical: ['Weather Setter', 'Weather Abuser', 'Speed Control', 'Turn Control', 'Physical Damage', 'Special Damage'],
    important: ['Redirection', 'Pivot', 'Anti Trick Room', 'Spread Damage', 'Late Game Cleaner', 'Anti Weather'],
  },
  sand_balance: {
    critical: ['Weather Setter', 'Weather Abuser', 'Turn Control', 'Physical Damage', 'Special Damage', 'Defensive Glue'],
    important: ['Speed Control', 'Pivot', 'Anti Trick Room', 'Spread Damage', 'Late Game Cleaner'],
  },
  snow_balance: {
    critical: ['Weather Setter', 'Weather Abuser', 'Speed Control', 'Turn Control', 'Defensive Glue'],
    important: ['Anti Trick Room', 'Physical Damage', 'Special Damage', 'Pivot', 'Spread Damage'],
  },
  tailwind_balance: {
    critical: ['Speed Control', 'Turn Control', 'Physical Damage', 'Special Damage', 'Defensive Glue'],
    important: ['Redirection', 'Pivot', 'Anti Trick Room', 'Spread Damage', 'Late Game Cleaner'],
  },
  hard_trick_room: {
    critical: ['Speed Control', 'Turn Control', 'Redirection', 'Physical Damage', 'Special Damage', 'Defensive Glue'],
    important: ['Anti Trick Room', 'Pivot', 'Spread Damage', 'Late Game Cleaner'],
  },
  setup_redirection: {
    critical: ['Redirection', 'Setup Pressure', 'Turn Control', 'Speed Control', 'Physical Damage', 'Special Damage'],
    important: ['Defensive Glue', 'Pivot', 'Anti Trick Room', 'Spread Damage'],
  },
  terrain_balance: {
    critical: ['Turn Control', 'Speed Control', 'Physical Damage', 'Special Damage', 'Defensive Glue'],
    important: ['Redirection', 'Pivot', 'Anti Trick Room', 'Spread Damage', 'Late Game Cleaner'],
  },
  terrain_offense: {
    critical: ['Speed Control', 'Turn Control', 'Physical Damage', 'Special Damage', 'Spread Damage'],
    important: ['Redirection', 'Pivot', 'Anti Trick Room', 'Defensive Glue', 'Late Game Cleaner'],
  },
  psychic_terrain_trick_room: {
    critical: ['Speed Control', 'Turn Control', 'Redirection', 'Special Damage', 'Defensive Glue'],
    important: ['Physical Damage', 'Spread Damage', 'Late Game Cleaner', 'Pivot', 'Anti Trick Room'],
  },
  bulky_offense: {
    critical: ['Turn Control', 'Defensive Glue', 'Physical Damage', 'Special Damage', 'Speed Control'],
    important: ['Pivot', 'Redirection', 'Anti Trick Room', 'Spread Damage', 'Late Game Cleaner'],
  },
  hyper_offense: {
    critical: ['Speed Control', 'Turn Control', 'Physical Damage', 'Special Damage', 'Spread Damage'],
    important: ['Priority', 'Anti Trick Room', 'Anti Weather', 'Late Game Cleaner'],
  },
  balance: {
    critical: ['Speed Control', 'Turn Control', 'Physical Damage', 'Special Damage', 'Defensive Glue'],
    important: ['Pivot', 'Redirection', 'Anti Trick Room', 'Spread Damage', 'Late Game Cleaner', 'Anti Weather'],
  },
};

const clamp = (value: number, min = 0, max = 100): number =>
  Math.max(min, Math.min(max, Math.round(value)));

const normalize = (value?: string): string =>
  String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const hasAny = (values: string[], targets: string[]): boolean => {
  const normalizedTargets = targets.map(normalize);
  return values.some(value => normalizedTargets.includes(normalize(value)));
};

const isTrickRoomArchetype = (archetype: VgcArchetypeId): boolean =>
  ['hard_trick_room', 'sun_trick_room', 'psychic_terrain_trick_room', 'rain_trick_room'].includes(archetype);

const isSunArchetype = (archetype: VgcArchetypeId): boolean =>
  ['sun_offense', 'sun_trick_room'].includes(archetype);

const isRainArchetype = (archetype: VgcArchetypeId): boolean =>
  ['rain_offense', 'rain_tailwind', 'rain_trick_room'].includes(archetype);

const isTerrainArchetype = (archetype: VgcArchetypeId): boolean =>
  ['terrain_balance', 'terrain_offense', 'psychic_terrain_trick_room'].includes(archetype);

const SUN_SETTERS = ['Drought', 'Orichalcum Pulse', 'Desolate Land'];
const SUN_MOVES = ['Sunny Day'];
const PRIMARY_SUN_ABUSER_ABILITIES = ['Chlorophyll', 'Solar Power', 'Flower Gift', 'Harvest'];
const SUN_COMPATIBLE_ABUSER_ABILITIES = ['Protosynthesis'];
const TRUE_SUN_ABUSER_ABILITIES = [...PRIMARY_SUN_ABUSER_ABILITIES, ...SUN_COMPATIBLE_ABUSER_ABILITIES];
const TRUE_RAIN_ABUSER_ABILITIES = ['Swift Swim'];
const RAIN_COMPATIBLE_ABUSER_ABILITIES = ['Rain Dish', 'Dry Skin', 'Hydration'];
const TRUE_SAND_ABUSER_ABILITIES = ['Sand Rush', 'Sand Force', 'Sand Veil'];
const TRUE_SNOW_ABUSER_ABILITIES = ['Slush Rush', 'Ice Body', 'Snow Cloak'];
const WEATHER_SETTER_ABILITIES = [
  ...SUN_SETTERS,
  'Drizzle',
  'Primordial Sea',
  'Sand Stream',
  'Sand Spit',
  'Snow Warning',
];
const WEATHER_SETTER_MOVES = ['Sunny Day', 'Rain Dance', 'Sandstorm', 'Snowscape'];


const TRICK_ROOM_SETTER_SPECIES = new Set([
  'farigiraf',
  'cresselia',
  'porygon2',
  'dusclops',
  'dusknoir',
  'hatterene',
  'indeedee',
  'indeedeef',
  'indeedeefemale',
  'armarouge',
  'oranguru',
  'mimikyu',
  'bronzong',
  'gothitelle',
  'stakataka',
  'carbink',
  'slowbro',
  'slowking',
  'reuniclus',
  'aromatisse',
]);

const TRICK_ROOM_ABUSER_SPECIES = new Set([
  'torkoal',
  'mawile',
  'mawilemega',
  'camerupt',
  'cameruptmega',
  'ursaluna',
  'ursalunabloodmoon',
  'ironhands',
  'hatterene',
  'kingambit',
  'rhyperior',
  'glastrier',
  'calyrexice',
  'marowakalola',
  'araquanid',
  'amoonguss',
]);

const REDIRECTION_SUPPORT_SPECIES = new Set([
  'indeedeef',
  'indeedeefemale',
  'amoonguss',
  'maushold',
  'clefairy',
  'clefable',
  'togekiss',
  'brutebonnet',
]);

const PREMIUM_TRICK_ROOM_REDIRECTION_SPECIES = new Set([
  'amoonguss',
  'brutebonnet',
  'indeedeef',
  'indeedeefemale',
  'clefairy',
  'maushold',
  'togekiss',
]);

const DISFAVORED_TRICK_ROOM_SETUP_SPECIES = new Set([
  'volcarona',
  'dragonite',
  'salamence',
  'gyarados',
]);

function getVgcProfileKey(pokemon: PokemonData): string {
  return normalize(pokemon.name);
}

export function isLikelyTrickRoomSetterForVgc(pokemon: PokemonData): boolean {
  return isVgcMechanicTrickRoomSetter(pokemon) || TRICK_ROOM_SETTER_SPECIES.has(getVgcProfileKey(pokemon));
}

export function isLikelyTrickRoomAbuserForVgc(pokemon: PokemonData, format: string): boolean {
  const speed = Number(getVariant(pokemon, format)?.baseStats?.spe ?? 999);
  return isVgcMechanicTrickRoomAbuser(pokemon) || TRICK_ROOM_ABUSER_SPECIES.has(getVgcProfileKey(pokemon)) || speed <= 55;
}

export function hasLikelyTrickRoomCoreForVgc(team: PokemonData[], format: string): boolean {
  const hasSetter = team.some(pokemon => isLikelyTrickRoomSetterForVgc(pokemon) || hasAny(getMoveValues(pokemon), ['Trick Room']));
  const slowAbusers = team.filter(pokemon => isLikelyTrickRoomAbuserForVgc(pokemon, format)).length;
  return hasSetter && slowAbusers >= 1;
}

export function isLikelyRedirectionSupportForVgc(pokemon: PokemonData): boolean {
  const key = getVgcProfileKey(pokemon);
  return hasAny(getMoveValues(pokemon), ['Follow Me', 'Rage Powder', 'Ally Switch']) ||
    isVgcMechanicRedirectionSupport(pokemon) ||
    REDIRECTION_SUPPORT_SPECIES.has(key);
}

export function isPremiumTrickRoomRedirectionForVgc(pokemon: PokemonData): boolean {
  return PREMIUM_TRICK_ROOM_REDIRECTION_SPECIES.has(getVgcProfileKey(pokemon));
}

const hasActiveSunSetter = (pokemon: PokemonData, format: string): boolean =>
  isVgcMechanicWeatherSetter(pokemon, 'sun') ||
  hasAny(getAbilityValues(pokemon, format), SUN_SETTERS) ||
  hasAny(getMoveValues(pokemon), SUN_MOVES);

const hasPrimarySunAbuser = (pokemon: PokemonData, format: string): boolean =>
  isVgcMechanicWeatherAbuser(pokemon, 'sun', true) ||
  hasAny(getAbilityValues(pokemon, format), PRIMARY_SUN_ABUSER_ABILITIES) ||
  hasAny(getMoveValues(pokemon), ['Weather Ball', 'Solar Blade']) ||
  /sun abuser|chlorophyll|solar power/i.test(getTagValues(pokemon).join(' '));

const hasSunCompatibleAbuser = (pokemon: PokemonData, format: string): boolean =>
  isVgcMechanicWeatherAbuser(pokemon, 'sun') ||
  hasAny(getAbilityValues(pokemon, format), SUN_COMPATIBLE_ABUSER_ABILITIES);

const hasTrueSunAbuser = (pokemon: PokemonData, format: string): boolean =>
  hasPrimarySunAbuser(pokemon, format) || hasSunCompatibleAbuser(pokemon, format);

const hasActiveRainSetter = (pokemon: PokemonData, format: string): boolean =>
  isVgcMechanicWeatherSetter(pokemon, 'rain') ||
  hasAny(getAbilityValues(pokemon, format), ['Drizzle', 'Primordial Sea']) ||
  hasAny(getMoveValues(pokemon), ['Rain Dance']);

const hasPrimaryRainAbuser = (pokemon: PokemonData, format: string): boolean =>
  isVgcMechanicWeatherAbuser(pokemon, 'rain', true) ||
  hasAny(getAbilityValues(pokemon, format), TRUE_RAIN_ABUSER_ABILITIES) ||
  /rain abuser|swift swim/i.test(getTagValues(pokemon).join(' '));

const hasRainSupport = (pokemon: PokemonData, format: string): boolean =>
  isVgcMechanicTailwindSetter(pokemon) ||
  getVgcMechanicTags(pokemon).some(tag => tag.mechanic === 'weather' && tag.weather === 'rain' && tag.role === 'support' && tag.confidence >= 0.6) ||
  hasAny(getMoveValues(pokemon), ['Tailwind', 'Rain Dance', 'Helping Hand', 'Icy Wind', 'Muddy Water']) ||
  hasAny(getAbilityValues(pokemon, format), ['Prankster', 'Drizzle']);

const hasAnyTrueWeatherAbuser = (team: PokemonData[], format: string): boolean =>
  team.some(pokemon =>
    hasTrueSunAbuser(pokemon, format) ||
    isVgcMechanicWeatherAbuser(pokemon) ||
    hasAny(getAbilityValues(pokemon, format), TRUE_RAIN_ABUSER_ABILITIES) ||
    hasAny(getAbilityValues(pokemon, format), RAIN_COMPATIBLE_ABUSER_ABILITIES) ||
    hasAny(getAbilityValues(pokemon, format), TRUE_SAND_ABUSER_ABILITIES) ||
    hasAny(getAbilityValues(pokemon, format), TRUE_SNOW_ABUSER_ABILITIES),
  );

const countMove = (team: PokemonData[], moveName: string): number =>
  team.filter(pokemon => hasAny(getMoveValues(pokemon), [moveName])).length;

const countAbility = (team: PokemonData[], format: string, abilityName: string): number =>
  team.filter(pokemon => hasAny(getAbilityValues(pokemon, format), [abilityName])).length;

function getWeatherFamilies(team: PokemonData[], format: string): Set<string> {
  const families = new Set<string>();

  for (const pokemon of team) {
    const abilities = getAbilityValues(pokemon, format);
    const moves = getMoveValues(pokemon);

    if (isVgcMechanicWeatherSetter(pokemon, 'sun') || hasAny(abilities, SUN_SETTERS) || hasAny(moves, ['Sunny Day'])) families.add('sun');
    if (isVgcMechanicWeatherSetter(pokemon, 'rain') || hasAny(abilities, ['Drizzle', 'Primordial Sea']) || hasAny(moves, ['Rain Dance'])) families.add('rain');
    if (isVgcMechanicWeatherSetter(pokemon, 'sand') || hasAny(abilities, ['Sand Stream', 'Sand Spit']) || hasAny(moves, ['Sandstorm'])) families.add('sand');
    if (isVgcMechanicWeatherSetter(pokemon, 'snow') || hasAny(abilities, ['Snow Warning']) || hasAny(moves, ['Snowscape'])) families.add('snow');
  }

  return families;
}

const combinations = <T>(items: T[], size: number): T[][] => {
  if (size === 0) return [[]];
  if (items.length < size) return [];

  const [first, ...rest] = items;

  return [
    ...combinations(rest, size - 1).map(combo => [first, ...combo]),
    ...combinations(rest, size),
  ];
};


export function hasActiveSunSetterForVgc(pokemon: PokemonData, format: string): boolean {
  return hasActiveSunSetter(pokemon, format);
}

export function hasPrimarySunAbuserForVgc(pokemon: PokemonData, format: string): boolean {
  return hasPrimarySunAbuser(pokemon, format);
}

export function hasSunCompatibleAbuserForVgc(pokemon: PokemonData, format: string): boolean {
  return hasSunCompatibleAbuser(pokemon, format);
}

export function hasActiveRainSetterForVgc(pokemon: PokemonData, format: string): boolean {
  return hasActiveRainSetter(pokemon, format);
}

export function hasPrimaryRainAbuserForVgc(pokemon: PokemonData, format: string): boolean {
  return hasPrimaryRainAbuser(pokemon, format);
}

function countSevereWeakness(team: PokemonData[], format: string, attackType: string, threshold = 4): number {
  return team.filter(pokemon => getDamageMultiplier(getPokemonTypes(pokemon, format), attackType) >= threshold).length;
}

function countTypeMembers(team: PokemonData[], format: string, typeName: string): number {
  return team.filter(pokemon => getPokemonTypes(pokemon, format).some(type => normalize(type) === normalize(typeName))).length;
}

export function inferVgcRoles(pokemon: PokemonData, format: string): VgcRole[] {
  const roles = new Set<VgcRole>();
  const stats = getVariant(pokemon, format)?.baseStats;
  const abilityValues = getAbilityValues(pokemon, format);
  const moveValues = getMoveValues(pokemon);
  const tagValues = getTagValues(pokemon);
  const roleText = [...(pokemon.competitive?.roles ?? []), pokemon.role ?? ''].join(' ');
  const profileKey = getVgcProfileKey(pokemon);
  const isTrickRoomSetterProfile = isLikelyTrickRoomSetterForVgc(pokemon);
  const isTrickRoomAbuserProfile = isLikelyTrickRoomAbuserForVgc(pokemon, format);
  const mechanicTags = getVgcMechanicTags(pokemon);

  const wantsPhysicalRole = /physical|físico|fisico/i.test(roleText);
  const wantsSpecialRole = /special|especial/i.test(roleText);

  const atk = Number(stats?.atk ?? 0);
  const spa = Number(stats?.spa ?? 0);
  const hp = Number(stats?.hp ?? 0);
  const def = Number(stats?.def ?? 0);
  const spd = Number(stats?.spd ?? 0);
  const spe = Number(stats?.spe ?? 0);

  const isWeatherSetter = isVgcMechanicWeatherSetter(pokemon) ||
      hasAny(abilityValues, WEATHER_SETTER_ABILITIES) ||
      hasAny(moveValues, WEATHER_SETTER_MOVES);

  if (isWeatherSetter) {
    roles.add('Weather Setter');
    roles.add('Anti Weather');
  }

  const hasWeatherBoostAbility =
    mechanicTags.some(tag => tag.mechanic === 'weather' && tag.role === 'abuser' && tag.confidence >= 0.5) ||
    hasAny(abilityValues, TRUE_SUN_ABUSER_ABILITIES) ||
    hasAny(abilityValues, TRUE_RAIN_ABUSER_ABILITIES) ||
    hasAny(abilityValues, TRUE_SAND_ABUSER_ABILITIES) ||
    hasAny(abilityValues, TRUE_SNOW_ABUSER_ABILITIES);
  const hasDedicatedWeatherAttack = hasAny(moveValues, ['Weather Ball', 'Solar Blade']) ||
    (hasAny(moveValues, ['Solar Beam']) && !isWeatherSetter);

  if (hasWeatherBoostAbility || hasDedicatedWeatherAttack) {
    roles.add('Weather Abuser');
  }

  if (hasAny(moveValues, ['Tailwind', 'Icy Wind', 'Electroweb', 'Trick Room', 'Thunder Wave', 'Scary Face', 'Quash']) ||
      isTrickRoomSetterProfile ||
      isVgcMechanicTailwindSetter(pokemon) ||
      hasAny(abilityValues, ['Swift Swim', 'Chlorophyll', 'Sand Rush', 'Slush Rush']) ||
      (hasAny(abilityValues, ['Prankster']) && hasAny(moveValues, ['Tailwind', 'Sunny Day', 'Encore', 'Taunt']))) {
    roles.add('Speed Control');
  }

  if (hasAny(moveValues, ['Fake Out', 'Parting Shot', 'Encore', 'Taunt', 'Follow Me', 'Rage Powder', 'Spore', 'Sleep Powder', 'Will-O-Wisp', 'Snarl', 'Helping Hand', 'Wide Guard', 'Quick Guard']) ||
      isTrickRoomSetterProfile ||
      isVgcMechanicRedirectionSupport(pokemon) ||
      isVgcMechanicTerrainSetter(pokemon) ||
      mechanicTags.some(tag => tag.mechanic === 'turn_control' && tag.confidence >= 0.65) ||
      hasAny(abilityValues, ['Intimidate', 'Prankster', 'Armor Tail', 'Queenly Majesty', 'Psychic Surge'])) {
    roles.add('Turn Control');
  }

  if (isLikelyRedirectionSupportForVgc(pokemon)) {
    roles.add('Redirection');
  }

  if (hasAny(moveValues, ['Parting Shot', 'U-turn', 'Volt Switch', 'Flip Turn']) ||
      mechanicTags.some(tag => tag.mechanic === 'turn_control' && tag.role === 'support' && tag.confidence >= 0.8) ||
      hasAny(abilityValues, ['Intimidate', 'Regenerator'])) {
    roles.add('Pivot');
  }

  if (atk >= 105 || wantsPhysicalRole || (isTrickRoomAbuserProfile && atk > spa && atk >= 85 && !wantsSpecialRole)) {
    roles.add('Physical Damage');
  }

  if (spa >= 105 || wantsSpecialRole || (isTrickRoomAbuserProfile && spa >= atk && spa >= 85 && !wantsPhysicalRole)) {
    roles.add('Special Damage');
  }

  if (hasAny(moveValues, ['Heat Wave', 'Dazzling Gleam', 'Earthquake', 'Rock Slide', 'Hyper Voice', 'Muddy Water', 'Eruption', 'Water Spout', 'Make It Rain', 'Blizzard', 'Discharge', 'Icy Wind'])) {
    roles.add('Spread Damage');
  }

  if (hasAny(moveValues, ['Taunt', 'Encore', 'Imprison', 'Fake Out', 'Roar', 'Whirlwind', 'Spore', 'Sleep Powder']) ||
      hasAny(tagValues, ['Anti Trick Room'])) {
    roles.add('Anti Trick Room');
  }

  if (hasAny(abilityValues, ['Intimidate', 'Friend Guard', 'Armor Tail', 'Psychic Surge']) ||
      hasAny(moveValues, ['Reflect', 'Light Screen', 'Aurora Veil', 'Snarl', 'Will-O-Wisp', 'Parting Shot']) ||
      isTrickRoomSetterProfile ||
      isVgcMechanicRedirectionSupport(pokemon) ||
      isVgcMechanicTerrainSetter(pokemon) ||
      (hp + def + spd >= 280 && hp >= 75)) {
    roles.add('Defensive Glue');
  }

  if (hasAny(moveValues, ['Swords Dance', 'Nasty Plot', 'Calm Mind', 'Dragon Dance', 'Bulk Up', 'Growth', 'Quiver Dance']) ||
      mechanicTags.some(tag => tag.mechanic === 'setup' && tag.confidence >= 0.65)) {
    roles.add('Setup Pressure');
  }

  if (hasAny(moveValues, ['Sucker Punch', 'Extreme Speed', 'Aqua Jet', 'Grassy Glide', 'Bullet Punch', 'Mach Punch', 'Ice Shard', 'Shadow Sneak', 'Fake Out']) ||
      mechanicTags.some(tag => tag.mechanic === 'priority' && tag.confidence >= 0.65) ||
      hasAny(abilityValues, ['Supreme Overlord', 'Moxie', 'Beast Boost'])) {
    roles.add('Priority');
  }

  if ((atk >= 115 || spa >= 115) && (spe >= 95 || roles.has('Priority') || isTrickRoomAbuserProfile || hasAny(abilityValues, ['Supreme Overlord', 'Moxie', 'Beast Boost']))) {
    roles.add('Late Game Cleaner');
  }

  return [...roles];
}

export function inferVgcArchetype(team: PokemonData[], format: string): VgcArchetypeAnalysis {
  const rolesByPokemon = team.map(pokemon => ({ pokemon, roles: inferVgcRoles(pokemon, format) }));
  const abilityValues = team.flatMap(pokemon => getAbilityValues(pokemon, format));
  const moveValues = team.flatMap(getMoveValues);
  const signals: string[] = [];

  const hasSunSetter = team.some(pokemon => isVgcMechanicWeatherSetter(pokemon, 'sun')) || hasAny(abilityValues, SUN_SETTERS) || hasAny(moveValues, SUN_MOVES);
  const hasRainSetter = team.some(pokemon => isVgcMechanicWeatherSetter(pokemon, 'rain')) || hasAny(abilityValues, ['Drizzle']) || hasAny(moveValues, ['Rain Dance']);
  const hasSandSetter = team.some(pokemon => isVgcMechanicWeatherSetter(pokemon, 'sand')) || hasAny(abilityValues, ['Sand Stream']) || hasAny(moveValues, ['Sandstorm']);
  const hasSnowSetter = team.some(pokemon => isVgcMechanicWeatherSetter(pokemon, 'snow')) || hasAny(abilityValues, ['Snow Warning']) || hasAny(moveValues, ['Snowscape']);
  const hasPrimaryDedicatedSunAbuser = team.some(pokemon => hasPrimarySunAbuser(pokemon, format));
  const hasCompatibleSunAbuser = team.some(pokemon => hasSunCompatibleAbuser(pokemon, format));
  const hasRainAbuser = team.some(pokemon => isVgcMechanicWeatherAbuser(pokemon, 'rain')) || hasAny(abilityValues, ['Swift Swim']);
  const hasSandAbuser = team.some(pokemon => isVgcMechanicWeatherAbuser(pokemon, 'sand')) || hasAny(abilityValues, ['Sand Rush', 'Sand Force', 'Sand Veil']);
  const hasSnowAbuser = team.some(pokemon => isVgcMechanicWeatherAbuser(pokemon, 'snow')) || hasAny(abilityValues, ['Slush Rush', 'Ice Body', 'Snow Cloak']);
  const hasTailwind = team.some(pokemon => isVgcMechanicTailwindSetter(pokemon)) || hasAny(moveValues, ['Tailwind']);
  const hasTerrainSetter = team.some(pokemon => isVgcMechanicTerrainSetter(pokemon));
  const hasTerrainAbuser = team.some(pokemon => isVgcMechanicTerrainAbuser(pokemon));
  const hasPsychicTerrain = team.some(pokemon => isVgcMechanicTerrainSetter(pokemon, 'psychic')) || hasAny(abilityValues, ['Psychic Surge']);
  const hasElectricTerrain = team.some(pokemon => isVgcMechanicTerrainSetter(pokemon, 'electric')) || hasAny(abilityValues, ['Electric Surge', 'Hadron Engine']);
  const hasGrassyTerrain = team.some(pokemon => isVgcMechanicTerrainSetter(pokemon, 'grassy')) || hasAny(abilityValues, ['Grassy Surge']);
  const hasTrickRoom = hasAny(moveValues, ['Trick Room']);
  const hasTrickRoomSetterProfile = team.some(pokemon => isLikelyTrickRoomSetterForVgc(pokemon));
  const trickRoomAbuserCount = team.filter(pokemon => isLikelyTrickRoomAbuserForVgc(pokemon, format)).length;
  const hasLikelyTrickRoomCore = hasTrickRoom || (hasTrickRoomSetterProfile && trickRoomAbuserCount >= 1);
  const hasRedirection = rolesByPokemon.some(item => item.roles.includes('Redirection'));
  const hasSetup = rolesByPokemon.some(item => item.roles.includes('Setup Pressure'));
  const fastAttackers = rolesByPokemon.filter(({ pokemon, roles }) => {
    const spe = Number(getVariant(pokemon, format)?.baseStats?.spe ?? 0);
    return spe >= 105 && (roles.includes('Physical Damage') || roles.includes('Special Damage'));
  }).length;

  if (hasLikelyTrickRoomCore && hasRainSetter) {
    signals.push('Setter provável de Trick Room + clima de chuva detectados');
    return { id: 'rain_trick_room', label: 'RainRoom', confidence: hasTrickRoom ? 94 : 88, signals };
  }

  if (hasLikelyTrickRoomCore && hasSunSetter) {
    signals.push('Setter provável de Trick Room + clima de sol detectados');
    return { id: 'sun_trick_room', label: 'Trick Room Sun', confidence: hasTrickRoom ? 94 : 88, signals };
  }

  if (hasLikelyTrickRoomCore && hasPsychicTerrain) {
    signals.push('Psychic Terrain + Trick Room/abuser lento detectados');
    return { id: 'psychic_terrain_trick_room', label: 'Psychic Terrain Trick Room', confidence: hasTrickRoom ? 93 : 87, signals };
  }

  if (hasLikelyTrickRoomCore) {
    signals.push(hasTrickRoom
      ? 'Trick Room presente no plano'
      : 'Setter provável de Trick Room + atacante lento detectados');
    return { id: 'hard_trick_room', label: 'Hard Trick Room', confidence: hasTrickRoom ? 92 : 86, signals };
  }

  if (hasSunSetter && hasPrimaryDedicatedSunAbuser) {
    signals.push('Drought/Sunny Day + abuser primário de sol');
    return { id: 'sun_offense', label: 'Sun Offense', confidence: 94, signals };
  }

  if (hasSunSetter && hasCompatibleSunAbuser) {
    signals.push('Drought/Sunny Day + abuser compatível com sol, mas sem abuser primário');
    return { id: 'sun_offense', label: 'Sun Offense', confidence: 82, signals };
  }

  if (hasSunSetter) {
    signals.push('Drought/Sunny Day presente, mas ainda sem abuser primário de sol');
    return { id: 'sun_offense', label: 'Sun Offense', confidence: 74, signals };
  }

  if (hasRainSetter && hasRainAbuser && hasTailwind) {
    signals.push('Rain + abuser de chuva + Tailwind');
    return { id: 'rain_tailwind', label: 'Rain Tailwind', confidence: 93, signals };
  }

  if (hasRainSetter && hasRainAbuser) {
    signals.push('Rain + abuser de chuva');
    return { id: 'rain_offense', label: 'Rain Offense', confidence: 90, signals };
  }

  if (hasSandSetter && hasSandAbuser) {
    signals.push('Sand + Sand Rush/Force/Veil');
    return { id: 'sand_balance', label: 'Sand Balance', confidence: 84, signals };
  }

  if (hasSnowSetter && hasSnowAbuser) {
    signals.push('Snow + abuser de neve');
    return { id: 'snow_balance', label: 'Snow Balance', confidence: 82, signals };
  }

  if (hasTerrainSetter && hasTerrainAbuser) {
    signals.push('Terrain setter + terrain abuser detectados');
    return { id: fastAttackers >= 2 ? 'terrain_offense' : 'terrain_balance', label: fastAttackers >= 2 ? 'Terrain Offense' : 'Terrain Balance', confidence: 82, signals };
  }

  if (hasTerrainSetter && (hasElectricTerrain || hasGrassyTerrain || hasPsychicTerrain)) {
    signals.push('Setter de terreno detectado como eixo de suporte');
    return { id: fastAttackers >= 2 ? 'terrain_offense' : 'terrain_balance', label: fastAttackers >= 2 ? 'Terrain Offense' : 'Terrain Balance', confidence: 74, signals };
  }

  if (hasRedirection && hasSetup) {
    signals.push('Redirection + setup pressure');
    return { id: 'setup_redirection', label: 'Setup + Redirection', confidence: 78, signals };
  }

  if (hasTailwind) {
    signals.push('Tailwind como controle de velocidade principal');
    return { id: 'tailwind_balance', label: 'Tailwind Balance', confidence: 76, signals };
  }

  if (fastAttackers >= 3) {
    signals.push('Múltiplos atacantes rápidos');
    return { id: 'hyper_offense', label: 'Hyper Offense', confidence: 68, signals };
  }

  signals.push('Estrutura genérica de balance/bulky offense');
  return { id: 'balance', label: 'Balance', confidence: 58, signals };
}

export function evaluateVgcTeamPlan(team: PokemonData[], format: string, lockedLead?: [string, string]): VgcTeamPlanAnalysis {
  const archetype = inferVgcArchetype(team, format);
  const roleCoverage = evaluateRoleCoverage(team, format, archetype.id);
  const mechanicCoverage = evaluateVgcMechanicBlueprint(team, format, archetype.id);
  const modeAnalysis = evaluateModes(team, format, archetype.id, lockedLead);
  const matchupReadiness = evaluateMatchups(team, format);

  const score = clamp(
    mechanicCoverage.score * 0.34 +
      roleCoverage.coverageScore * 0.22 +
      modeAnalysis.modeConsistencyScore * 0.26 +
      matchupReadiness.overallScore * 0.12 +
      archetype.confidence * 0.06,
  );

  const recommendations = buildRecommendations(roleCoverage, mechanicCoverage, modeAnalysis, matchupReadiness, archetype);
  const concerns = buildConcerns(roleCoverage, mechanicCoverage, modeAnalysis, matchupReadiness);

  const teamInsights = analyzeTacticalInteractions(team, format);

  return {
    archetype,
    roleCoverage,
    mechanicCoverage,
    modeAnalysis,
    matchupReadiness,
    recommendations,
    concerns,
    planSummary: buildPlanSummary(archetype, roleCoverage, mechanicCoverage, modeAnalysis, score),
    score,
    teamInsights,
  };
}

export function evaluateVgcCandidateFit(
  candidate: PokemonData,
  baseTeam: PokemonData[],
  format: string,
  teamIdentity?: string,
): { score: number; reasons: string[]; roles: VgcRole[]; archetype: VgcArchetypeAnalysis } {
  const archetype = inferVgcArchetype(baseTeam, format);
  const baseCoverage = evaluateRoleCoverage(baseTeam, format, archetype.id);
  const candidateRoles = inferVgcRoles(candidate, format);
  const reasons: string[] = [];
  let score = 0;

  for (const role of candidateRoles) {
    if (baseCoverage.missingCriticalRoles.includes(role)) {
      score += 22;
      reasons.push(`Preenche função crítica VGC: ${role}`);
    } else if (baseCoverage.missingImportantRoles.includes(role)) {
      score += 12;
      reasons.push(`Complementa função importante VGC: ${role}`);
    }
  }

  const mechanicFit = evaluateVgcMechanicCandidateFit(candidate, baseTeam, format, archetype.id);
  if (mechanicFit.score !== 0) {
    score += mechanicFit.score;
    reasons.push(...mechanicFit.reasons);
  }

  const compatibilityFit = evaluateVgcCandidateArchetypeCompatibility(candidate, baseTeam, format, archetype.id);
  if (compatibilityFit.score !== 0) {
    score += compatibilityFit.score;
  }
  if (compatibilityFit.warnings.length) {
    score -= compatibilityFit.warnings.length * 18;
    reasons.push(...compatibilityFit.warnings.slice(0, 2));
  }
  if (compatibilityFit.hardFailures.length) {
    score -= compatibilityFit.hardFailures.length * 90;
    reasons.push(...compatibilityFit.hardFailures.slice(0, 2));
  }

  const baseHasSunSetter = baseTeam.some(teammate => hasActiveSunSetter(teammate, format));
  const baseHasPrimarySunAbuser = baseTeam.some(teammate => hasPrimarySunAbuser(teammate, format));
  const candidateIsPrimarySunAbuser = hasPrimarySunAbuser(candidate, format);
  const candidateIsSunCompatibleAbuser = hasSunCompatibleAbuser(candidate, format);
  const baseRoles = baseTeam.flatMap(teammate => inferVgcRoles(teammate, format));
  const baseHasRedirection = baseRoles.includes('Redirection');
  const baseHasDefensiveGlue = baseRoles.includes('Defensive Glue');
  const candidateIsTrickRoomSetter = isLikelyTrickRoomSetterForVgc(candidate) || candidateRoles.includes('Speed Control') && hasAny(getMoveValues(candidate), ['Trick Room']);
  const candidateIsTrickRoomAbuser = isLikelyTrickRoomAbuserForVgc(candidate, format);
  const baseHasTerrainSetter = baseTeam.some(teammate => isVgcMechanicTerrainSetter(teammate));
  const candidateIsTerrainSetter = isVgcMechanicTerrainSetter(candidate);
  const candidateIsTerrainAbuser = isVgcMechanicTerrainAbuser(candidate);

  if (isTrickRoomArchetype(archetype.id)) {
    const candidateSpeed = Number(getVariant(candidate, format)?.baseStats?.spe ?? 999);

    if (candidateIsTrickRoomSetter) {
      score += 42;
      reasons.push('Preserva ou reforça o plano de Trick Room');
    }

    if (candidateIsTrickRoomAbuser) {
      score += candidateSpeed <= 45 ? 34 : 22;
      reasons.push('Funciona como atacante lento para jogar dentro de Trick Room');
    }

    if (!baseHasRedirection && candidateRoles.includes('Redirection')) {
      score += isPremiumTrickRoomRedirectionForVgc(candidate) ? 76 : 42;
      reasons.push(isPremiumTrickRoomRedirectionForVgc(candidate)
        ? 'Garante Trick Room com redirection premium para o arquétipo'
        : 'Ajuda a garantir Trick Room com redirecionamento');
    }

    if (isPremiumTrickRoomRedirectionForVgc(candidate)) {
      score += 24;
      reasons.push('É um suporte naturalmente coerente com times lentos de Trick Room');
    }

    if (candidateSpeed >= 100 && !candidateRoles.includes('Turn Control') && teamIdentity !== 'offensive' && teamIdentity !== 'creative') {
      score -= 34;
    }

    if (candidateSpeed >= 85 && candidateRoles.includes('Setup Pressure') && !candidateRoles.includes('Redirection')) {
      score -= 42;
    }

    if (DISFAVORED_TRICK_ROOM_SETUP_SPECIES.has(normalize(candidate.name))) {
      score -= 46;
    }
  }

  if (isTerrainArchetype(archetype.id) || baseHasTerrainSetter || candidateIsTerrainSetter) {
    if (candidateIsTerrainSetter && !baseHasTerrainSetter) {
      score += 28;
      reasons.push('Adiciona setter de terreno para habilitar o modo de campo');
    }

    if (candidateIsTerrainAbuser && baseHasTerrainSetter) {
      score += 24;
      reasons.push('Aproveita o terreno já presente no core');
    }

    if (candidateRoles.includes('Turn Control') || candidateRoles.includes('Redirection')) {
      score += 10;
      reasons.push('Ajuda a preservar o plano de terreno com suporte de turno');
    }
  }

  const baseHasRainSetter = baseTeam.some(teammate => hasActiveRainSetter(teammate, format));
  const baseRainAbuserCount = baseTeam.filter(teammate => hasPrimaryRainAbuser(teammate, format)).length;
  const candidateIsPrimaryRainAbuser = hasPrimaryRainAbuser(candidate, format);
  const candidateIsRainSupport = hasRainSupport(candidate, format);

  if (isRainArchetype(archetype.id) && baseHasRainSetter) {
    if (candidateIsPrimaryRainAbuser) {
      score += baseRainAbuserCount === 0 ? 78 : 46;
      reasons.push(baseRainAbuserCount === 0
        ? 'Completa o modo de chuva com um abuser primário'
        : 'Adiciona segundo abuser de chuva para manter pressão quando os 4 escolhidos mudam');
    }

    if (candidateIsRainSupport && !candidateIsPrimaryRainAbuser) {
      score += 22;
      reasons.push('Adiciona suporte compatível com Rain, como Tailwind, Rain Dance, Icy Wind ou Helping Hand');
    }

    if (!baseHasRedirection && candidateRoles.includes('Redirection')) {
      score += 28;
      reasons.push('Protege o abuser de chuva ou o setter em leads de pressão');
    }

    const candidateTypes = getPokemonTypes(candidate, format).map(type => normalize(type));
    const isOffPlanFire = candidateTypes.includes('fire') && !candidateRoles.includes('Redirection') && !candidateRoles.includes('Turn Control');
    if (isOffPlanFire) {
      score -= 48;
      reasons.push('Fire-type sem função de suporte tende a perder valor sob chuva');
    }
  }

  if (isSunArchetype(archetype.id) && baseHasSunSetter && candidateIsPrimarySunAbuser && !baseHasPrimarySunAbuser) {
    score += normalize(candidate.name) === 'venusaur' ? 76 : 48;
    reasons.push(normalize(candidate.name) === 'venusaur'
      ? 'Completa o modo clássico Drought + Chlorophyll com o abuser mais consistente'
      : 'Completa o plano de sol com um abuser primário');
  }

  if (isSunArchetype(archetype.id) && baseHasSunSetter && candidateIsSunCompatibleAbuser && !baseHasPrimarySunAbuser) {
    score += 10;
    reasons.push('Aproveita o sol, mas não substitui um abuser primário como Chlorophyll/Solar Power');
  }

  if (isSunArchetype(archetype.id) && normalize(candidate.name) === 'venusaur' && baseHasSunSetter) {
    score += 38;
    reasons.push('Forma core clássico de Sun: Drought + Chlorophyll');
  }

  if (isSunArchetype(archetype.id) && baseHasSunSetter && !baseHasRedirection && candidateRoles.includes('Redirection')) {
    score += 38;
    reasons.push('Protege o modo de sol com redirection para Charizard/Venusaur');
  }

  if (isSunArchetype(archetype.id) && baseHasSunSetter && !baseHasDefensiveGlue && candidateRoles.includes('Defensive Glue')) {
    score += 12;
    reasons.push('Adiciona cola defensiva para estabilizar o plano de sol');
  }

  const candidateTeam = [...baseTeam, candidate];
  const pairScore = baseTeam.reduce((sum, teammate) => sum + evaluateLeadPair([candidate, teammate], format, archetype.id).score, 0);
  score += Math.min(35, Math.round(pairScore / Math.max(1, baseTeam.length)));

  if (candidateRoles.includes('Turn Control') && candidateRoles.includes('Pivot')) {
    score += 8;
    reasons.push('Adiciona controle de turno e reposicionamento');
  }

  if (candidateRoles.includes('Speed Control') && !baseCoverage.detectedRoles['Speed Control']?.length) {
    score += 16;
    reasons.push('Cria segunda camada de controle de velocidade');
  }

  if (candidateRoles.includes('Anti Trick Room') && !baseCoverage.detectedRoles['Anti Trick Room']?.length) {
    score += 14;
    reasons.push('Melhora a resposta contra Trick Room');
  }

  const partialPlan = evaluateRoleCoverage(candidateTeam, format, archetype.id);
  if (partialPlan.coverageScore > baseCoverage.coverageScore) {
    score += Math.min(18, partialPlan.coverageScore - baseCoverage.coverageScore);
  }

  return {
    score,
    reasons: reasons.slice(0, 5),
    roles: candidateRoles,
    archetype,
  };
}

function evaluateRoleCoverage(team: PokemonData[], format: string, archetype: VgcArchetypeId): VgcRoleCoverageAnalysis {
  const detectedRoles = Object.fromEntries(ALL_ROLES.map(role => [role, [] as string[]])) as unknown as Record<VgcRole, string[]>;

  for (const pokemon of team) {
    for (const role of inferVgcRoles(pokemon, format)) {
      detectedRoles[role].push(pokemon.name);
    }
  }

  const requirements = REQUIREMENTS[archetype] ?? REQUIREMENTS.balance;
  let missingCriticalRoles = requirements.critical.filter(role => detectedRoles[role].length === 0);
  const missingImportantRoles = requirements.important.filter(role => detectedRoles[role].length === 0);
  const redundancyWarnings: string[] = [];

  if (detectedRoles['Special Damage'].length >= 4 && detectedRoles['Physical Damage'].length <= 1) {
    redundancyWarnings.push('Excesso de dano especial e pouca pressão física.');
  }

  if (detectedRoles['Physical Damage'].length >= 4 && detectedRoles['Special Damage'].length <= 1) {
    redundancyWarnings.push('Excesso de dano físico e pouca pressão especial.');
  }

  if (getWeatherFamilies(team, format).size >= 2) {
    redundancyWarnings.push('Múltiplos climas diferentes podem disputar o mesmo plano de campo.');
  }

  if (hasTerrainSleepConflict(team)) {
    redundancyWarnings.push('Terreno Elétrico/Misty conflita com plano de sono em alvos grounded.');
  }

  const hasSunPlan = team.some(pokemon => hasActiveSunSetter(pokemon, format));
  const hasPrimarySunPlanAbuser = team.some(pokemon => hasPrimarySunAbuser(pokemon, format));
  const hasOnlyCompatibleSunAbuser = team.some(pokemon => hasSunCompatibleAbuser(pokemon, format));

  if (isSunArchetype(archetype) && hasSunPlan && !hasPrimarySunPlanAbuser) {
    redundancyWarnings.push(hasOnlyCompatibleSunAbuser
      ? 'Plano de sol depende apenas de Protosynthesis; falta abuser primário como Chlorophyll/Solar Power.'
      : 'Plano de sol sem abuser primário; o clima fica subaproveitado.');

    if (!missingCriticalRoles.includes('Weather Abuser')) {
      missingCriticalRoles = [...missingCriticalRoles, 'Weather Abuser'];
    }
  }

  if (countMove(team, 'Tailwind') >= 2) {
    redundancyWarnings.push('Redundância de Tailwind; prefira que o segundo slot traga redirection, finalização ou matchup coverage.');
  }

  if (countAbility(team, format, 'Intimidate') >= 2 && detectedRoles['Redirection'].length === 0 && detectedRoles['Late Game Cleaner'].length === 0) {
    redundancyWarnings.push('Dois Intimidate sem redirection ou cleaner claro podem deixar o time defensivo demais.');
  }

  if (countSevereWeakness(team, format, 'Rock', 4) >= 2) {
    redundancyWarnings.push('Duas peças com fraqueza 4x a Rock deixam o time vulnerável a Rock Slide e pressão em área.');
  }

  if (isSunArchetype(archetype) && countTypeMembers(team, format, 'Fire') >= 3 && detectedRoles['Redirection'].length === 0) {
    redundancyWarnings.push('Sun com três Fire-types e sem redirection tende a ficar redundante e exposto a Rock/Ground/Water coverage.');
  }


  if (isTrickRoomArchetype(archetype)) {
    const hasPremiumRedirection = team.some(pokemon => isPremiumTrickRoomRedirectionForVgc(pokemon));
    const fastSetupMembers = team.filter(pokemon => {
      const speed = Number(getVariant(pokemon, format)?.baseStats?.spe ?? 0);
      return speed >= 85 && inferVgcRoles(pokemon, format).includes('Setup Pressure') && !isLikelyRedirectionSupportForVgc(pokemon);
    });

    if (detectedRoles['Redirection'].length > 0 && !hasPremiumRedirection) {
      redundancyWarnings.push('Redirection detectado, mas sem suporte premium de Trick Room como Amoonguss, Brute Bonnet, Clefairy ou Indeedee-F.');
    }

    if (fastSetupMembers.length > 0) {
      redundancyWarnings.push('Setup rápido em Trick Room tende a disputar o plano principal de velocidade.');
    }

    if (countTypeMembers(team, format, 'Fire') >= 3) {
      redundancyWarnings.push('Três Fire-types em Trick Room Sun deixam o time redundante e vulnerável a Rock Slide.');
    }
  }

  const criticalFilled = requirements.critical.length - missingCriticalRoles.length;
  const importantFilled = requirements.important.length - missingImportantRoles.length;
  const criticalScore = (criticalFilled / Math.max(1, requirements.critical.length)) * 70;
  const importantScore = (importantFilled / Math.max(1, requirements.important.length)) * 30;
  const redundancyPenalty = redundancyWarnings.length * 11;

  return {
    detectedRoles,
    missingCriticalRoles,
    missingImportantRoles,
    redundancyWarnings,
    coverageScore: clamp(criticalScore + importantScore - redundancyPenalty),
  };
}

function evaluateModes(team: PokemonData[], format: string, archetype: VgcArchetypeId, lockedLead?: [string, string]): VgcModeAnalysis {
  // Os 3 primeiros Pokémon são assumidos como as sementes inseridas pelo usuário
  const userSeeds = team.slice(0, 3).map(p => p.name);

  let fours = combinations(team, Math.min(4, team.length));
  if (lockedLead) {
    // Mantém apenas quartetos que possuem ambos os Pokémon da lead travada
    fours = fours.filter(four =>
      four.some(p => p.name === lockedLead[0]) && four.some(p => p.name === lockedLead[1])
    );
  }

  const modes = fours.map(four => {
    const evalResult = evaluateFour(four, format, archetype, lockedLead);

    // Contar quantas sementes do usuário estão presentes no modo de 4
    const seedCount = four.filter(p => userSeeds.includes(p.name)).length;

    // Adicionar bônus de relevância para manter os Pokémon originais nas estratégias do Playbook
    const seedBonus = seedCount * 12; // Ex: 3 sementes presentes = +36 pontos de score de modo
    evalResult.score = clamp(evalResult.score + seedBonus);

    // Ajustar também o score de cada opção de lead para herdar o bônus de semente correspondente
    evalResult.leadOptions = evalResult.leadOptions.map(leadOpt => ({
      ...leadOpt,
      score: clamp(leadOpt.score + seedBonus)
    }));

    return evalResult;
  }).sort((a, b) => b.score - a.score);

  const uniqueModes = modes.filter((mode, index, allModes) => {
    const signature = JSON.stringify({
      lead: [...mode.lead].sort(),
      primaryInsight: mode.tacticalInsights[0]?.type ?? 'none',
      hasRain: mode.tacticalInsights.some(insight => insight.type === 'swift_swim_rain'),
      hasTrickRoom: mode.selectedFour.some(name => {
        const pokemon = team.find(member => member.name === name);
        return pokemon ? hasAny(getMoveValues(pokemon), ['Trick Room']) : false;
      }),
    });
    return allModes.findIndex(candidate => JSON.stringify({
      lead: [...candidate.lead].sort(),
      primaryInsight: candidate.tacticalInsights[0]?.type ?? 'none',
      hasRain: candidate.tacticalInsights.some(insight => insight.type === 'swift_swim_rain'),
      hasTrickRoom: candidate.selectedFour.some(name => {
        const pokemon = team.find(member => member.name === name);
        return pokemon ? hasAny(getMoveValues(pokemon), ['Trick Room']) : false;
      }),
    }) === signature) === index;
  });

  const viableModes = uniqueModes.filter(mode => mode.contractValid && mode.score >= 62).slice(0, 5);
  const bestLeads = uniqueModes.flatMap(mode => mode.leadOptions).sort((a, b) => b.score - a.score).slice(0, 5);
  const averageTopModes = modes.slice(0, 5).reduce((sum, mode) => sum + mode.score, 0) / Math.max(1, Math.min(5, modes.length));

  return {
    modeConsistencyScore: clamp(averageTopModes + Math.min(12, viableModes.length * 3)),
    viableModeCount: viableModes.length,
    viableModes,
    bestLeads,
  };
}

function evaluateFour(four: PokemonData[], format: string, archetype: VgcArchetypeId, lockedLead?: [string, string]): VgcModeEvaluation {
  const roleCoverage = evaluateRoleCoverage(four, format, archetype);
  let leads = combinations(four, Math.min(2, four.length))
    .map(lead => evaluateLeadPair(lead, format, archetype))
    .sort((a, b) => b.score - a.score);

  if (lockedLead) {
    // Filtra para manter estritamente apenas a lead travada pelo usuário (independente da ordem)
    leads = leads.filter(l =>
      l.lead.includes(lockedLead[0]) && l.lead.includes(lockedLead[1])
    );
  }

  const topLeadScore = leads[0]?.score ?? 0;
  const reasons: string[] = [];
  let score = roleCoverage.coverageScore * 0.72 + topLeadScore * 0.28;

  if (isSunArchetype(archetype)) {
    const hasSunSetter = four.some(pokemon => hasActiveSunSetter(pokemon, format));
    const hasPrimarySunAbuserInFour = four.some(pokemon => hasPrimarySunAbuser(pokemon, format));
    const hasCompatibleSunAbuserInFour = four.some(pokemon => hasSunCompatibleAbuser(pokemon, format));

    if (hasSunSetter && hasPrimarySunAbuserInFour) {
      score += 16;
      reasons.push('Modo de 4 preserva setter de sol + abuser primário.');
    } else if (hasSunSetter && hasCompatibleSunAbuserInFour) {
      score -= 4;
      reasons.push('Modo de 4 tem abuser compatível com sol, mas falta abuser primário.');
    } else if (hasSunSetter) {
      score -= 16;
      reasons.push('Modo de 4 usa sol sem abuser primário.');
    }
  }



  if (isRainArchetype(archetype)) {
    const hasRainSetter = four.some(pokemon => hasActiveRainSetter(pokemon, format));
    const rainAbusers = four.filter(pokemon => hasPrimaryRainAbuser(pokemon, format)).length;
    const hasTailwindOrSpeed = four.some(pokemon => hasRainSupport(pokemon, format) || inferVgcRoles(pokemon, format).includes('Speed Control'));

    if (hasRainSetter && rainAbusers >= 1) {
      score += 18;
      reasons.push('Modo de 4 preserva setter de chuva + abuser primário.');
    } else if (hasRainSetter) {
      score -= 18;
      reasons.push('Modo de 4 usa chuva sem abuser primário.');
    }

    if (rainAbusers >= 2) {
      score += 8;
      reasons.push('Modo de 4 mantém pressão de chuva mesmo se um abuser cair.');
    }

    if (hasTailwindOrSpeed) {
      score += 8;
      reasons.push('Modo de 4 tem camada extra de velocidade para Rain.');
    }
  }

  if (isTrickRoomArchetype(archetype)) {
    const hasTrSetter = four.some(pokemon => isLikelyTrickRoomSetterForVgc(pokemon) || hasAny(getMoveValues(pokemon), ['Trick Room']));
    const slowAbusers = four.filter(pokemon => isLikelyTrickRoomAbuserForVgc(pokemon, format)).length;
    const fastAttackers = four.filter(pokemon => Number(getVariant(pokemon, format)?.baseStats?.spe ?? 0) >= 100).length;

    if (hasTrSetter && slowAbusers >= 2) {
      score += 22;
      reasons.push('Modo de 4 preserva setter de Trick Room + atacantes lentos.');
    } else if (hasTrSetter && slowAbusers >= 1) {
      score += 10;
      reasons.push('Modo de 4 tem Trick Room e pelo menos um abuser lento.');
    } else {
      score -= 18;
      reasons.push('Modo de 4 não executa Trick Room com clareza.');
    }

    if (four.some(pokemon => isPremiumTrickRoomRedirectionForVgc(pokemon))) {
      score += 14;
      reasons.push('Modo de 4 inclui redirection premium para proteger Trick Room.');
    }

    if (fastAttackers >= 2) score -= 14;
    if (fastAttackers >= 1 && !four.some(pokemon => isLikelyRedirectionSupportForVgc(pokemon))) score -= 8;
  }

  if (countMove(four, 'Tailwind') >= 2) {
    score -= 6;
  }

  // Penalidade por excesso de redundância de golpes físicos de mesma cobertura
  if (countMove(four, 'Rock Slide') >= 2) {
    score -= 8;
    reasons.push('Redundância de cobertura Rock Slide detectada.');
  }
  if (countMove(four, 'High Horsepower') >= 2) {
    score -= 8;
    reasons.push('Redundância de cobertura High Horsepower detectada.');
  }

  if (roleCoverage.detectedRoles['Speed Control'].length) reasons.push('Tem controle de velocidade dentro dos 4 escolhidos.');
  if (roleCoverage.detectedRoles['Turn Control'].length) reasons.push('Tem controle de turno para comprar ações-chave.');
  if (roleCoverage.detectedRoles['Physical Damage'].length && roleCoverage.detectedRoles['Special Damage'].length) reasons.push('Combina pressão física e especial.');
  if (roleCoverage.detectedRoles['Anti Trick Room'].length) reasons.push('Tem resposta ativa contra Trick Room/setup.');
  if (roleCoverage.detectedRoles['Redirection'].length) reasons.push('Consegue proteger atacante-chave com redirecionamento.');

  // Penalidade por conflito híbrido de velocidade (Swift Swim + Trick Room/eixo lento)
  const hasSwiftSwimmer = four.some(p => hasAny(getAbilityValues(p, format), ['Swift Swim']));
  const hasTrOrSlow = four.some(p =>
    hasAny(getMoveValues(p), ['Trick Room']) ||
    (Number(getVariant(p, format)?.baseStats?.spe ?? 80) <= 55 && !hasAny(getAbilityValues(p, format), ['Swift Swim']))
  );
  if (hasSwiftSwimmer && hasTrOrSlow) {
    score -= 12;
    reasons.push('Mistura de Swift Swim e Trick Room/eixo lento na mesma seleção.');
  }

  const primaryLead = leads[0]?.lead ?? four.slice(0, 2).map(pokemon => pokemon.name);
  const selectedFour = four.map(pokemon => pokemon.name);
  const backline = selectedFour.filter(name => !primaryLead.includes(name));
  const contract = validateModeContract({ selectedFour, lead: primaryLead, backline }, four);
  const tacticalInsights = analyzeTacticalInteractions(four, format, { lead: primaryLead, backline });

  const activeImmediateInsights = tacticalInsights.filter(insight => insight.availability === 'active-now' && insight.verified).length;
  const deferredInsights = tacticalInsights.filter(insight => insight.availability === 'available-after-switch').length;
  if (activeImmediateInsights === 0) {
    score -= 10;
    reasons.push('Lead com baixa pressão ou interação imediata.');
  }
  score -= Math.min(12, deferredInsights * 3);

  return {
    selectedFour,
    lead: primaryLead,
    backline,
    contractValid: contract.valid,
    contractErrors: contract.errors,
    warnings: contract.warnings,
    score: contract.valid ? Math.min(90, clamp(score)) : 0,
    leadOptions: leads.slice(0, 3),
    reasons: reasons.slice(0, 5),
    tacticalInsights,
  };
}

function evaluateLeadPair(lead: PokemonData[], format: string, archetype: VgcArchetypeId): VgcLeadEvaluation {
  const reasons: string[] = [];
  const roleSets = lead.map(pokemon => new Set(inferVgcRoles(pokemon, format)));
  const names = lead.map(pokemon => pokemon.name);
  let score = 35;

  const pairHas = (role: VgcRole): boolean => roleSets.some(roles => roles.has(role));
  const pairHasTwo = (a: VgcRole, b: VgcRole): boolean =>
    (roleSets[0]?.has(a) && roleSets[1]?.has(b)) || (roleSets[0]?.has(b) && roleSets[1]?.has(a));

  const hasLeadSunSetter = lead.some(pokemon => hasActiveSunSetter(pokemon, format));
  const hasLeadPrimarySunAbuser = lead.some(pokemon => hasPrimarySunAbuser(pokemon, format));
  const trickRoomSetters = lead.filter(pokemon => isLikelyTrickRoomSetterForVgc(pokemon) || hasAny(getMoveValues(pokemon), ['Trick Room']));
  const hasLeadTrickRoomSetter = trickRoomSetters.length > 0;
  const hasIndependentTrickRoomSupport = trickRoomSetters.some(setter =>
    lead.some(partner => partner.name !== setter.name && (
      hasAny(getMoveValues(partner), ['Fake Out', 'Follow Me', 'Rage Powder']) ||
      hasAny(getAbilityValues(partner, format), ['Armor Tail', 'Psychic Surge'])
    )),
  );
  const hasLeadSlowAbuser = lead.some(pokemon => isLikelyTrickRoomAbuserForVgc(pokemon, format));

  if (isTrickRoomArchetype(archetype) && hasLeadTrickRoomSetter && hasIndependentTrickRoomSupport) {
    score += 45;
    reasons.push('Lead ajuda a colocar Trick Room com segurança.');
  } else if (isTrickRoomArchetype(archetype) && hasLeadTrickRoomSetter && hasLeadSlowAbuser) {
    score += 28;
    reasons.push('Lead combina setter de Trick Room com abuser lento.');
  }

  const hasLeadRainSetter = lead.some(pokemon => hasActiveRainSetter(pokemon, format));
  const hasLeadRainAbuser = lead.some(pokemon => hasPrimaryRainAbuser(pokemon, format));
  const hasLeadRainSupport = lead.some(pokemon => hasRainSupport(pokemon, format));

  if (isRainArchetype(archetype) && hasLeadRainSetter && hasLeadRainAbuser) {
    score += 52;
    reasons.push('Lead executa imediatamente setter de chuva + abuser primário.');
  } else if (isRainArchetype(archetype) && hasLeadRainSetter && hasLeadRainSupport) {
    score += 24;
    reasons.push('Lead compra turno para chuva com suporte de velocidade/turno.');
  }

  if (isSunArchetype(archetype) && hasLeadSunSetter && hasLeadPrimarySunAbuser) {
    score += 38;
    reasons.push('Lead executa imediatamente setter de sol + abuser primário.');
  } else if (pairHasTwo('Weather Setter', 'Weather Abuser')) {
    score += 22;
    reasons.push('Lead executa clima + abuser compatível.');
  }

  if (pairHasTwo('Turn Control', 'Speed Control')) {
    score += 22;
    reasons.push('Compra turno para ativar controle de velocidade.');
  }

  if (pairHasTwo('Redirection', 'Special Damage') || pairHasTwo('Redirection', 'Physical Damage')) {
    score += 18;
    reasons.push('Redirecionamento protege o atacante principal.');
  }

  if (pairHas('Defensive Glue') && (pairHas('Physical Damage') || pairHas('Special Damage'))) {
    score += 14;
    reasons.push('Suporte defensivo estabiliza uma ameaça ofensiva.');
  }

  if (pairHas('Spread Damage') && pairHas('Speed Control')) {
    score += 14;
    reasons.push('Speed control aumenta pressão de golpe em área.');
  }

  if (lead.some(pokemon => isVgcMechanicTerrainSetter(pokemon)) && lead.some(pokemon => isVgcMechanicTerrainAbuser(pokemon))) {
    score += 18;
    reasons.push('Lead já conecta setter e abuser de terreno.');
  }

  if (pairHas('Anti Trick Room')) {
    score += 10;
    reasons.push('Lead tem botão ativo contra Trick Room ou setup.');
  }

  if (isSunArchetype(archetype) && pairHas('Weather Setter') && pairHas('Anti Weather')) {
    score += 6;
  }

  const dedicatedAttackers = roleSets.filter(roles => roles.has('Physical Damage') || roles.has('Special Damage')).length;
  if (dedicatedAttackers === 0) {
    score -= 20;
    reasons.push('Lead sem pressão ofensiva imediata.');
  }

  return {
    lead: names,
    score: clamp(score),
    reasons: reasons.slice(0, 3),
  };
}

function evaluateMatchups(team: PokemonData[], format: string): VgcMatchupReadiness {
  const coverage = evaluateRoleCoverage(team, format, inferVgcArchetype(team, format).id);
  const roles = coverage.detectedRoles;
  const notes: string[] = [];

  const rain = clamp(
    35 +
      (roles['Weather Setter'].length ? 18 : 0) +
      (roles['Anti Weather'].length ? 16 : 0) +
      (roles['Weather Abuser'].length ? 8 : 0) +
      (roles['Speed Control'].length ? 10 : 0) +
      (roles['Turn Control'].length ? 8 : 0),
  );

  const trickRoom = clamp(
    30 +
      (roles['Anti Trick Room'].length ? 26 : 0) +
      (roles['Turn Control'].length ? 14 : 0) +
      (roles['Redirection'].length ? 8 : 0) +
      (roles['Defensive Glue'].length ? 8 : 0),
  );

  const tailwindOffense = clamp(
    30 +
      (roles['Speed Control'].length ? 20 : 0) +
      (roles['Turn Control'].length ? 16 : 0) +
      (roles['Redirection'].length ? 10 : 0) +
      (roles['Priority'].length ? 8 : 0),
  );

  const setupRedirection = clamp(
    30 +
      (roles['Anti Trick Room'].length ? 18 : 0) +
      (roles['Spread Damage'].length ? 16 : 0) +
      (roles['Turn Control'].length ? 14 : 0) +
      (roles['Speed Control'].length ? 8 : 0),
  );

  const weatherWar = clamp(
    35 +
      (roles['Weather Setter'].length ? 18 : 0) +
      (roles['Anti Weather'].length ? 18 : 0) +
      (roles['Pivot'].length ? 10 : 0) +
      (roles['Speed Control'].length ? 8 : 0),
  );

  if (rain >= 70) notes.push('Boa resposta contra Rain: há controle de clima/velocidade e pressão de turno.');
  if (trickRoom < 60) notes.push('Atenção contra Trick Room: falta redundância de Taunt/Encore/Fake Out/Imprison.');
  if (weatherWar < 60) notes.push('Atenção contra guerra de clima: preserve setter ou tenha Sunny Day/Rain Dance secundário.');

  const overallScore = clamp((rain + trickRoom + tailwindOffense + setupRedirection + weatherWar) / 5);

  return {
    rain,
    trickRoom,
    tailwindOffense,
    setupRedirection,
    weatherWar,
    overallScore,
    notes,
  };
}

function buildRecommendations(
  roleCoverage: VgcRoleCoverageAnalysis,
  mechanicCoverage: VgcMechanicCoverage,
  modeAnalysis: VgcModeAnalysis,
  matchupReadiness: VgcMatchupReadiness,
  archetype: VgcArchetypeAnalysis,
): string[] {
  const recommendations: string[] = [];

  if (mechanicCoverage.missingCriticalMechanics.length > 0) {
    recommendations.push(`Priorize as mecânicas críticas ausentes do arquétipo: ${mechanicCoverage.missingCriticalMechanics.join(', ')}.`);
  }

  if (roleCoverage.missingCriticalRoles.length > 0) {
    recommendations.push(`Depois complete as funções competitivas ausentes: ${roleCoverage.missingCriticalRoles.join(', ')}.`);
  }

  if (modeAnalysis.viableModeCount < 3) {
    recommendations.push('Aumente a consistência dos modos de 4; o ideal é ter pelo menos 3 escolhas de 4 claras para matchups diferentes.');
  }

  if (matchupReadiness.trickRoom < 65) {
    recommendations.push('Inclua ou preserve respostas contra Trick Room, como Taunt, Encore, Fake Out, Imprison ou pressão de sono.');
  }

  if (archetype.id.includes('weather') || ['sun_offense', 'sun_trick_room', 'rain_offense', 'rain_tailwind', 'sand_balance', 'snow_balance'].includes(archetype.id)) {
    recommendations.push('Garanta uma segunda forma de recuperar o clima ou um pivô seguro para reposicionar o setter.');
  }

  if (isTerrainArchetype(archetype.id)) {
    recommendations.push('Verifique conflitos de terreno: prioridade em Psychic Terrain, sono em Electric/Misty Terrain e Earthquake em Grassy Terrain.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Plano VGC bem estruturado: preserve os leads principais e ajuste EVs/itens por cálculo de dano e speed tiers.');
  }

  return recommendations.slice(0, 5);
}

function buildConcerns(
  roleCoverage: VgcRoleCoverageAnalysis,
  mechanicCoverage: VgcMechanicCoverage,
  modeAnalysis: VgcModeAnalysis,
  matchupReadiness: VgcMatchupReadiness,
): string[] {
  const concerns = [
    ...mechanicCoverage.conflictWarnings,
    ...roleCoverage.redundancyWarnings,
    ...matchupReadiness.notes.filter(note => note.startsWith('Atenção')),
  ];

  if (modeAnalysis.bestLeads.length === 0 || modeAnalysis.bestLeads[0].score < 60) {
    concerns.push('Nenhum lead de 2 Pokémon ficou claramente acima da média.');
  }

  if (mechanicCoverage.score < 70) {
    concerns.push('Contrato mecânico do arquétipo ainda incompleto; o time pode parecer forte, mas não executa o plano com consistência.');
  }

  if (roleCoverage.coverageScore < 65) {
    concerns.push('Cobertura de papéis VGC ainda baixa para um time pronto.');
  }

  return concerns.slice(0, 5);
}

function buildPlanSummary(
  archetype: VgcArchetypeAnalysis,
  roleCoverage: VgcRoleCoverageAnalysis,
  mechanicCoverage: VgcMechanicCoverage,
  modeAnalysis: VgcModeAnalysis,
  score: number,
): string {
  const missingMechanics = mechanicCoverage.missingCriticalMechanics.length;
  const missingRoles = roleCoverage.missingCriticalRoles.length;
  const bestLead = modeAnalysis.bestLeads[0]?.lead.join(' + ');

  if (score >= 78 && missingMechanics === 0) {
    return `Plano ${archetype.label} consistente: contrato mecânico cumprido, ${modeAnalysis.viableModeCount} modo(s) de 4 viável(is) e lead principal ${bestLead ?? 'flexível'}.`;
  }

  if (missingMechanics > 0) {
    return `Plano ${archetype.label} promissor, mas ainda faltam ${missingMechanics} mecânica(s) crítica(s): ${mechanicCoverage.missingCriticalMechanics.join(', ')}.`;
  }

  if (missingRoles > 0) {
    return `Plano ${archetype.label} mecanicamente válido, mas ainda faltam ${missingRoles} função(ões) competitiva(s): ${roleCoverage.missingCriticalRoles.join(', ')}.`;
  }

  return `Plano ${archetype.label} jogável, mas precisa melhorar consistência dos modos de 4 e clareza dos leads.`;
}

function getAbilityValues(pokemon: PokemonData, format: string): string[] {
  if (pokemon.ability) {
    return [pokemon.ability];
  }

  const values = new Set<string>();

  const variantAbilities = getVariant(pokemon, format)?.abilities;
  if (variantAbilities) {
    for (const ability of Object.values(variantAbilities)) {
      if (ability) values.add(String(ability));
    }
  }

  if (pokemon.abilities) {
    for (const ability of Object.values(pokemon.abilities)) {
      if (ability) values.add(String(ability));
    }
  }

  return [...values];
}

function getMoveValues(pokemon: PokemonData): string[] {
  return [...(pokemon.moves ?? [])];
}

function getTagValues(pokemon: PokemonData): string[] {
  return [
    ...(pokemon.competitive?.roles ?? []),
    ...(pokemon.competitive?.offensiveTags ?? []),
    ...(pokemon.competitive?.defensiveTags ?? []),
    ...(pokemon.competitive?.utilityTags ?? []),
    pokemon.role ?? '',
  ].filter(Boolean);
}
