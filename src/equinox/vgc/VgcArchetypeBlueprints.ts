import { Dex } from '@pkmn/dex';
import { PokemonData } from '../core/AnalysisContext';
import { getPokemonTypes, getVariant } from '../utils/PokemonUtils';
import {
  getVgcMechanicTags,
  hasTerrainSleepConflict,
  isVgcMechanicRedirectionSupport,
  isVgcMechanicTailwindSetter,
  isVgcMechanicTerrainAbuser,
  isVgcMechanicTerrainSetter,
  isVgcMechanicTrickRoomAbuser,
  isVgcMechanicTrickRoomSetter,
  isVgcMechanicWeatherAbuser,
  isVgcMechanicWeatherSetter,
} from './VgcMechanicProfiles';
import type { VgcArchetypeId } from './VgcTeamBuilding';

export type VgcMechanicSlotId =
  | 'weather_setter_sun'
  | 'weather_abuser_sun_primary'
  | 'weather_setter_rain'
  | 'weather_abuser_rain_primary'
  | 'weather_setter_sand'
  | 'weather_abuser_sand_primary'
  | 'weather_setter_snow'
  | 'weather_abuser_snow_primary'
  | 'weather_control_secondary'
  | 'terrain_setter_psychic'
  | 'terrain_abuser_psychic'
  | 'terrain_setter_any'
  | 'terrain_abuser_any'
  | 'trick_room_setter'
  | 'trick_room_abuser'
  | 'trick_room_protection'
  | 'tailwind_setter'
  | 'speed_control'
  | 'turn_control'
  | 'redirection'
  | 'premium_redirection'
  | 'physical_damage'
  | 'special_damage'
  | 'spread_damage'
  | 'defensive_glue'
  | 'pivot'
  | 'late_game_cleaner'
  | 'setup_pressure'
  | 'priority';

export interface VgcMechanicSlotRequirement {
  id: VgcMechanicSlotId;
  label: string;
  min: number;
  weight: number;
  critical?: boolean;
}

export interface VgcArchetypeBlueprint {
  id: VgcArchetypeId;
  label: string;
  critical: VgcMechanicSlotRequirement[];
  important: VgcMechanicSlotRequirement[];
  systemicWarnings?: string[];
}

export interface VgcMechanicCoverage {
  detectedSlots: Record<VgcMechanicSlotId, string[]>;
  missingCriticalMechanics: string[];
  missingImportantMechanics: string[];
  conflictWarnings: string[];
  score: number;
}

export interface VgcMechanicCandidateFit {
  score: number;
  reasons: string[];
}

const normalize = (value?: string): string =>
  String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const hasAny = (values: string[], targets: string[]): boolean => {
  const normalizedTargets = targets.map(normalize);
  return values.some(value => normalizedTargets.includes(normalize(value)));
};

const WEATHER_SPEED_DOUBLING_ABILITIES = ['Chlorophyll', 'Swift Swim', 'Sand Rush', 'Slush Rush'];
const VGC_PROTECT_COMPATIBLE_EXCLUDED_ITEMS = ['Assault Vest', 'Choice Band', 'Choice Specs', 'Choice Scarf'];

function hasWeatherSpeedDoublingAbility(pokemon: PokemonData, format: string): boolean {
  return hasAny(getAbilityValues(pokemon, format), WEATHER_SPEED_DOUBLING_ABILITIES);
}

function getEffectiveWeatherSpeedForContract(pokemon: PokemonData, format: string): number {
  const speed = Number(getVariant(pokemon, format)?.baseStats?.spe ?? 0);
  return hasWeatherSpeedDoublingAbility(pokemon, format) ? speed * 2 : speed;
}

function shouldExpectProtect(pokemon: PokemonData): boolean {
  const item = String(pokemon.item ?? '');
  return !hasAny([item], VGC_PROTECT_COMPATIBLE_EXCLUDED_ITEMS);
}

const getAbilityValues = (pokemon: PokemonData, format: string): string[] => {
  const variant = getVariant(pokemon, format);
  return [
    pokemon.ability,
    ...Object.values(pokemon.abilities ?? {}),
    ...Object.values(variant?.abilities ?? {}),
  ].filter(Boolean) as string[];
};

const getMoveValues = (pokemon: PokemonData): string[] => pokemon.moves ?? [];

const getRoleText = (pokemon: PokemonData): string =>
  [...(pokemon.competitive?.roles ?? []), pokemon.role ?? '', ...(pokemon.competitive?.utilityTags ?? [])].join(' ');

const countTypeMembers = (team: PokemonData[], format: string, typeName: string): number =>
  team.filter(pokemon => getPokemonTypes(pokemon, format).some(type => normalize(type) === normalize(typeName))).length;

const clamp = (value: number, min = 0, max = 100): number =>
  Math.max(min, Math.min(max, Math.round(value)));

function isSlowEnoughForTrickRoom(pokemon: PokemonData, format: string): boolean {
  const speed = Number(getVariant(pokemon, format)?.baseStats?.spe ?? 999);
  return speed <= 60;
}

function isFastPokemon(pokemon: PokemonData, format: string): boolean {
  const speed = Number(getVariant(pokemon, format)?.baseStats?.spe ?? 0);
  return speed >= 95;
}

function hasPhysicalDamage(pokemon: PokemonData, format: string): boolean {
  const stats = getVariant(pokemon, format)?.baseStats;
  const atk = Number(stats?.atk ?? 0);
  const roleText = getRoleText(pokemon);
  return atk >= 105 || /physical|físico|fisico|wallbreaker/i.test(roleText);
}

function hasSpecialDamage(pokemon: PokemonData, format: string): boolean {
  const stats = getVariant(pokemon, format)?.baseStats;
  const spa = Number(stats?.spa ?? 0);
  const roleText = getRoleText(pokemon);
  return spa >= 105 || /special|especial/i.test(roleText);
}

function hasDefensiveGlue(pokemon: PokemonData, format: string): boolean {
  const stats = getVariant(pokemon, format)?.baseStats;
  const hp = Number(stats?.hp ?? 0);
  const def = Number(stats?.def ?? 0);
  const spd = Number(stats?.spd ?? 0);
  const abilities = getAbilityValues(pokemon, format);
  const moves = getMoveValues(pokemon);
  const roleText = getRoleText(pokemon);

  return hp + def + spd >= 260 ||
    hasAny(abilities, ['Intimidate', 'Friend Guard', 'Regenerator', 'Armor Tail', 'Psychic Surge']) ||
    hasAny(moves, ['Reflect', 'Light Screen', 'Will-O-Wisp', 'Snarl', 'Parting Shot', 'Follow Me', 'Rage Powder']) ||
    /wall|tank|glue|support|defensive|defensivo/i.test(roleText);
}

function hasSpreadDamage(pokemon: PokemonData): boolean {
  return hasAny(getMoveValues(pokemon), [
    'Heat Wave', 'Dazzling Gleam', 'Earthquake', 'Rock Slide', 'Hyper Voice', 'Muddy Water',
    'Eruption', 'Water Spout', 'Make It Rain', 'Blizzard', 'Discharge', 'Icy Wind', 'Expanding Force',
  ]);
}

function hasTurnControl(pokemon: PokemonData, format: string): boolean {
  const abilities = getAbilityValues(pokemon, format);
  const moves = getMoveValues(pokemon);
  const tags = getVgcMechanicTags(pokemon);
  return hasAny(moves, [
    'Fake Out', 'Parting Shot', 'Encore', 'Taunt', 'Follow Me', 'Rage Powder', 'Spore', 'Sleep Powder',
    'Will-O-Wisp', 'Snarl', 'Helping Hand', 'Wide Guard', 'Quick Guard', 'Imprison', 'Trick Room',
  ]) ||
    hasAny(abilities, ['Intimidate', 'Prankster', 'Armor Tail', 'Queenly Majesty', 'Psychic Surge', 'Friend Guard']) ||
    tags.some(tag => tag.mechanic === 'turn_control' && tag.confidence >= 0.65) ||
    isVgcMechanicRedirectionSupport(pokemon);
}

function hasSpeedControl(pokemon: PokemonData, format: string): boolean {
  const abilities = getAbilityValues(pokemon, format);
  const moves = getMoveValues(pokemon);
  return hasAny(moves, ['Tailwind', 'Icy Wind', 'Electroweb', 'Trick Room', 'Thunder Wave', 'Scary Face', 'Quash']) ||
    isVgcMechanicTailwindSetter(pokemon) ||
    isVgcMechanicTrickRoomSetter(pokemon) ||
    (hasAny(abilities, ['Prankster']) && hasAny(moves, ['Tailwind', 'Sunny Day', 'Encore', 'Taunt']));
}

function hasPrimaryWeatherAbuser(pokemon: PokemonData, format: string, weather: 'sun' | 'rain' | 'sand' | 'snow'): boolean {
  const abilities = getAbilityValues(pokemon, format);
  const moves = getMoveValues(pokemon);
  const tags = getVgcMechanicTags(pokemon);

  if (isVgcMechanicWeatherAbuser(pokemon, weather, true)) return true;

  if (weather === 'sun') {
    return hasAny(abilities, ['Chlorophyll', 'Solar Power', 'Flower Gift', 'Harvest']) ||
      hasAny(moves, ['Weather Ball', 'Solar Blade']) ||
      tags.some(tag => tag.mechanic === 'weather' && tag.weather === 'sun' && tag.role === 'abuser' && tag.primary && tag.confidence >= 0.5);
  }

  if (weather === 'rain') {
    return hasAny(abilities, ['Swift Swim']) ||
      tags.some(tag => tag.mechanic === 'weather' && tag.weather === 'rain' && tag.role === 'abuser' && tag.primary && tag.confidence >= 0.5);
  }

  if (weather === 'sand') {
    return hasAny(abilities, ['Sand Rush', 'Sand Force', 'Sand Veil']) ||
      tags.some(tag => tag.mechanic === 'weather' && tag.weather === 'sand' && tag.role === 'abuser' && tag.confidence >= 0.5);
  }

  return hasAny(abilities, ['Slush Rush', 'Ice Body', 'Snow Cloak']) ||
    tags.some(tag => tag.mechanic === 'weather' && tag.weather === 'snow' && tag.role === 'abuser' && tag.confidence >= 0.5);
}

function hasWeatherSetter(pokemon: PokemonData, format: string, weather: 'sun' | 'rain' | 'sand' | 'snow'): boolean {
  const abilities = getAbilityValues(pokemon, format);
  const moves = getMoveValues(pokemon);

  if (isVgcMechanicWeatherSetter(pokemon, weather)) return true;

  if (weather === 'sun') return hasAny(abilities, ['Drought', 'Orichalcum Pulse', 'Desolate Land']) || hasAny(moves, ['Sunny Day']);
  if (weather === 'rain') return hasAny(abilities, ['Drizzle', 'Primordial Sea']) || hasAny(moves, ['Rain Dance']);
  if (weather === 'sand') return hasAny(abilities, ['Sand Stream', 'Sand Spit']) || hasAny(moves, ['Sandstorm']);
  return hasAny(abilities, ['Snow Warning']) || hasAny(moves, ['Snowscape']);
}

function hasTerrainSetter(pokemon: PokemonData, terrain?: 'psychic' | 'electric' | 'grassy' | 'misty'): boolean {
  if (terrain) return isVgcMechanicTerrainSetter(pokemon, terrain);
  return isVgcMechanicTerrainSetter(pokemon);
}

function hasTerrainAbuser(pokemon: PokemonData, terrain?: 'psychic' | 'electric' | 'grassy' | 'misty'): boolean {
  if (terrain) return isVgcMechanicTerrainAbuser(pokemon, terrain);
  return isVgcMechanicTerrainAbuser(pokemon);
}

function isRedirection(pokemon: PokemonData): boolean {
  return isVgcMechanicRedirectionSupport(pokemon) || hasAny(getMoveValues(pokemon), ['Follow Me', 'Rage Powder', 'Ally Switch']);
}

function isPremiumRedirection(pokemon: PokemonData): boolean {
  const key = normalize(pokemon.name);
  return ['amoonguss', 'brutebonnet', 'indeedeef', 'indeedeefemale', 'indeedee', 'clefairy', 'clefable', 'maushold', 'togekiss'].includes(key) ||
    getVgcMechanicTags(pokemon).some(tag => tag.mechanic === 'redirection' && tag.primary && tag.confidence >= 0.8);
}

export function getMechanicSlotsForPokemon(pokemon: PokemonData, format: string): Set<VgcMechanicSlotId> {
  const slots = new Set<VgcMechanicSlotId>();
  const abilities = getAbilityValues(pokemon, format);
  const moves = getMoveValues(pokemon);
  const tags = getVgcMechanicTags(pokemon);

  if (hasWeatherSetter(pokemon, format, 'sun')) slots.add('weather_setter_sun');
  if (hasPrimaryWeatherAbuser(pokemon, format, 'sun')) slots.add('weather_abuser_sun_primary');
  if (hasWeatherSetter(pokemon, format, 'rain')) slots.add('weather_setter_rain');
  if (hasPrimaryWeatherAbuser(pokemon, format, 'rain')) slots.add('weather_abuser_rain_primary');
  if (hasWeatherSetter(pokemon, format, 'sand')) slots.add('weather_setter_sand');
  if (hasPrimaryWeatherAbuser(pokemon, format, 'sand')) slots.add('weather_abuser_sand_primary');
  if (hasWeatherSetter(pokemon, format, 'snow')) slots.add('weather_setter_snow');
  if (hasPrimaryWeatherAbuser(pokemon, format, 'snow')) slots.add('weather_abuser_snow_primary');
  if (hasAny(moves, ['Sunny Day', 'Rain Dance', 'Sandstorm', 'Snowscape']) || tags.some(tag => tag.mechanic === 'weather' && tag.role === 'support' && tag.confidence >= 0.6)) slots.add('weather_control_secondary');

  if (hasTerrainSetter(pokemon, 'psychic')) slots.add('terrain_setter_psychic');
  if (hasTerrainAbuser(pokemon, 'psychic')) slots.add('terrain_abuser_psychic');
  if (hasTerrainSetter(pokemon)) slots.add('terrain_setter_any');
  if (hasTerrainAbuser(pokemon)) slots.add('terrain_abuser_any');

  if (isVgcMechanicTrickRoomSetter(pokemon) || hasAny(moves, ['Trick Room'])) slots.add('trick_room_setter');
  if (isVgcMechanicTrickRoomAbuser(pokemon) || (isSlowEnoughForTrickRoom(pokemon, format) && (hasPhysicalDamage(pokemon, format) || hasSpecialDamage(pokemon, format)))) slots.add('trick_room_abuser');
  if (isRedirection(pokemon) || hasAny(abilities, ['Armor Tail', 'Queenly Majesty', 'Psychic Surge']) || hasAny(moves, ['Fake Out', 'Helping Hand', 'Wide Guard', 'Quick Guard'])) slots.add('trick_room_protection');

  if (isVgcMechanicTailwindSetter(pokemon) || hasAny(moves, ['Tailwind'])) slots.add('tailwind_setter');
  if (hasSpeedControl(pokemon, format) || hasAny(abilities, WEATHER_SPEED_DOUBLING_ABILITIES)) slots.add('speed_control');
  if (hasTurnControl(pokemon, format)) slots.add('turn_control');
  if (isRedirection(pokemon)) slots.add('redirection');
  if (isPremiumRedirection(pokemon)) slots.add('premium_redirection');
  if (hasPhysicalDamage(pokemon, format)) slots.add('physical_damage');
  if (hasSpecialDamage(pokemon, format)) slots.add('special_damage');
  if (hasSpreadDamage(pokemon)) slots.add('spread_damage');
  if (hasDefensiveGlue(pokemon, format)) slots.add('defensive_glue');
  if (hasAny(moves, ['Parting Shot', 'U-turn', 'Volt Switch', 'Flip Turn']) || hasAny(abilities, ['Intimidate', 'Regenerator'])) slots.add('pivot');
  if (hasAny(moves, ['Sucker Punch', 'Extreme Speed', 'Aqua Jet', 'Grassy Glide', 'Thunderclap', 'First Impression', 'Shadow Sneak']) || tags.some(tag => tag.mechanic === 'priority' && tag.confidence >= 0.6)) slots.add('priority');
  if (hasAny(moves, ['Swords Dance', 'Nasty Plot', 'Quiver Dance', 'Dragon Dance', 'Calm Mind', 'Bulk Up']) || tags.some(tag => tag.mechanic === 'setup' && tag.confidence >= 0.6)) slots.add('setup_pressure');
  if (slots.has('priority') || /cleaner|late/i.test(getRoleText(pokemon))) slots.add('late_game_cleaner');

  return slots;
}

const slot = (id: VgcMechanicSlotId, label: string, min: number, weight: number, critical = false): VgcMechanicSlotRequirement => ({
  id,
  label,
  min,
  weight,
  critical,
});

export const VGC_ARCHETYPE_BLUEPRINTS: Record<VgcArchetypeId, VgcArchetypeBlueprint> = {
  sun_offense: {
    id: 'sun_offense', label: 'Sun Offense',
    critical: [slot('weather_setter_sun', 'setter de sol', 1, 1, true), slot('weather_abuser_sun_primary', 'abuser primário de sol', 1, 1, true), slot('speed_control', 'controle de velocidade', 1, 0.85, true), slot('turn_control', 'controle de turno', 1, 0.8, true)],
    important: [slot('weather_control_secondary', 'recuperação secundária de clima', 1, 0.55), slot('redirection', 'redirecionamento', 1, 0.55), slot('physical_damage', 'pressão física', 1, 0.6), slot('special_damage', 'pressão especial', 1, 0.6), slot('late_game_cleaner', 'finalizador', 1, 0.5)],
  },
  sun_trick_room: {
    id: 'sun_trick_room', label: 'Trick Room Sun',
    critical: [slot('trick_room_setter', 'setter de Trick Room', 1, 1, true), slot('trick_room_abuser', 'abuser lento de Trick Room', 2, 1, true), slot('weather_setter_sun', 'setter de sol', 1, 0.9, true), slot('weather_abuser_sun_primary', 'abuser primário de sol', 1, 0.8, true), slot('trick_room_protection', 'proteção para Trick Room', 1, 0.85, true)],
    important: [slot('premium_redirection', 'redirection premium', 1, 0.75), slot('physical_damage', 'pressão física', 1, 0.55), slot('special_damage', 'pressão especial', 1, 0.55), slot('defensive_glue', 'cola defensiva', 1, 0.5)],
  },
  rain_trick_room: {
    id: 'rain_trick_room', label: 'RainRoom',
    critical: [slot('trick_room_setter', 'setter de Trick Room', 1, 1, true), slot('trick_room_abuser', 'abuser lento de Trick Room', 2, 1, true), slot('weather_setter_rain', 'setter de chuva', 1, 0.9, true), slot('trick_room_protection', 'proteção para Trick Room', 1, 0.85, true)],
    important: [slot('premium_redirection', 'redirection premium', 1, 0.75), slot('physical_damage', 'pressão física', 1, 0.55), slot('special_damage', 'pressão especial', 1, 0.55), slot('defensive_glue', 'cola defensiva', 1, 0.5)],
  },
  rain_offense: {
    id: 'rain_offense', label: 'Rain Offense',
    critical: [slot('weather_setter_rain', 'setter de chuva', 1, 1, true), slot('weather_abuser_rain_primary', 'abuser de chuva', 2, 1, true), slot('speed_control', 'controle de velocidade', 1, 0.8, true), slot('turn_control', 'controle de turno', 1, 0.75, true)],
    important: [slot('weather_control_secondary', 'recuperação secundária de clima', 1, 0.55), slot('redirection', 'redirecionamento', 1, 0.45), slot('physical_damage', 'pressão física', 1, 0.55), slot('special_damage', 'pressão especial', 1, 0.55), slot('spread_damage', 'dano em área', 1, 0.5)],
  },
  rain_tailwind: {
    id: 'rain_tailwind', label: 'Rain Tailwind',
    critical: [slot('weather_setter_rain', 'setter de chuva', 1, 1, true), slot('weather_abuser_rain_primary', 'abuser de chuva', 1, 0.9, true), slot('tailwind_setter', 'setter de Tailwind', 1, 0.9, true), slot('turn_control', 'controle de turno', 1, 0.75, true)],
    important: [slot('spread_damage', 'dano em área', 1, 0.5), slot('pivot', 'pivot', 1, 0.5), slot('physical_damage', 'pressão física', 1, 0.55), slot('special_damage', 'pressão especial', 1, 0.55)],
  },
  sand_balance: {
    id: 'sand_balance', label: 'Sand Balance',
    critical: [slot('weather_setter_sand', 'setter de areia', 1, 1, true), slot('weather_abuser_sand_primary', 'abuser de areia', 1, 0.9, true), slot('turn_control', 'controle de turno', 1, 0.75, true), slot('defensive_glue', 'cola defensiva', 1, 0.65, true)],
    important: [slot('speed_control', 'controle de velocidade', 1, 0.45), slot('physical_damage', 'pressão física', 1, 0.55), slot('special_damage', 'pressão especial', 1, 0.55), slot('pivot', 'pivot', 1, 0.5)],
  },
  snow_balance: {
    id: 'snow_balance', label: 'Snow Balance',
    critical: [slot('weather_setter_snow', 'setter de neve', 1, 1, true), slot('weather_abuser_snow_primary', 'abuser de neve', 1, 0.9, true), slot('speed_control', 'controle de velocidade', 1, 0.65, true), slot('defensive_glue', 'cola defensiva', 1, 0.65, true)],
    important: [slot('turn_control', 'controle de turno', 1, 0.55), slot('physical_damage', 'pressão física', 1, 0.55), slot('special_damage', 'pressão especial', 1, 0.55), slot('spread_damage', 'dano em área', 1, 0.45)],
  },
  hard_trick_room: {
    id: 'hard_trick_room', label: 'Hard Trick Room',
    critical: [slot('trick_room_setter', 'setter de Trick Room', 1, 1, true), slot('trick_room_abuser', 'abuser lento de Trick Room', 2, 1, true), slot('trick_room_protection', 'proteção para Trick Room', 1, 0.9, true), slot('turn_control', 'controle de turno', 1, 0.75, true)],
    important: [slot('premium_redirection', 'redirection premium', 1, 0.75), slot('defensive_glue', 'cola defensiva', 1, 0.55), slot('physical_damage', 'pressão física', 1, 0.55), slot('special_damage', 'pressão especial', 1, 0.55), slot('spread_damage', 'dano em área', 1, 0.45)],
  },
  psychic_terrain_trick_room: {
    id: 'psychic_terrain_trick_room', label: 'Psychic Terrain Trick Room',
    critical: [slot('terrain_setter_psychic', 'setter de Psychic Terrain', 1, 1, true), slot('trick_room_setter', 'setter de Trick Room', 1, 1, true), slot('trick_room_protection', 'proteção para Trick Room', 1, 0.9, true), slot('special_damage', 'pressão especial', 1, 0.65, true)],
    important: [slot('terrain_abuser_psychic', 'abuser de Psychic Terrain', 1, 0.75), slot('premium_redirection', 'redirection premium', 1, 0.75), slot('trick_room_abuser', 'abuser lento de Trick Room', 1, 0.65), slot('physical_damage', 'pressão física', 1, 0.45)],
  },
  terrain_balance: {
    id: 'terrain_balance', label: 'Terrain Balance',
    critical: [slot('terrain_setter_any', 'setter de terreno', 1, 1, true), slot('turn_control', 'controle de turno', 1, 0.75, true), slot('defensive_glue', 'cola defensiva', 1, 0.65, true), slot('physical_damage', 'pressão física', 1, 0.55, true), slot('special_damage', 'pressão especial', 1, 0.55, true)],
    important: [slot('terrain_abuser_any', 'abuser de terreno', 1, 0.65), slot('speed_control', 'controle de velocidade', 1, 0.55), slot('pivot', 'pivot', 1, 0.5), slot('redirection', 'redirecionamento', 1, 0.45)],
  },
  terrain_offense: {
    id: 'terrain_offense', label: 'Terrain Offense',
    critical: [slot('terrain_setter_any', 'setter de terreno', 1, 1, true), slot('terrain_abuser_any', 'abuser de terreno', 1, 0.85, true), slot('speed_control', 'controle de velocidade', 1, 0.75, true), slot('turn_control', 'controle de turno', 1, 0.7, true), slot('spread_damage', 'dano em área', 1, 0.55, true)],
    important: [slot('pivot', 'pivot', 1, 0.45), slot('redirection', 'redirecionamento', 1, 0.45), slot('late_game_cleaner', 'finalizador', 1, 0.5)],
  },
  tailwind_balance: {
    id: 'tailwind_balance', label: 'Tailwind Balance',
    critical: [slot('tailwind_setter', 'setter de Tailwind', 1, 1, true), slot('turn_control', 'controle de turno', 1, 0.75, true), slot('physical_damage', 'pressão física', 1, 0.55, true), slot('special_damage', 'pressão especial', 1, 0.55, true), slot('defensive_glue', 'cola defensiva', 1, 0.5, true)],
    important: [slot('redirection', 'redirecionamento', 1, 0.45), slot('pivot', 'pivot', 1, 0.5), slot('spread_damage', 'dano em área', 1, 0.5), slot('late_game_cleaner', 'finalizador', 1, 0.45)],
  },
  setup_redirection: {
    id: 'setup_redirection', label: 'Setup + Redirection',
    critical: [slot('setup_pressure', 'ameaça de setup', 1, 1, true), slot('redirection', 'redirecionamento', 1, 1, true), slot('turn_control', 'controle de turno', 1, 0.75, true), slot('speed_control', 'controle de velocidade', 1, 0.6, true)],
    important: [slot('defensive_glue', 'cola defensiva', 1, 0.55), slot('pivot', 'pivot', 1, 0.5), slot('spread_damage', 'dano em área', 1, 0.45), slot('late_game_cleaner', 'finalizador', 1, 0.45)],
  },
  bulky_offense: {
    id: 'bulky_offense', label: 'Bulky Offense',
    critical: [slot('turn_control', 'controle de turno', 1, 0.8, true), slot('defensive_glue', 'cola defensiva', 1, 0.75, true), slot('physical_damage', 'pressão física', 1, 0.55, true), slot('special_damage', 'pressão especial', 1, 0.55, true), slot('speed_control', 'controle de velocidade', 1, 0.55, true)],
    important: [slot('pivot', 'pivot', 1, 0.55), slot('redirection', 'redirecionamento', 1, 0.45), slot('late_game_cleaner', 'finalizador', 1, 0.45)],
  },
  hyper_offense: {
    id: 'hyper_offense', label: 'Hyper Offense',
    critical: [slot('speed_control', 'controle de velocidade', 1, 0.85, true), slot('turn_control', 'controle de turno', 1, 0.6, true), slot('physical_damage', 'pressão física', 1, 0.55, true), slot('special_damage', 'pressão especial', 1, 0.55, true), slot('spread_damage', 'dano em área', 1, 0.55, true)],
    important: [slot('priority', 'prioridade', 1, 0.45), slot('late_game_cleaner', 'finalizador', 1, 0.45), slot('pivot', 'pivot', 1, 0.35)],
  },
  balance: {
    id: 'balance', label: 'Balance',
    critical: [slot('speed_control', 'controle de velocidade', 1, 0.75, true), slot('turn_control', 'controle de turno', 1, 0.75, true), slot('physical_damage', 'pressão física', 1, 0.55, true), slot('special_damage', 'pressão especial', 1, 0.55, true), slot('defensive_glue', 'cola defensiva', 1, 0.55, true)],
    important: [slot('pivot', 'pivot', 1, 0.5), slot('redirection', 'redirecionamento', 1, 0.4), slot('spread_damage', 'dano em área', 1, 0.45), slot('late_game_cleaner', 'finalizador', 1, 0.45)],
  },
};


export interface VgcArchetypeCompatibilityResult {
  score: number;
  warnings: string[];
  hardFailures: string[];
}


export interface VgcSetQualityResult {
  score: number;
  warnings: string[];
  hardFailures: string[];
}


const HIGH_VALUE_STATUS_MOVES = new Set([
  'protect', 'trickroom', 'tailwind', 'followme', 'ragepowder', 'allyswitch', 'fakeout',
  'spore', 'sleeppowder', 'yawn', 'taunt', 'encore', 'disable', 'helpinghand', 'wideguard',
  'quickguard', 'partingshot', 'willowisp', 'snarl', 'recover', 'painsplit', 'lifedew',
  'reflect', 'lightscreen', 'auroraveil', 'sunnyday', 'raindance', 'sandstorm', 'snowscape',
  'uturn', 'voltswitch', 'flipturn', 'instruct', 'imprison', 'leechseed', 'pollenpuff',
]);

const GENERIC_FALLBACK_DAMAGE_MOVES = new Set(['doubleedge', 'hypervoice', 'terablast']);
const NORMAL_CONVERSION_ABILITIES = ['Aerilate', 'Pixilate', 'Refrigerate', 'Galvanize', 'Liquid Voice'];

function hasNormalConversionAbility(pokemon: PokemonData, format: string): boolean {
  return hasAny(getAbilityValues(pokemon, format), NORMAL_CONVERSION_ABILITIES);
}

function isReliableDamageMoveForPokemon(pokemon: PokemonData, format: string, moveName: string): boolean {
  const move = Dex.moves.get(moveName);
  if (!move.exists || move.category === 'Status' || Number(move.basePower ?? 0) <= 0) return false;

  const stats = getVariant(pokemon, format)?.baseStats;
  const atk = Number(stats?.atk ?? 0);
  const spa = Number(stats?.spa ?? 0);
  const physicalBias = atk >= spa + 15;
  const specialBias = spa >= atk + 15;
  const moveType = normalize(String(move.type ?? ''));
  const types = getPokemonTypes(pokemon, format).map(normalize);
  const isStab = types.includes(moveType) || (moveType === 'normal' && hasNormalConversionAbility(pokemon, format));

  if (isStab) return true;
  if (physicalBias && move.category === 'Physical') return true;
  if (specialBias && move.category === 'Special') return true;
  if (!physicalBias && !specialBias) return true;

  return false;
}

function isGenericFallbackDamageMove(pokemon: PokemonData, format: string, moveName: string): boolean {
  const normalizedMove = normalize(moveName);
  if (!GENERIC_FALLBACK_DAMAGE_MOVES.has(normalizedMove)) return false;
  const types = getPokemonTypes(pokemon, format).map(normalize);
  if ((normalizedMove === 'doubleedge' || normalizedMove === 'hypervoice') && (types.includes('normal') || hasNormalConversionAbility(pokemon, format))) {
    return false;
  }
  return true;
}

export function evaluateVgcSetQuality(
  pokemon: PokemonData,
  format: string,
  archetype: VgcArchetypeId,
): VgcSetQualityResult {
  const warnings: string[] = [];
  const hardFailures: string[] = [];
  const moves = (pokemon.moves ?? []).map(move => String(move));
  const normalizedMoves = moves.map(normalize);
  const slots = getMechanicSlotsForPokemon(pokemon, format);
  const stats = getVariant(pokemon, format)?.baseStats;
  const speed = Number(stats?.spe ?? 0);
  let score = 0;

  if (moves.length < 4) {
    warnings.push(`${pokemon.name} possui menos de quatro golpes; provável fallback incompleto.`);
    score -= 18;
  }

  if (slots.has('trick_room_setter') && !normalizedMoves.includes('trickroom')) {
    hardFailures.push(`${pokemon.name} foi classificado como setter de Trick Room, mas o set não possui Trick Room.`);
  }

  if (slots.has('redirection') && !normalizedMoves.some(move => ['followme', 'ragepowder', 'allyswitch'].includes(move))) {
    hardFailures.push(`${pokemon.name} foi classificado como redirection, mas o set não possui Follow Me/Rage Powder/Ally Switch.`);
  }

  if (slots.has('weather_setter_sun') && !hasAny(getAbilityValues(pokemon, format), ['Drought', 'Orichalcum Pulse', 'Desolate Land']) && !normalizedMoves.includes('sunnyday')) {
    hardFailures.push(`${pokemon.name} foi classificado como setter de sol, mas o set/habilidade não ativa sol.`);
  }

  if (slots.has('weather_abuser_sun_primary')) {
    const hasActualSunAbuse = hasAny(getAbilityValues(pokemon, format), ['Chlorophyll', 'Solar Power', 'Flower Gift', 'Harvest', 'Protosynthesis']) ||
      normalizedMoves.some(move => ['weatherball', 'solarblade', 'solarbeam', 'eruption', 'heatwave'].includes(move)) ||
      getVgcMechanicTags(pokemon).some(tag => tag.mechanic === 'weather' && tag.weather === 'sun' && tag.role === 'abuser' && tag.confidence >= 0.6);

    if (!hasActualSunAbuse) {
      hardFailures.push(`${pokemon.name} foi classificado como abuser de sol, mas habilidade/golpes não sustentam essa função.`);
    }
  }

  if (isTrickRoomBlueprint(archetype) && hasWeatherSpeedDoublingAbility(pokemon, format) && getEffectiveWeatherSpeedForContract(pokemon, format) >= 80) {
    hardFailures.push(`${pokemon.name} usa habilidade que dobra Speed no clima e cria modo oposto ao contrato de Trick Room.`);
  }

  if (shouldExpectProtect(pokemon) && moves.length >= 4 && !normalizedMoves.includes('protect') && !slots.has('trick_room_setter') && !slots.has('turn_control')) {
    warnings.push(`${pokemon.name} não possui Protect em um set VGC sem item travado; revise a segurança de turno.`);
    score -= 10;
  }

  let reliableDamage = 0;
  let unreliableDamage = 0;
  let genericFallbackDamage = 0;
  let highValueUtility = 0;

  for (const moveName of moves) {
    const normalizedMove = normalize(moveName);
    const move = Dex.moves.get(moveName);

    if (HIGH_VALUE_STATUS_MOVES.has(normalizedMove)) {
      highValueUtility++;
    }

    if (!move.exists || move.category === 'Status' || Number(move.basePower ?? 0) <= 0) continue;

    if (isGenericFallbackDamageMove(pokemon, format, moveName)) {
      genericFallbackDamage++;
    }

    if (isReliableDamageMoveForPokemon(pokemon, format, moveName)) {
      reliableDamage++;
    } else {
      unreliableDamage++;
    }
  }

  if (genericFallbackDamage > 0) {
    warnings.push(`${pokemon.name} usa golpe genérico sem sinergia clara com tipo/ability; provável fallback de set.`);
    score -= genericFallbackDamage * 18;
  }

  if (unreliableDamage >= 2) {
    warnings.push(`${pokemon.name} tem vários golpes ofensivos desalinhados com seus atributos/tipos.`);
    score -= unreliableDamage * 12;
  }

  const isSupport = slots.has('turn_control') || slots.has('redirection') || slots.has('premium_redirection') || slots.has('trick_room_setter') || slots.has('trick_room_protection') || slots.has('pivot') || slots.has('defensive_glue');
  const isDamageRole = slots.has('physical_damage') || slots.has('special_damage') || slots.has('trick_room_abuser') || slots.has('weather_abuser_sun_primary') || slots.has('weather_abuser_rain_primary') || slots.has('terrain_abuser_any');

  if (isDamageRole && reliableDamage === 0 && !isSupport) {
    hardFailures.push(`${pokemon.name} foi classificado como peça ofensiva, mas o set não possui dano confiável.`);
  }

  if (isTrickRoomBlueprint(archetype)) {
    const hasTrickRoomContribution = slots.has('trick_room_setter') || slots.has('trick_room_abuser') || slots.has('trick_room_protection') || slots.has('premium_redirection') || slots.has('turn_control') || slots.has('defensive_glue') || slots.has('priority');
    if (!hasTrickRoomContribution && isDamageRole) {
      warnings.push(`${pokemon.name} não entrega contribuição clara para o contrato de Trick Room.`);
      score -= 28;
    }

    if (speed >= 85 && isDamageRole && !isSupport && !slots.has('priority')) {
      warnings.push(`${pokemon.name} é atacante rápido demais para ser filler de Trick Room sem função de suporte.`);
      score -= 34;
    }
  }

  if (highValueUtility > 0) score += Math.min(16, highValueUtility * 4);
  if (reliableDamage > 0) score += Math.min(18, reliableDamage * 4);
  score -= hardFailures.length * 120;
  score -= warnings.length * 8;

  return { score, warnings, hardFailures };
}

const TRICK_ROOM_ARCHETYPES: VgcArchetypeId[] = ['hard_trick_room', 'sun_trick_room', 'psychic_terrain_trick_room', 'rain_trick_room'];

function isTrickRoomBlueprint(archetype: VgcArchetypeId): boolean {
  return TRICK_ROOM_ARCHETYPES.includes(archetype);
}

function isOffPlanFastWeatherAbuser(pokemon: PokemonData, format: string): boolean {
  const effectiveSpeed = getEffectiveWeatherSpeedForContract(pokemon, format);
  const slots = getMechanicSlotsForPokemon(pokemon, format);
  return effectiveSpeed >= 80 &&
    slots.has('weather_abuser_sun_primary') &&
    !slots.has('trick_room_abuser') &&
    !slots.has('trick_room_setter') &&
    !slots.has('premium_redirection') &&
    !slots.has('redirection');
}

function hasReliableMechanicSet(pokemon: PokemonData, format: string, archetype: VgcArchetypeId): string[] {
  const quality = evaluateVgcSetQuality(pokemon, format, archetype);
  return [...quality.warnings, ...quality.hardFailures];
}

export function evaluateVgcArchetypeCompatibility(
  team: PokemonData[],
  format: string,
  archetype: VgcArchetypeId,
): VgcArchetypeCompatibilityResult {
  const warnings: string[] = [];
  const hardFailures: string[] = [];
  let score = 0;

  for (const pokemon of team) {
    const setQuality = evaluateVgcSetQuality(pokemon, format, archetype);
    warnings.push(...setQuality.warnings);
    hardFailures.push(...setQuality.hardFailures);
    score += setQuality.score;
  }

  if (isTrickRoomBlueprint(archetype)) {
    const fastWeatherAbusers = team.filter(pokemon => isOffPlanFastWeatherAbuser(pokemon, format));
    const offPlanFastAttackers = team.filter(pokemon => {
      const speed = Number(getVariant(pokemon, format)?.baseStats?.spe ?? 0);
      const slots = getMechanicSlotsForPokemon(pokemon, format);
      const isDamage = slots.has('physical_damage') || slots.has('special_damage');
      const isSupport = slots.has('turn_control') || slots.has('redirection') || slots.has('premium_redirection') || slots.has('trick_room_setter') || slots.has('trick_room_protection') || slots.has('pivot');
      return speed >= 90 && isDamage && !isSupport && !slots.has('trick_room_abuser');
    });

    if (fastWeatherAbusers.length) {
      warnings.push(`Abuser rápido de clima (${fastWeatherAbusers.map(pokemon => pokemon.name).join(', ')}) cria um modo de velocidade oposto ao Trick Room principal.`);
      score -= fastWeatherAbusers.length * 55;
    }

    if (offPlanFastAttackers.length) {
      warnings.push(`Atacante rápido sem função de suporte (${offPlanFastAttackers.map(pokemon => pokemon.name).join(', ')}) disputa o contrato de Trick Room.`);
      score -= offPlanFastAttackers.length * 42;
    }

    const hasSetter = team.some(pokemon => getMechanicSlotsForPokemon(pokemon, format).has('trick_room_setter'));
    const slowAbusers = team.filter(pokemon => getMechanicSlotsForPokemon(pokemon, format).has('trick_room_abuser')).length;
    const protection = team.filter(pokemon => getMechanicSlotsForPokemon(pokemon, format).has('trick_room_protection') || getMechanicSlotsForPokemon(pokemon, format).has('premium_redirection')).length;

    if (!hasSetter) hardFailures.push('Arquétipo de Trick Room sem setter confiável de Trick Room.');
    if (slowAbusers < 2) warnings.push('Trick Room com menos de dois abusers lentos reduz consistência dos modos de 4.');
    if (protection < 1) hardFailures.push('Arquétipo de Trick Room sem proteção para setar Trick Room.');

    score += Math.min(45, slowAbusers * 15 + protection * 10);
  }

  if (archetype === 'sun_trick_room') {
    const slowSunAbusers = team.filter(pokemon => {
      const effectiveSpeed = getEffectiveWeatherSpeedForContract(pokemon, format);
      const slots = getMechanicSlotsForPokemon(pokemon, format);
      return slots.has('weather_abuser_sun_primary') && effectiveSpeed <= 70;
    }).length;
    const speedBoostingWeatherAbusers = team.filter(pokemon => {
      const slots = getMechanicSlotsForPokemon(pokemon, format);
      return slots.has('weather_abuser_sun_primary') && hasWeatherSpeedDoublingAbility(pokemon, format) && getEffectiveWeatherSpeedForContract(pokemon, format) >= 80;
    });

    if (slowSunAbusers < 1) {
      hardFailures.push('Trick Room Sun precisa de pelo menos um abuser de sol compatível com baixa velocidade, como Torkoal ou equivalente.');
    } else {
      score += 25;
    }

    if (speedBoostingWeatherAbusers.length) {
      hardFailures.push(`Trick Room Sun não deve usar abusers que dobram Speed no clima (${speedBoostingWeatherAbusers.map(pokemon => pokemon.name).join(', ')}).`);
    }
  }

  if (archetype === 'sun_offense') {
    const fastSunAbusers = team.filter(pokemon => {
      const speed = Number(getVariant(pokemon, format)?.baseStats?.spe ?? 0);
      const slots = getMechanicSlotsForPokemon(pokemon, format);
      return slots.has('weather_abuser_sun_primary') && speed >= 70;
    }).length;
    if (fastSunAbusers < 1) warnings.push('Sun Offense sem abuser rápido de sol tende a perder pressão imediata.');
  }

  if (archetype === 'rain_offense' || archetype === 'rain_tailwind') {
    const rainSetters = team.filter(pokemon => getMechanicSlotsForPokemon(pokemon, format).has('weather_setter_rain')).length;
    const rainAbusers = team.filter(pokemon => getMechanicSlotsForPokemon(pokemon, format).has('weather_abuser_rain_primary')).length;
    const rainTailwind = team.filter(pokemon => getMechanicSlotsForPokemon(pokemon, format).has('tailwind_setter')).length;
    const offPlanFire = team.filter(pokemon =>
      getPokemonTypes(pokemon, format).some(type => normalize(type) === 'fire') &&
      !getMechanicSlotsForPokemon(pokemon, format).has('redirection') &&
      !getMechanicSlotsForPokemon(pokemon, format).has('turn_control') &&
      !getMechanicSlotsForPokemon(pokemon, format).has('weather_control_secondary')
    );

    if (rainSetters < 1) hardFailures.push('Arquétipo de Rain sem setter confiável de chuva.');
    if (rainAbusers < 1) hardFailures.push('Arquétipo de Rain sem abuser primário de chuva.');
    if (archetype === 'rain_offense' && rainAbusers < 2) warnings.push('Rain Offense com apenas um abuser primário depende demais de um único modo de 4.');
    if (archetype === 'rain_tailwind' && rainTailwind < 1) hardFailures.push('Rain Tailwind precisa de setter de Tailwind ou suporte equivalente.');
    if (offPlanFire.length) warnings.push(`Fire-type sem função clara (${offPlanFire.map(pokemon => pokemon.name).join(', ')}) perde valor quando a chuva é o campo principal.`);

    score += Math.min(45, rainAbusers * 16 + rainTailwind * 10);
  }

  score -= warnings.length * 9;
  score -= hardFailures.length * 120;

  return { score, warnings, hardFailures };
}

export function evaluateVgcCandidateArchetypeCompatibility(
  candidate: PokemonData,
  baseTeam: PokemonData[],
  format: string,
  archetype: VgcArchetypeId,
): VgcArchetypeCompatibilityResult {
  const before = evaluateVgcArchetypeCompatibility(baseTeam, format, archetype);
  const after = evaluateVgcArchetypeCompatibility([...baseTeam, candidate], format, archetype);
  return {
    score: after.score - before.score,
    warnings: after.warnings.filter(warning => !before.warnings.includes(warning)),
    hardFailures: after.hardFailures.filter(failure => !before.hardFailures.includes(failure)),
  };
}

export function getVgcArchetypeBlueprint(archetype: VgcArchetypeId): VgcArchetypeBlueprint {
  return VGC_ARCHETYPE_BLUEPRINTS[archetype] ?? VGC_ARCHETYPE_BLUEPRINTS.balance;
}

function evaluateRequirement(teamSlots: Record<VgcMechanicSlotId, string[]>, requirement: VgcMechanicSlotRequirement): boolean {
  return (teamSlots[requirement.id]?.length ?? 0) >= requirement.min;
}

function createEmptySlotMap(): Record<VgcMechanicSlotId, string[]> {
  const ids = new Set<VgcMechanicSlotId>();
  for (const blueprint of Object.values(VGC_ARCHETYPE_BLUEPRINTS)) {
    for (const requirement of [...blueprint.critical, ...blueprint.important]) ids.add(requirement.id);
  }

  const base = {} as Record<VgcMechanicSlotId, string[]>;
  for (const id of ids) base[id] = [];
  return base;
}

export function evaluateVgcMechanicBlueprint(
  team: PokemonData[],
  format: string,
  archetype: VgcArchetypeId,
): VgcMechanicCoverage {
  const blueprint = getVgcArchetypeBlueprint(archetype);
  const detectedSlots = createEmptySlotMap();

  for (const pokemon of team) {
    for (const slotId of getMechanicSlotsForPokemon(pokemon, format)) {
      detectedSlots[slotId] = detectedSlots[slotId] ?? [];
      detectedSlots[slotId].push(pokemon.name);
    }
  }

  const missingCriticalMechanics = blueprint.critical
    .filter(requirement => !evaluateRequirement(detectedSlots, requirement))
    .map(requirement => requirement.label);

  const missingImportantMechanics = blueprint.important
    .filter(requirement => !evaluateRequirement(detectedSlots, requirement))
    .map(requirement => requirement.label);

  const conflictWarnings: string[] = [];

  const weatherSetters = [
    detectedSlots.weather_setter_sun?.length ? 'sun' : '',
    detectedSlots.weather_setter_rain?.length ? 'rain' : '',
    detectedSlots.weather_setter_sand?.length ? 'sand' : '',
    detectedSlots.weather_setter_snow?.length ? 'snow' : '',
  ].filter(Boolean);

  if (weatherSetters.length >= 2 && !['balance', 'bulky_offense'].includes(archetype)) {
    conflictWarnings.push('Dois ou mais climas competem pelo mesmo plano de campo.');
  }

  if (hasTerrainSleepConflict(team)) {
    conflictWarnings.push('Terreno Elétrico ou Misty conflita com plano de sono.');
  }

  if (['hard_trick_room', 'sun_trick_room', 'psychic_terrain_trick_room'].includes(archetype)) {
    const fastNonSupport = team.filter(pokemon => isFastPokemon(pokemon, format) && !getMechanicSlotsForPokemon(pokemon, format).has('turn_control') && !getMechanicSlotsForPokemon(pokemon, format).has('redirection'));
    if (fastNonSupport.length >= 2) conflictWarnings.push('Muitos atacantes rápidos disputam o plano de Trick Room.');
  }

  if (archetype === 'sun_trick_room' && countTypeMembers(team, format, 'Fire') >= 3) {
    conflictWarnings.push('Trick Room Sun com três Fire-types tende a ficar redundante contra Rock/Ground/Water.');
  }

  const architectureCompatibility = evaluateVgcArchetypeCompatibility(team, format, archetype);
  conflictWarnings.push(...architectureCompatibility.warnings, ...architectureCompatibility.hardFailures);

  const criticalWeight = blueprint.critical.reduce((sum, requirement) => sum + requirement.weight, 0) || 1;
  const importantWeight = blueprint.important.reduce((sum, requirement) => sum + requirement.weight, 0) || 1;
  const criticalFilledWeight = blueprint.critical.reduce((sum, requirement) => sum + (evaluateRequirement(detectedSlots, requirement) ? requirement.weight : 0), 0);
  const importantFilledWeight = blueprint.important.reduce((sum, requirement) => sum + (evaluateRequirement(detectedSlots, requirement) ? requirement.weight : 0), 0);

  const criticalScore = (criticalFilledWeight / criticalWeight) * 72;
  const importantScore = (importantFilledWeight / importantWeight) * 28;

  return {
    detectedSlots,
    missingCriticalMechanics,
    missingImportantMechanics,
    conflictWarnings,
    score: clamp(criticalScore + importantScore + architectureCompatibility.score * 0.12 - conflictWarnings.length * 9),
  };
}

export function evaluateVgcMechanicCandidateFit(
  candidate: PokemonData,
  baseTeam: PokemonData[],
  format: string,
  archetype: VgcArchetypeId,
): VgcMechanicCandidateFit {
  const baseCoverage = evaluateVgcMechanicBlueprint(baseTeam, format, archetype);
  const candidateTeam = [...baseTeam, candidate];
  const nextCoverage = evaluateVgcMechanicBlueprint(candidateTeam, format, archetype);
  const candidateSlots = getMechanicSlotsForPokemon(candidate, format);
  const blueprint = getVgcArchetypeBlueprint(archetype);
  const reasons: string[] = [];

  let score = Math.round((nextCoverage.score - baseCoverage.score) * 1.15);

  for (const requirement of blueprint.critical) {
    const wasMissing = baseCoverage.missingCriticalMechanics.includes(requirement.label);
    const isFilled = (nextCoverage.detectedSlots[requirement.id]?.length ?? 0) >= requirement.min;
    if (wasMissing && isFilled) {
      score += Math.round(28 * requirement.weight);
      reasons.push(`Preenche mecânica crítica do arquétipo: ${requirement.label}`);
    }
  }

  for (const requirement of blueprint.important) {
    const wasMissing = baseCoverage.missingImportantMechanics.includes(requirement.label);
    const isFilled = (nextCoverage.detectedSlots[requirement.id]?.length ?? 0) >= requirement.min;
    if (wasMissing && isFilled) {
      score += Math.round(13 * requirement.weight);
      reasons.push(`Complementa mecânica importante: ${requirement.label}`);
    }
  }

  if (nextCoverage.conflictWarnings.length > baseCoverage.conflictWarnings.length) {
    score -= (nextCoverage.conflictWarnings.length - baseCoverage.conflictWarnings.length) * 26;
    reasons.push('Introduz conflito mecânico com o arquétipo detectado.');
  }

  if (candidateSlots.has('premium_redirection') && ['hard_trick_room', 'sun_trick_room', 'psychic_terrain_trick_room', 'setup_redirection'].includes(archetype)) {
    score += 18;
    reasons.push('Adiciona redirection premium para proteger a condição de vitória.');
  }

  const setQuality = evaluateVgcSetQuality(candidate, format, archetype);
  score += Math.round(setQuality.score * 0.45);
  if (setQuality.hardFailures.length) {
    score -= setQuality.hardFailures.length * 55;
    reasons.push('Set não sustenta a função mecânica atribuída.');
  } else if (setQuality.warnings.length) {
    score -= setQuality.warnings.length * 10;
    reasons.push('Set precisa de ajuste para sustentar melhor o arquétipo.');
  }

  return { score, reasons: reasons.slice(0, 5) };
}
