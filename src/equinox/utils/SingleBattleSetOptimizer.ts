import { Dex } from '@pkmn/dex';
import { PokemonData } from '../core/AnalysisContext';
import { getMegaBaseName, getVariant } from './PokemonUtils';
import { getMegaSpeciesFromStone, isMegaStone, resolveLegalAbility } from './VgcSetOptimizer';

export type SingleSetMode = 'vanilla' | 'radical_red' | 'champions_singles';

interface SinglePreset {
  ability: string;
  item?: string;
  nature: string;
  role: string;
  moves: string[];
}

const normalize = (value?: string): string => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const DOUBLES_ONLY_OR_LOW_VALUE_IN_SINGLES = new Set([
  'tailwind',
  'helpinghand',
  'followme',
  'ragepowder',
  'wideguard',
  'quickguard',
  'allyswitch',
  'quash',
  'coaching',
  'afteryou',
  'instruct',
]);

const PHYSICAL_STAB: Record<string, string> = {
  normal: 'Body Slam', fire: 'Flare Blitz', water: 'Liquidation', electric: 'Wild Charge', grass: 'Seed Bomb', ice: 'Ice Spinner',
  fighting: 'Close Combat', poison: 'Poison Jab', ground: 'Earthquake', flying: 'Brave Bird', psychic: 'Zen Headbutt', bug: 'Leech Life',
  rock: 'Stone Edge', ghost: 'Shadow Claw', dragon: 'Dragon Claw', dark: 'Knock Off', steel: 'Iron Head', fairy: 'Play Rough',
};

const SPECIAL_STAB: Record<string, string> = {
  normal: 'Hyper Voice', fire: 'Flamethrower', water: 'Surf', electric: 'Thunderbolt', grass: 'Energy Ball', ice: 'Ice Beam',
  fighting: 'Aura Sphere', poison: 'Sludge Bomb', ground: 'Earth Power', flying: 'Air Slash', psychic: 'Psychic', bug: 'Bug Buzz',
  rock: 'Power Gem', ghost: 'Shadow Ball', dragon: 'Draco Meteor', dark: 'Dark Pulse', steel: 'Flash Cannon', fairy: 'Moonblast',
};

const SINGLES_PRESETS: Record<string, SinglePreset> = {
  pelipper: {
    ability: 'Drizzle', item: 'Damp Rock', nature: 'Bold', role: 'Rain Setter / Pivot',
    moves: ['Hurricane', 'Surf', 'U-turn', 'Roost'],
  },
  swampertmega: {
    ability: 'Swift Swim', item: 'Swampertite', nature: 'Adamant', role: 'Mega Rain Cleaner',
    moves: ['Waterfall', 'Earthquake', 'Ice Punch', 'Power-Up Punch'],
  },
  swampert: {
    ability: 'Torrent', item: 'Leftovers', nature: 'Impish', role: 'Bulky Ground / Hazard Setter',
    moves: ['Stealth Rock', 'Earthquake', 'Liquidation', 'Roar'],
  },
  sableye: {
    ability: 'Prankster', item: 'Heavy-Duty Boots', nature: 'Careful', role: 'Prankster Disruption / Status Support',
    moves: ['Will-O-Wisp', 'Knock Off', 'Recover', 'Encore'],
  },
  blastoise: {
    ability: 'Torrent', item: 'White Herb', nature: 'Modest', role: 'Shell Smash Win Condition / Removal',
    moves: ['Shell Smash', 'Surf', 'Ice Beam', 'Rapid Spin'],
  },
  volcarona: {
    ability: 'Flame Body', item: 'Heavy-Duty Boots', nature: 'Timid', role: 'Quiver Dance Win Condition',
    moves: ['Quiver Dance', 'Flamethrower', 'Bug Buzz', 'Giga Drain'],
  },
  salamencemega: {
    ability: 'Aerilate', item: 'Salamencite', nature: 'Jolly', role: 'Mega Dragon Dance Cleaner',
    moves: ['Dragon Dance', 'Double-Edge', 'Earthquake', 'Roost'],
  },
  tapukoko: {
    ability: 'Electric Surge', item: 'Heavy-Duty Boots', nature: 'Timid', role: 'Fast Pivot / Electric Terrain Pressure',
    moves: ['Thunderbolt', 'Dazzling Gleam', 'U-turn', 'Roost'],
  },
  rillaboom: {
    ability: 'Grassy Surge', item: 'Assault Vest', nature: 'Adamant', role: 'Grassy Terrain Pivot / Priority',
    moves: ['Grassy Glide', 'Wood Hammer', 'Knock Off', 'U-turn'],
  },
};

function getSpeciesTypes(name: string): string[] {
  const species = Dex.species.get(name);
  if (species.exists) return species.types.map((type: string) => normalize(type));
  const base = Dex.species.get(getMegaBaseName(name));
  return base.exists ? base.types.map((type: string) => normalize(type)) : [];
}

function getSpeciesStats(name: string) {
  const species = Dex.species.get(name);
  if (species.exists) return species.baseStats;
  const base = Dex.species.get(getMegaBaseName(name));
  return base.exists ? base.baseStats : undefined;
}

function choosePrimaryAbility(pokemon: PokemonData, format: string): string | undefined {
  const variantAbilities = getVariant(pokemon, format)?.abilities;
  const preferred = variantAbilities?.['0'] ?? pokemon.abilities?.['0'];
  return preferred ? String(preferred) : pokemon.ability;
}

function isChoiceItem(item?: string): boolean {
  return ['choiceband', 'choicespecs', 'choicescarf'].includes(normalize(item));
}

function isLowValueMoveForSingles(moveName: string): boolean {
  const key = normalize(moveName);
  if (DOUBLES_ONLY_OR_LOW_VALUE_IN_SINGLES.has(key)) return true;
  return false;
}

function hasMove(moves: string[], move: string): boolean {
  const key = normalize(move);
  return moves.some(existing => normalize(existing) === key);
}

function uniqueMoves(moves: string[]): string[] {
  const selected: string[] = [];
  for (const move of moves) {
    if (!move || hasMove(selected, move)) continue;
    selected.push(move);
    if (selected.length >= 4) break;
  }
  return selected;
}

function synthesizeSinglesMoves(pokemon: PokemonData, format: string, mode: SingleSetMode): string[] {
  const types = getVariant(pokemon, format)?.types?.map(normalize) ?? getSpeciesTypes(pokemon.name);
  const stats = getVariant(pokemon, format)?.baseStats ?? getSpeciesStats(pokemon.name);
  const atk = Number(stats?.atk ?? 80);
  const spa = Number(stats?.spa ?? 80);
  const spe = Number(stats?.spe ?? 80);
  const physical = atk >= spa;
  const stabMap = physical ? PHYSICAL_STAB : SPECIAL_STAB;
  const stabMoves = types.map(type => stabMap[type]).filter(Boolean);
  const coverage = physical
    ? ['Earthquake', 'Knock Off', 'Stone Edge', 'U-turn', 'Swords Dance']
    : ['Ice Beam', 'Earth Power', 'Thunderbolt', 'Calm Mind', 'Recover'];
  const utility: string[] = [];

  if (mode !== 'vanilla') {
    if (types.includes('rock') || types.includes('ground') || types.includes('steel')) utility.push('Stealth Rock');
    if (types.includes('flying')) utility.push('Roost');
    if (types.includes('water') && spe < 95) utility.push('Flip Turn');
  }

  return uniqueMoves([...utility, ...stabMoves, ...coverage]).slice(0, 4);
}

function sanitizeSinglesMoves(pokemon: PokemonData, format: string, mode: SingleSetMode): string[] {
  const moves = (pokemon.moves ?? []).filter(move => !isLowValueMoveForSingles(move));
  const sanitized = uniqueMoves([...moves, ...synthesizeSinglesMoves(pokemon, format, mode)]);

  if (isChoiceItem(pokemon.item)) {
    return sanitized.filter(move => normalize(move) !== 'protect').slice(0, 4);
  }

  // Protect is valid in Singles sometimes, but it should not be generic filler
  // for adventure/Singles recommendations unless the set intentionally supplied it.
  if (mode !== 'champions_singles') {
    return sanitized.filter(move => normalize(move) !== 'protect').slice(0, 4);
  }

  return sanitized.slice(0, 4);
}

function chooseSinglesItem(pokemon: PokemonData, mode: SingleSetMode): string | undefined {
  if (pokemon.item && !isMegaStone(pokemon.item)) {
    const key = normalize(pokemon.item);
    if (key !== 'sitrusberry' || mode === 'radical_red') return pokemon.item;
  }

  const stats = getVariant(pokemon, 'vanilla')?.baseStats ?? getSpeciesStats(pokemon.name);
  const hp = Number(stats?.hp ?? 80);
  const def = Number(stats?.def ?? 80);
  const spd = Number(stats?.spd ?? 80);
  const spe = Number(stats?.spe ?? 80);

  if (mode === 'vanilla') return 'Leftovers';
  if (hp >= 90 || def >= 100 || spd >= 100) return 'Leftovers';
  if (spe >= 105) return 'Heavy-Duty Boots';
  return 'Life Orb';
}

export function optimizeSingleBattleSet(pokemon: PokemonData, format: string, mode: SingleSetMode): PokemonData {
  const itemMegaSpecies = getMegaSpeciesFromStone(pokemon.item);
  const materialized: PokemonData = itemMegaSpecies && normalize(pokemon.name) !== normalize(itemMegaSpecies)
    ? { ...pokemon, name: itemMegaSpecies }
    : pokemon;

  const key = normalize(materialized.name);
  const preset = mode !== 'vanilla' ? SINGLES_PRESETS[key] : undefined;

  if (preset) {
    return {
      ...materialized,
      ability: resolveLegalAbility(materialized, format, preset.ability),
      item: preset.item ?? materialized.item,
      nature: preset.nature,
      role: preset.role,
      moves: preset.moves,
    };
  }

  const ability = mode === 'vanilla'
    ? (choosePrimaryAbility(materialized, format) ?? materialized.ability ?? 'Nenhum')
    : resolveLegalAbility(materialized, format, materialized.ability);

  const item = materialized.item && isMegaStone(materialized.item)
    ? materialized.item
    : chooseSinglesItem(materialized, mode);

  return {
    ...materialized,
    ability,
    item,
    moves: sanitizeSinglesMoves(materialized, format, mode),
  };
}
