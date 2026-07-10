import { Dex } from '@pkmn/dex';
import { PokemonData } from '../core/AnalysisContext';
import { getMegaBaseName, getMegaStone, getVariant } from './PokemonUtils';
import { getPreferredVgcMechanicSet, getVgcMechanicProfile } from '../vgc/VgcMechanicProfiles';

export interface VgcSetPlanContext {
  primaryWeather?: 'rain' | 'sun' | 'sand' | 'snow';
  speedPlan?: 'trick_room' | 'tailwind' | 'weather_speed' | 'standard';
}

export interface VgcSetOptimizationOptions {
  /**
   * Curated presets are intentionally opinionated. Use this when the set came
   * from a generic fallback or from a broad data pack and the target is VGC-style
   * doubles consistency rather than preserving an exact user-authored paste.
   */
  preferCurated?: boolean;

  /**
   * Plan context resolved from the user's selected core. This is intentionally
   * optional and local to Doubles set generation, so weather/manual setter logic
   * does not leak into Vanilla, Radical Red or Champions Singles.
   */
  formatPlan?: VgcSetPlanContext;
}

interface CuratedVgcSet {
  ability: string;
  item: string;
  nature: string;
  role: string;
  moves: string[];
}

const normalize = (value?: string): string =>
  String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const MEGA_STONE_TO_SPECIES: Record<string, string> = {
  venusaurite: 'Venusaur-Mega',
  charizarditex: 'Charizard-Mega-X',
  charizarditey: 'Charizard-Mega-Y',
  blastoisinite: 'Blastoise-Mega',
  beedrillite: 'Beedrill-Mega',
  pidgeotite: 'Pidgeot-Mega',
  alakazite: 'Alakazam-Mega',
  slowbronite: 'Slowbro-Mega',
  gengarite: 'Gengar-Mega',
  kangaskhanite: 'Kangaskhan-Mega',
  pinsirite: 'Pinsir-Mega',
  gyaradosite: 'Gyarados-Mega',
  aerodactylite: 'Aerodactyl-Mega',
  mewtwonitex: 'Mewtwo-Mega-X',
  mewtwonitey: 'Mewtwo-Mega-Y',
  ampharosite: 'Ampharos-Mega',
  scizorite: 'Scizor-Mega',
  heracronite: 'Heracross-Mega',
  houndoominite: 'Houndoom-Mega',
  tyranitarite: 'Tyranitar-Mega',
  sceptilite: 'Sceptile-Mega',
  blazikenite: 'Blaziken-Mega',
  swampertite: 'Swampert-Mega',
  gardevoirite: 'Gardevoir-Mega',
  sablenite: 'Sableye-Mega',
  mawilite: 'Mawile-Mega',
  aggronite: 'Aggron-Mega',
  medichamite: 'Medicham-Mega',
  manectite: 'Manectric-Mega',
  sharpedonite: 'Sharpedo-Mega',
  cameruptite: 'Camerupt-Mega',
  altarianite: 'Altaria-Mega',
  banettite: 'Banette-Mega',
  absolite: 'Absol-Mega',
  glalitite: 'Glalie-Mega',
  salamencite: 'Salamence-Mega',
  metagrossite: 'Metagross-Mega',
  latiasite: 'Latias-Mega',
  latiosite: 'Latios-Mega',
  garchompite: 'Garchomp-Mega',
  lucarionite: 'Lucario-Mega',
  abomasite: 'Abomasnow-Mega',
  galladite: 'Gallade-Mega',
  audinite: 'Audino-Mega',
  diancite: 'Diancie-Mega',
  lopunnite: 'Lopunny-Mega',
  steelixite: 'Steelix-Mega',
};


const SPECIAL_STAB_BY_TYPE: Record<string, string> = {
  fire: 'Heat Wave',
  water: 'Muddy Water',
  grass: 'Giga Drain',
  electric: 'Thunderbolt',
  psychic: 'Psychic',
  fairy: 'Dazzling Gleam',
  ghost: 'Shadow Ball',
  dragon: 'Draco Meteor',
  poison: 'Sludge Bomb',
  ground: 'Earth Power',
  rock: 'Power Gem',
  ice: 'Ice Beam',
  steel: 'Flash Cannon',
  dark: 'Dark Pulse',
  bug: 'Bug Buzz',
  flying: 'Air Slash',
  normal: 'Hyper Voice',
};

const PHYSICAL_STAB_BY_TYPE: Record<string, string> = {
  fire: 'Flare Blitz',
  water: 'Liquidation',
  grass: 'Seed Bomb',
  electric: 'Wild Charge',
  psychic: 'Zen Headbutt',
  fairy: 'Play Rough',
  ghost: 'Shadow Sneak',
  dragon: 'Dragon Claw',
  poison: 'Poison Jab',
  ground: 'High Horsepower',
  rock: 'Rock Slide',
  ice: 'Ice Spinner',
  steel: 'Iron Head',
  dark: 'Knock Off',
  bug: 'Leech Life',
  flying: 'Brave Bird',
  normal: 'Double-Edge',
};


const GENERIC_PHYSICAL_COVERAGE = ['Rock Slide', 'High Horsepower', 'Knock Off', 'Ice Spinner'];
const GENERIC_SPECIAL_COVERAGE = ['Earth Power', 'Ice Beam', 'Thunderbolt', 'Dazzling Gleam'];
const LOW_VALUE_GENERIC_MOVES = new Set(['Double-Edge', 'Hyper Voice', 'Substitute', 'Tera Blast']);

function getDexSpeciesData(pokemonName: string) {
  const species = Dex.species.get(pokemonName);
  if (species.exists) return species;

  const baseName = getMegaBaseName(pokemonName);
  const baseSpecies = Dex.species.get(baseName);
  return baseSpecies.exists ? baseSpecies : species;
}

function getSpeciesTypesForSet(pokemonName: string): string[] {
  const species = getDexSpeciesData(pokemonName);
  return species.exists ? species.types.map((type: string) => normalize(type)) : [];
}

function getSpeciesStatsForSet(pokemonName: string) {
  const species = getDexSpeciesData(pokemonName);
  return species.exists ? species.baseStats : undefined;
}

function hasNormalVoiceConversion(pokemon: PokemonData): boolean {
  const abilities = Object.values(pokemon.abilities ?? {}).map(String).map(normalize);
  if (pokemon.ability) abilities.push(normalize(pokemon.ability));
  return abilities.some(ability => ['aerilate', 'pixilate', 'refrigerate', 'galvanize', 'liquidvoice'].includes(ability));
}

function isLikelyGenericFallbackMove(move: string, pokemon: PokemonData, types: string[]): boolean {
  const normalizedMove = normalize(move);
  if (!['doubleedge', 'hypervoice', 'terablast', 'substitute'].includes(normalizedMove)) return false;
  if (normalizedMove === 'doubleedge' || normalizedMove === 'hypervoice') {
    return !types.includes('normal') && !hasNormalVoiceConversion(pokemon);
  }
  return true;
}

function shouldReplaceGenericFallbackSet(pokemon: PokemonData, format: string): boolean {
  const moves = pokemon.moves ?? [];
  if (moves.length < 4) return true;

  const types = getPokemonTypesFromDexOrVariant(pokemon, format).map(normalize);
  const stats = getVariant(pokemon, format)?.baseStats ?? getSpeciesStatsForSet(pokemon.name);
  const atk = Number(stats?.atk ?? 0);
  const spa = Number(stats?.spa ?? 0);
  const physicalBias = atk >= spa + 15;
  const specialBias = spa >= atk + 15;

  let genericFallbackCount = 0;
  let offBiasDamageCount = 0;
  let usefulDamageCount = 0;

  for (const moveName of moves) {
    if (isLikelyGenericFallbackMove(moveName, pokemon, types)) genericFallbackCount++;

    const move = Dex.moves.get(moveName);
    if (!move.exists || move.category === 'Status' || Number(move.basePower ?? 0) <= 0) continue;

    const moveType = normalize(String(move.type ?? ''));
    const isStab = types.includes(moveType);
    const isPhysical = move.category === 'Physical';
    const isSpecial = move.category === 'Special';

    if (isStab || (physicalBias && isPhysical) || (specialBias && isSpecial) || (!physicalBias && !specialBias)) {
      usefulDamageCount++;
    }

    if ((physicalBias && isSpecial && !isStab) || (specialBias && isPhysical && !isStab)) {
      offBiasDamageCount++;
    }
  }

  return genericFallbackCount > 0 || offBiasDamageCount >= 2 || usefulDamageCount === 0;
}

function getPokemonTypesFromDexOrVariant(pokemon: PokemonData, format: string): string[] {
  const variantTypes = getVariant(pokemon, format)?.types;
  if (variantTypes?.length) return variantTypes;
  return getSpeciesTypesForSet(pokemon.name);
}

function synthesizeGenericVgcSet(pokemon: PokemonData, format: string): CuratedVgcSet | undefined {
  const types = getPokemonTypesFromDexOrVariant(pokemon, format).map(normalize);
  const stats = getVariant(pokemon, format)?.baseStats ?? getSpeciesStatsForSet(pokemon.name);
  if (!stats || types.length === 0) return undefined;

  const atk = Number(stats.atk ?? 0);
  const spa = Number(stats.spa ?? 0);
  const spe = Number(stats.spe ?? 0);
  const physicalBias = atk >= spa;
  const stabMap = physicalBias ? PHYSICAL_STAB_BY_TYPE : SPECIAL_STAB_BY_TYPE;
  const coverage = physicalBias ? GENERIC_PHYSICAL_COVERAGE : GENERIC_SPECIAL_COVERAGE;
  const stabMoves = types.map((type: string) => stabMap[type]).filter(Boolean) as string[];
  const moves = sanitizeMoves([...stabMoves.slice(0, 2), 'Protect', ...coverage], pokemon);

  return {
    ability: pokemon.ability || 'Nenhum',
    item: spe <= 60 ? (physicalBias ? 'Clear Amulet' : 'Life Orb') : 'Life Orb',
    nature: spe <= 60 ? (physicalBias ? 'Brave' : 'Quiet') : (physicalBias ? 'Adamant' : 'Modest'),
    role: spe <= 60
      ? (physicalBias ? 'Slow Physical Damage / Trick Room-Compatible' : 'Slow Special Damage / Trick Room-Compatible')
      : (physicalBias ? 'Physical Damage' : 'Special Damage'),
    moves,
  };
}


function physicalBiasItem(types: string[]): string {
  if (types.includes('water')) return 'Mystic Water';
  if (types.includes('rock') || types.includes('ground') || types.includes('steel')) return 'Clear Amulet';
  return 'Life Orb';
}

function synthesizeMechanicFallbackSet(pokemonName: string): CuratedVgcSet | undefined {
  const profile = getVgcMechanicProfile(pokemonName);
  if (!profile) return undefined;

  const tags = profile.tags;
  const hasTag = (mechanic: string, role?: string): boolean =>
    tags.some(tag => tag.mechanic === mechanic && (!role || tag.role === role) && tag.confidence >= 0.6);

  if (hasTag('trick_room', 'setter')) {
    return {
      ability: 'Frisk',
      item: 'Mental Herb',
      nature: 'Sassy',
      role: 'Trick Room Setter / Utility Support',
      moves: ['Trick Room', 'Will-O-Wisp', 'Night Shade', 'Protect'],
    };
  }

  if (hasTag('redirection', 'support')) {
    return {
      ability: 'Regenerator',
      item: 'Safety Goggles',
      nature: 'Relaxed',
      role: 'Redirection / Defensive Support',
      moves: ['Rage Powder', 'Helping Hand', 'Pollen Puff', 'Protect'],
    };
  }

  if (hasTag('tailwind', 'setter')) {
    return {
      ability: 'Prankster',
      item: 'Mental Herb',
      nature: 'Timid',
      role: 'Tailwind Setter / Speed Control',
      moves: ['Tailwind', 'Taunt', 'Helping Hand', 'Protect'],
    };
  }

  if (hasTag('trick_room', 'abuser')) {
    const species = Dex.species.get(pokemonName);
    const types = species.exists ? species.types.map((type: string) => normalize(type)) : [];
    const stats = species.exists ? species.baseStats : undefined;
    const specialBias = Number(stats?.spa ?? 0) >= Number(stats?.atk ?? 0);
    const stabMap = specialBias ? SPECIAL_STAB_BY_TYPE : PHYSICAL_STAB_BY_TYPE;
    const stabMoves = types.map((type: string) => stabMap[type]).filter(Boolean) as string[];
    const moves = [...new Set([...stabMoves, specialBias ? 'Earth Power' : 'Rock Slide', 'Protect'])].slice(0, 4);

    return {
      ability: 'Regenerator',
      item: specialBias ? 'Life Orb' : 'Clear Amulet',
      nature: specialBias ? 'Quiet' : 'Brave',
      role: specialBias ? 'Trick Room Special Damage' : 'Trick Room Physical Damage',
      moves: sanitizeMoves(moves, { name: pokemonName } as PokemonData, { includeCuratedMoves: false }),
    };
  }

  if (hasTag('weather', 'abuser')) {
    const weatherTag = tags.find(tag => tag.mechanic === 'weather' && tag.role === 'abuser' && tag.confidence >= 0.6);
    const weather = weatherTag?.mechanic === 'weather' ? weatherTag.weather : undefined;
    const species = Dex.species.get(pokemonName);
    const types = species.exists ? species.types.map((type: string) => normalize(type)) : [];
    const stats = species.exists ? species.baseStats : undefined;
    const specialBias = Number(stats?.spa ?? 0) >= Number(stats?.atk ?? 0);
    const stabMap = specialBias ? SPECIAL_STAB_BY_TYPE : PHYSICAL_STAB_BY_TYPE;
    const stabMoves = types.map((type: string) => stabMap[type]).filter(Boolean) as string[];
    const weatherAbilityByFamily: Record<string, string> = {
      sun: 'Chlorophyll',
      rain: 'Swift Swim',
      sand: 'Sand Rush',
      snow: 'Slush Rush',
    };
    const weatherRoleByFamily: Record<string, string> = {
      sun: 'Sun Abuser / Damage Pressure',
      rain: 'Rain Abuser / Damage Pressure',
      sand: 'Sand Abuser / Damage Pressure',
      snow: 'Snow Abuser / Damage Pressure',
    };
    const weatherItemByFamily: Record<string, string> = {
      sun: 'Life Orb',
      rain: specialBias ? 'Expert Belt' : 'Mystic Water',
      sand: physicalBiasItem(types),
      snow: 'Clear Amulet',
    };
    const weatherCoverageByFamily: Record<string, string[]> = {
      sun: specialBias ? ['Weather Ball', 'Earth Power'] : ['Solar Blade', 'Knock Off'],
      rain: specialBias ? ['Hurricane', 'Ice Beam'] : ['Liquidation', 'Aqua Jet'],
      sand: ['Rock Slide', 'High Horsepower'],
      snow: ['Blizzard', 'Ice Spinner'],
    };
    const family = weather ?? 'rain';

    return {
      ability: weatherAbilityByFamily[family] ?? 'Swift Swim',
      item: weatherItemByFamily[family] ?? 'Life Orb',
      nature: specialBias ? 'Modest' : 'Adamant',
      role: weatherRoleByFamily[family] ?? 'Weather Abuser / Damage Pressure',
      moves: sanitizeMoves([...stabMoves, ...(weatherCoverageByFamily[family] ?? []), 'Protect'], { name: pokemonName } as PokemonData, { includeCuratedMoves: false }),
    };
  }

  return undefined;
}

const CURATED_VGC_SETS: Record<string, CuratedVgcSet> = {
  charizardmegay: {
    ability: 'Drought',
    item: 'Charizardite Y',
    nature: 'Timid',
    role: 'Sun Setter / Spread Special Damage',
    moves: ['Heat Wave', 'Overheat', 'Solar Beam', 'Protect'],
  },
  venusaur: {
    ability: 'Chlorophyll',
    item: 'Focus Sash',
    nature: 'Timid',
    role: 'Sun Abuser / Sleep Pressure',
    moves: ['Energy Ball', 'Sludge Bomb', 'Sleep Powder', 'Protect'],
  },
  whimsicott: {
    ability: 'Prankster',
    item: 'Mental Herb',
    nature: 'Timid',
    role: 'Prankster Speed Control / Anti Weather',
    moves: ['Moonblast', 'Tailwind', 'Sunny Day', 'Encore'],
  },
  incineroar: {
    ability: 'Intimidate',
    item: 'Sitrus Berry',
    nature: 'Careful',
    role: 'Fake Out Pivot / Defensive Glue',
    moves: ['Flare Blitz', 'Fake Out', 'Taunt', 'Parting Shot'],
  },
  maushold: {
    ability: 'Friend Guard',
    item: 'Safety Goggles',
    nature: 'Jolly',
    role: 'Redirection / Friend Guard Support',
    moves: ['Super Fang', 'Follow Me', 'Taunt', 'Protect'],
  },
  garchomp: {
    ability: 'Rough Skin',
    item: 'Clear Amulet',
    nature: 'Jolly',
    role: 'Physical Damage / Ground Pressure',
    moves: ['Stomping Tantrum', 'Dragon Claw', 'Rock Slide', 'Protect'],
  },
  kingambit: {
    ability: 'Supreme Overlord',
    item: 'Black Glasses',
    nature: 'Adamant',
    role: 'Late Game Cleaner / Priority',
    moves: ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Protect'],
  },
  fluttermane: {
    ability: 'Protosynthesis',
    item: 'Booster Energy',
    nature: 'Timid',
    role: 'Special Damage / Speed Control',
    moves: ['Moonblast', 'Shadow Ball', 'Dazzling Gleam', 'Protect'],
  },
  tapukoko: {
    ability: 'Electric Surge',
    item: 'Life Orb',
    nature: 'Timid',
    role: 'Electric Terrain Pressure / Fast Special Damage',
    moves: ['Thunderbolt', 'Dazzling Gleam', 'Volt Switch', 'Protect'],
  },
  salamence: {
    ability: 'Intimidate',
    item: 'Safety Goggles',
    nature: 'Jolly',
    role: 'Intimidate Speed Control',
    moves: ['Dragon Claw', 'Rock Slide', 'Tailwind', 'Protect'],
  },
  salamencemega: {
    ability: 'Aerilate',
    item: 'Salamencite',
    nature: 'Jolly',
    role: 'Mega Physical Damage / Tailwind',
    moves: ['Double-Edge', 'Tailwind', 'Hyper Voice', 'Protect'],
  },


  pelipper: {
    ability: 'Drizzle',
    item: 'Focus Sash',
    nature: 'Timid',
    role: 'Rain Setter / Tailwind / Wide Guard Support',
    moves: ['Hurricane', 'Weather Ball', 'Tailwind', 'Wide Guard'],
  },
  politoed: {
    ability: 'Drizzle',
    item: 'Sitrus Berry',
    nature: 'Calm',
    role: 'Rain Setter / Utility',
    moves: ['Muddy Water', 'Helping Hand', 'Encore', 'Protect'],
  },
  omastar: {
    ability: 'Swift Swim',
    item: 'Expert Belt',
    nature: 'Modest',
    role: 'Rain Special Damage / Rock Coverage',
    moves: ['Power Gem', 'Muddy Water', 'Earth Power', 'Protect'],
  },
  blastoise: {
    ability: 'Rain Dish',
    item: 'Wacan Berry',
    nature: 'Calm',
    role: 'Rain Utility / Speed Control',
    moves: ['Muddy Water', 'Icy Wind', 'Aura Sphere', 'Protect'],
  },
  swampertmega: {
    ability: 'Swift Swim',
    item: 'Swampertite',
    nature: 'Adamant',
    role: 'Mega Rain Physical Damage',
    moves: ['Liquidation', 'High Horsepower', 'Rock Slide', 'Protect'],
  },
  swampert: {
    ability: 'Swift Swim',
    item: 'Swampertite',
    nature: 'Adamant',
    role: 'Mega Rain Physical Damage',
    moves: ['Liquidation', 'High Horsepower', 'Rock Slide', 'Protect'],
  },
  sableye: {
    ability: 'Prankster',
    item: 'Mental Herb',
    nature: 'Careful',
    role: 'Prankster Disruption / Turn Control',
    moves: ['Fake Out', 'Will-O-Wisp', 'Taunt', 'Protect'],
  },
  barraskewda: {
    ability: 'Swift Swim',
    item: 'Mystic Water',
    nature: 'Adamant',
    role: 'Fast Rain Physical Damage',
    moves: ['Liquidation', 'Close Combat', 'Aqua Jet', 'Protect'],
  },
  ludicolo: {
    ability: 'Swift Swim',
    item: 'Expert Belt',
    nature: 'Modest',
    role: 'Rain Special Damage / Grass Coverage',
    moves: ['Muddy Water', 'Energy Ball', 'Ice Beam', 'Protect'],
  },
  kingdra: {
    ability: 'Swift Swim',
    item: 'Scope Lens',
    nature: 'Modest',
    role: 'Rain Special Damage / Dragon Coverage',
    moves: ['Muddy Water', 'Draco Meteor', 'Hurricane', 'Protect'],
  },
  basculegion: {
    ability: 'Swift Swim',
    item: 'Spell Tag',
    nature: 'Adamant',
    role: 'Rain Physical Cleaner / Priority',
    moves: ['Wave Crash', 'Last Respects', 'Aqua Jet', 'Protect'],
  },
  drednaw: {
    ability: 'Swift Swim',
    item: 'Clear Amulet',
    nature: 'Adamant',
    role: 'Rain Physical Damage / Rock Pressure',
    moves: ['Liquidation', 'Rock Slide', 'High Horsepower', 'Protect'],
  },
  palafin: {
    ability: 'Zero to Hero',
    item: 'Mystic Water',
    nature: 'Adamant',
    role: 'Rain-Compatible Physical Cleaner',
    moves: ['Wave Crash', 'Jet Punch', 'Close Combat', 'Protect'],
  },
  tornadus: {
    ability: 'Prankster',
    item: 'Covert Cloak',
    nature: 'Timid',
    role: 'Prankster Tailwind / Rain Support',
    moves: ['Bleakwind Storm', 'Tailwind', 'Rain Dance', 'Protect'],
  },

  tangrowth: {
    ability: 'Chlorophyll',
    item: 'Rocky Helmet',
    nature: 'Bold',
    role: 'Bulky Sun Abuser / Sleep Pressure',
    moves: ['Giga Drain', 'Sleep Powder', 'Leech Seed', 'Protect'],
  },
  exeggutor: {
    ability: 'Chlorophyll',
    item: 'Life Orb',
    nature: 'Modest',
    role: 'Sun Abuser / Special Damage',
    moves: ['Leaf Storm', 'Psychic', 'Sleep Powder', 'Protect'],
  },
  exeggutoralola: {
    ability: 'Chlorophyll',
    item: 'Life Orb',
    nature: 'Modest',
    role: 'Sun Abuser / Special Damage',
    moves: ['Leaf Storm', 'Draco Meteor', 'Sleep Powder', 'Protect'],
  },
  leafeon: {
    ability: 'Chlorophyll',
    item: 'Life Orb',
    nature: 'Jolly',
    role: 'Physical Sun Abuser',
    moves: ['Leaf Blade', 'Solar Blade', 'Knock Off', 'Protect'],
  },
  nihilego: {
    ability: 'Beast Boost',
    item: 'Life Orb',
    nature: 'Timid',
    role: 'Fast Special Damage / Anti Fire',
    moves: ['Power Gem', 'Sludge Bomb', 'Dazzling Gleam', 'Protect'],
  },
  tentacruel: {
    ability: 'Clear Body',
    item: 'Black Sludge',
    nature: 'Timid',
    role: 'Creative Utility / Speed Control',
    moves: ['Muddy Water', 'Sludge Bomb', 'Icy Wind', 'Protect'],
  },
  ironboulder: {
    ability: 'Quark Drive',
    item: 'Life Orb',
    nature: 'Jolly',
    role: 'Fast Physical Damage / Anti Fire',
    moves: ['Rock Slide', 'Mighty Cleave', 'Zen Headbutt', 'Protect'],
  },
  screamtail: {
    ability: 'Protosynthesis',
    item: 'Booster Energy',
    nature: 'Timid',
    role: 'Support / Anti Trick Room',
    moves: ['Dazzling Gleam', 'Encore', 'Disable', 'Protect'],
  },
  slitherwing: {
    ability: 'Protosynthesis',
    item: 'Assault Vest',
    nature: 'Adamant',
    role: 'Bulky Physical Damage / Priority',
    moves: ['First Impression', 'Close Combat', 'Leech Life', 'Flare Blitz'],
  },
  gougingfire: {
    ability: 'Protosynthesis',
    item: 'Clear Amulet',
    nature: 'Adamant',
    role: 'Bulky Physical Damage',
    moves: ['Heat Crash', 'Breaking Swipe', 'Burning Bulwark', 'Protect'],
  },
  walkingwake: {
    ability: 'Protosynthesis',
    item: 'Life Orb',
    nature: 'Timid',
    role: 'Sun-Compatible Special Damage',
    moves: ['Hydro Steam', 'Draco Meteor', 'Flamethrower', 'Protect'],
  },
  ragingbolt: {
    ability: 'Protosynthesis',
    item: 'Booster Energy',
    nature: 'Modest',
    role: 'Bulky Special Damage / Priority',
    moves: ['Thunderclap', 'Thunderbolt', 'Draco Meteor', 'Protect'],
  },
  sandyshocks: {
    ability: 'Protosynthesis',
    item: 'Booster Energy',
    nature: 'Timid',
    role: 'Fast Special Damage',
    moves: ['Thunderbolt', 'Earth Power', 'Volt Switch', 'Protect'],
  },
  farigiraf: {
    ability: 'Armor Tail',
    item: 'Safety Goggles',
    nature: 'Sassy',
    role: 'Trick Room Setter / Anti Priority Support',
    moves: ['Trick Room', 'Psychic', 'Hyper Voice', 'Protect'],
  },
  mawilemega: {
    ability: 'Huge Power',
    item: 'Mawilite',
    nature: 'Brave',
    role: 'Mega Trick Room Physical Damage / Priority',
    moves: ['Play Rough', 'Iron Head', 'Sucker Punch', 'Protect'],
  },
  mawile: {
    ability: 'Intimidate',
    item: 'Mawilite',
    nature: 'Brave',
    role: 'Mega Trick Room Physical Damage / Priority',
    moves: ['Play Rough', 'Iron Head', 'Sucker Punch', 'Protect'],
  },
  torkoal: {
    ability: 'Drought',
    item: 'Charcoal',
    nature: 'Quiet',
    role: 'Trick Room Sun Abuser / Spread Special Damage',
    moves: ['Eruption', 'Heat Wave', 'Earth Power', 'Protect'],
  },
  indeedeef: {
    ability: 'Psychic Surge',
    item: 'Psychic Seed',
    nature: 'Sassy',
    role: 'Redirection / Trick Room Support / Terrain Setter',
    moves: ['Follow Me', 'Helping Hand', 'Trick Room', 'Protect'],
  },
  indeedee: {
    ability: 'Psychic Surge',
    item: 'Psychic Seed',
    nature: 'Sassy',
    role: 'Redirection / Trick Room Support / Terrain Setter',
    moves: ['Follow Me', 'Helping Hand', 'Trick Room', 'Protect'],
  },
  amoonguss: {
    ability: 'Regenerator',
    item: 'Rocky Helmet',
    nature: 'Relaxed',
    role: 'Redirection / Sleep Pressure / Trick Room Support',
    moves: ['Spore', 'Rage Powder', 'Pollen Puff', 'Protect'],
  },
  porygon2: {
    ability: 'Download',
    item: 'Eviolite',
    nature: 'Sassy',
    role: 'Trick Room Setter / Defensive Glue',
    moves: ['Trick Room', 'Recover', 'Ice Beam', 'Thunderbolt'],
  },
  cresselia: {
    ability: 'Levitate',
    item: 'Mental Herb',
    nature: 'Sassy',
    role: 'Trick Room Setter / Helping Hand Support',
    moves: ['Trick Room', 'Helping Hand', 'Ice Beam', 'Protect'],
  },
  ursaluna: {
    ability: 'Guts',
    item: 'Flame Orb',
    nature: 'Brave',
    role: 'Trick Room Physical Damage',
    moves: ['Facade', 'Headlong Rush', 'Earthquake', 'Protect'],
  },
  ursalunabloodmoon: {
    ability: "Mind's Eye",
    item: 'Life Orb',
    nature: 'Quiet',
    role: 'Trick Room Special Damage',
    moves: ['Blood Moon', 'Hyper Voice', 'Earth Power', 'Protect'],
  },
  ironhands: {
    ability: 'Quark Drive',
    item: 'Assault Vest',
    nature: 'Brave',
    role: 'Bulky Trick Room Physical Damage / Fake Out',
    moves: ['Fake Out', 'Drain Punch', 'Wild Charge', 'Heavy Slam'],
  },
  aggronmega: {
    ability: 'Filter',
    item: 'Aggronite',
    nature: 'Adamant',
    role: 'Mega Physical Def sweeper / Trick Room Win Condition',
    moves: ['Heavy Slam', 'High Horsepower', 'Body Press', 'Protect'],
  },
  sinistcha: {
    ability: 'Hospitality',
    item: 'Rocky Helmet',
    nature: 'Bold',
    role: 'Hospitality Support / TR Setter-Reverser',
    moves: ['Matcha Gotcha', 'Rage Powder', 'Trick Room', 'Protect'],
  },
  overqwil: {
    ability: 'Swift Swim',
    item: 'Life Orb',
    nature: 'Adamant',
    role: 'Swift Swim Rain Sweeper',
    moves: ['Liquidation', 'Poison Jab', 'Knock Off', 'Protect'],
  },
  relicanth: {
    ability: 'Swift Swim',
    item: 'Clear Amulet',
    nature: 'Adamant',
    role: 'Rain Physical Sweeper',
    moves: ['Wave Crash', 'Head Smash', 'High Horsepower', 'Protect'],
  },
  togekiss: {
    ability: 'Super Luck',
    item: 'Safety Goggles',
    nature: 'Bold',
    role: 'Redirection / Helping Hand Support',
    moves: ['Follow Me', 'Helping Hand', 'Dazzling Gleam', 'Protect'],
  },
};

export function isMegaStone(item?: string | null): boolean {
  return Boolean(MEGA_STONE_TO_SPECIES[normalize(item ?? '')]);
}

export function getMegaSpeciesFromStone(item?: string | null): string | null {
  return MEGA_STONE_TO_SPECIES[normalize(item ?? '')] ?? null;
}

export function isMegaOption(pokemon: PokemonData): boolean {
  return Boolean(getMegaStone(pokemon.name)) || isMegaStone(pokemon.item);
}

export function materializeMegaFormFromHeldItem(pokemon: PokemonData): PokemonData {
  const megaSpecies = getMegaSpeciesFromStone(pokemon.item);
  if (!megaSpecies) return pokemon;
  if (normalize(pokemon.name) === normalize(megaSpecies)) return pokemon;

  return {
    ...pokemon,
    name: megaSpecies,
  };
}


const ITEM_ALTERNATIVES_BY_FAMILY: Record<string, string[]> = {
  sitrusberry: ['Wiki Berry', 'Aguav Berry', 'Iapapa Berry', 'Figy Berry', 'Wacan Berry', 'Rindo Berry', 'Covert Cloak', 'Safety Goggles', 'Leftovers'],
  choicespecs: ['Expert Belt', 'Wise Glasses', 'Mystic Water', 'Life Orb', 'Scope Lens'],
  choiceband: ['Muscle Band', 'Mystic Water', 'Clear Amulet', 'Life Orb', 'Scope Lens'],
  choicescarf: ['Covert Cloak', 'Focus Sash', 'Expert Belt', 'Clear Amulet', 'Life Orb'],
  lifeorb: ['Expert Belt', 'Wise Glasses', 'Muscle Band', 'Mystic Water', 'Clear Amulet', 'Scope Lens'],
  focussash: ['Mental Herb', 'Covert Cloak', 'Safety Goggles', 'Expert Belt'],
  safetygoggles: ['Covert Cloak', 'Mental Herb', 'Sitrus Berry', 'Wiki Berry'],
  rockyhelmet: ['Leftovers', 'Sitrus Berry', 'Covert Cloak', 'Safety Goggles'],
  leftovers: ['Sitrus Berry', 'Wiki Berry', 'Aguav Berry', 'Covert Cloak'],
  boosterenergy: ['Life Orb', 'Expert Belt', 'Wise Glasses', 'Clear Amulet'],
  clearamulet: ['Life Orb', 'Expert Belt', 'Muscle Band', 'Mystic Water'],
  assaultvest: ['Clear Amulet', 'Covert Cloak', 'Sitrus Berry', 'Mystic Water'],
  mentalherb: ['Covert Cloak', 'Safety Goggles', 'Sitrus Berry'],
  covertcloak: ['Safety Goggles', 'Mental Herb', 'Sitrus Berry'],
};

const GENERIC_ITEM_FALLBACKS = [
  'Covert Cloak',
  'Safety Goggles',
  'Clear Amulet',
  'Expert Belt',
  'Mystic Water',
  'Wise Glasses',
  'Muscle Band',
  'Scope Lens',
  'Leftovers',
  'Wiki Berry',
  'Aguav Berry',
  'Iapapa Berry',
  'Figy Berry',
  'Wacan Berry',
  'Rindo Berry',
  'Mental Herb',
  'Rocky Helmet',
  'Life Orb',
  'Focus Sash',
  'Sitrus Berry',
];

function hasStatusMoveOutsideProtect(pokemon: PokemonData): boolean {
  return (pokemon.moves ?? []).some(moveName => {
    const move = Dex.moves.get(moveName);
    return move.exists && move.category === 'Status' && normalize(move.name) !== 'protect';
  });
}

function isChoiceItem(item: string): boolean {
  return ['choiceband', 'choicespecs', 'choicescarf'].includes(normalize(item));
}

function isAssaultVestBadFit(pokemon: PokemonData, item: string): boolean {
  return normalize(item) === 'assaultvest' && hasStatusMoveOutsideProtect(pokemon);
}

function canUseReplacementItem(pokemon: PokemonData, item: string, used: Set<string>): boolean {
  const key = normalize(item);
  if (!item || used.has(key) || isMegaStone(item)) return false;
  if (isChoiceItem(item) && (pokemon.moves ?? []).some(move => normalize(move) === 'protect')) return false;
  if (isAssaultVestBadFit(pokemon, item)) return false;
  return true;
}

function chooseReplacementItem(pokemon: PokemonData, used: Set<string>): string | undefined {
  const currentKey = normalize(pokemon.item ?? '');
  const specific = ITEM_ALTERNATIVES_BY_FAMILY[currentKey] ?? [];
  const pool = [...specific, ...GENERIC_ITEM_FALLBACKS];
  return pool.find(item => canUseReplacementItem(pokemon, item, used));
}

export function enforceUniqueVgcHeldItems(team: PokemonData[], format: string): PokemonData[] {
  const used = new Set<string>();

  return team.map(member => {
    const megaStone = getMegaStone(member.name);
    const currentItem = megaStone ?? member.item;
    const currentKey = normalize(currentItem ?? '');

    if (!currentItem || !currentKey) return member;

    if (!used.has(currentKey)) {
      used.add(currentKey);
      return megaStone && member.item !== megaStone ? { ...member, item: megaStone } : member;
    }

    if (isMegaStone(currentItem)) {
      return member;
    }

    const replacement = chooseReplacementItem(member, used);
    if (!replacement) return member;

    used.add(normalize(replacement));
    return {
      ...member,
      item: replacement,
    };
  });
}

export function getCuratedVgcSet(pokemonName: string): CuratedVgcSet | undefined {
  return getStaticCuratedVgcSet(pokemonName) ?? synthesizeMechanicFallbackSet(pokemonName);
}


const MANUAL_WEATHER_MOVE_BY_PLAN: Record<NonNullable<VgcSetPlanContext['primaryWeather']>, string> = {
  rain: 'Rain Dance',
  sun: 'Sunny Day',
  sand: 'Sandstorm',
  snow: 'Snowscape',
};

function hasLegalOrKnownAbilityForSet(pokemon: PokemonData, format: string, abilityName: string): boolean {
  return getLegalAbilities(pokemon, format).some(ability => normalize(ability) === normalize(abilityName)) ||
    normalize(pokemon.ability) === normalize(abilityName);
}

function isLowSpeedPranksterSupportForSet(pokemon: PokemonData, format: string): boolean {
  if (!hasLegalOrKnownAbilityForSet(pokemon, format, 'Prankster')) return false;
  const stats = getVariant(pokemon, format)?.baseStats ?? getSpeciesStatsForSet(pokemon.name);
  const speed = Number(stats?.spe ?? 80);
  const offense = Math.max(Number(stats?.atk ?? 80), Number(stats?.spa ?? 80));
  const roleText = `${pokemon.role ?? ''} ${(pokemon.competitive?.roles ?? []).join(' ')} ${(pokemon.competitive?.teamStyles ?? []).join(' ')}`;
  const moves = (pokemon.moves ?? []).map(normalize);

  return speed <= 85 &&
    offense <= 95 &&
    (/support|disruption|turn control|screens|utility|prankster/i.test(roleText) ||
      moves.some(move => ['taunt', 'encore', 'willowisp', 'quash', 'reflect', 'lightscreen'].includes(move)));
}

function isAutomaticWeatherSetterForSet(pokemon: PokemonData): boolean {
  return ['drizzle', 'drought', 'sandstream', 'snowwarning', 'primordialsea', 'desolateland'].includes(normalize(pokemon.ability));
}

function isPrimaryWeatherAbuserForSet(pokemon: PokemonData): boolean {
  return ['swiftswim', 'chlorophyll', 'sandrush', 'slushrush', 'solarpower', 'sandforce'].includes(normalize(pokemon.ability));
}


function hasProtectMoveForSet(pokemon: PokemonData): boolean {
  return (pokemon.moves ?? []).some(move => normalize(move) === 'protect');
}

function sanitizeVgcHeldItemForSet(pokemon: PokemonData): PokemonData {
  if (!pokemon.item) return pokemon;
  const currentKey = normalize(pokemon.item);
  const invalidChoice = isChoiceItem(pokemon.item) && hasProtectMoveForSet(pokemon);
  const invalidAssaultVest = isAssaultVestBadFit(pokemon, pokemon.item);

  if (!invalidChoice && !invalidAssaultVest) return pokemon;

  const replacement = chooseReplacementItem(pokemon, new Set<string>());
  if (!replacement) return pokemon;

  return {
    ...pokemon,
    item: replacement,
  };
}

function applyVgcFormatPlanSetOverrides(
  pokemon: PokemonData,
  format: string,
  plan?: VgcSetPlanContext,
): PokemonData {
  const weather = plan?.primaryWeather;
  if (!weather) return pokemon;

  const weatherMove = MANUAL_WEATHER_MOVE_BY_PLAN[weather];
  if (!weatherMove) return pokemon;

  // Generic rule: low-speed Prankster utility Pokémon can become manual weather
  // support for the detected weather archetype. This is not a Sableye exception:
  // it covers the same class of Pokémon that can preserve weather after the
  // automatic setter is removed or when the core relies on a weather-speed abuser.
  if (
    isLowSpeedPranksterSupportForSet(pokemon, format) &&
    !isAutomaticWeatherSetterForSet(pokemon) &&
    !isPrimaryWeatherAbuserForSet(pokemon)
  ) {
    const role = `${weather.toUpperCase()} Manual Weather / Screens / Prankster Control`;
    return {
      ...pokemon,
      ability: resolveLegalAbility(pokemon, format, 'Prankster'),
      item: isMegaStone(pokemon.item) ? pokemon.item : 'Light Clay',
      nature: pokemon.nature && !/sassy|relaxed/i.test(pokemon.nature) ? pokemon.nature : 'Calm',
      role,
      moves: sanitizeMoves(['Reflect', 'Light Screen', weatherMove, 'Quash'], pokemon, { includeCuratedMoves: false }),
    };
  }

  return pokemon;
}

export function optimizeVgcSet(
  pokemon: PokemonData,
  format: string,
  options: VgcSetOptimizationOptions = {},
): PokemonData {
  const directMegaStone = getMegaStone(pokemon.name);
  const withRequiredMegaStone: PokemonData = {
    ...pokemon,
    item: directMegaStone ?? pokemon.item,
  };
  const base = materializeMegaFormFromHeldItem(withRequiredMegaStone);
  const curated = getCuratedVgcSet(base.name) ?? getCuratedVgcSet(pokemon.name);
  const shouldPreferCurated = options.preferCurated ?? true;

  const megaStone = getMegaStone(base.name);

  if (curated && shouldPreferCurated) {
    const curatedBase = materializeMegaFormFromHeldItem({
      ...base,
      item: megaStone ?? curated.item,
    });
    const curatedMegaStone = getMegaStone(curatedBase.name);

    return sanitizeVgcHeldItemForSet(applyVgcFormatPlanSetOverrides({
      ...curatedBase,
      ability: resolveLegalAbility(curatedBase, format, curated.ability),
      item: curatedMegaStone ?? curated.item,
      moves: sanitizeMoves(curated.moves, curatedBase),
      nature: curated.nature,
      role: curated.role,
    }, format, options.formatPlan));
  }

  const synthesized = shouldReplaceGenericFallbackSet(base, format)
    ? synthesizeGenericVgcSet(base, format)
    : undefined;

  if (synthesized && shouldPreferCurated) {
    return sanitizeVgcHeldItemForSet(applyVgcFormatPlanSetOverrides({
      ...base,
      ability: resolveLegalAbility(base, format, synthesized.ability),
      item: megaStone ?? base.item ?? synthesized.item,
      moves: sanitizeMoves(synthesized.moves, base),
      nature: base.nature || synthesized.nature,
      role: base.role || synthesized.role,
    }, format, options.formatPlan));
  }

  const ability = resolveLegalAbility(base, format, base.ability);

  return sanitizeVgcHeldItemForSet(applyVgcFormatPlanSetOverrides({
    ...base,
    ability,
    moves: sanitizeMoves(base.moves ?? [], base),
  }, format, options.formatPlan));
}

export function resolveLegalAbility(
  pokemon: PokemonData,
  format: string,
  preferredAbility?: string,
): string {
  const legalAbilities = getLegalAbilities(pokemon, format);
  const preferred = normalize(preferredAbility);

  if (preferred && legalAbilities.some(ability => normalize(ability) === preferred)) {
    return preferredAbility as string;
  }

  const curated = getCuratedVgcSet(pokemon.name);
  if (curated && legalAbilities.some(ability => normalize(ability) === normalize(curated.ability))) {
    return curated.ability;
  }

  const preferredByFunction = legalAbilities.find(ability =>
    [
      'Armor Tail',
      'Psychic Surge',
      'Grassy Surge',
      'Electric Surge',
      'Misty Surge',
      'Intimidate',
      'Prankster',
      'Drought',
      'Drizzle',
      'Sand Stream',
      'Snow Warning',
      'Chlorophyll',
      'Solar Power',
      'Flower Gift',
      'Harvest',
      'Swift Swim',
      'Sand Rush',
      'Sand Force',
      'Slush Rush',
      'Friend Guard',
      'Regenerator',
      'Guts',
      'Supreme Overlord',
      'Protosynthesis',
      'Rough Skin',
      'Huge Power',
    ]
      .map(normalize)
      .includes(normalize(ability)),
  );

  return preferredByFunction ?? legalAbilities[0] ?? preferredAbility ?? 'Nenhum';
}

export function isAbilityLegalForPokemon(
  pokemon: PokemonData,
  format: string,
  ability?: string,
): boolean {
  if (!ability || ability === 'Nenhum') return true;
  const legalAbilities = getLegalAbilities(pokemon, format).map(normalize);
  return legalAbilities.includes(normalize(ability));
}

function getLegalAbilities(pokemon: PokemonData, format: string): string[] {
  const values = new Set<string>();
  const variantAbilities = getVariant(pokemon, format)?.abilities;

  if (variantAbilities) {
    Object.values(variantAbilities).forEach(ability => {
      if (ability) values.add(String(ability));
    });
  }

  if (pokemon.abilities) {
    Object.values(pokemon.abilities).forEach(ability => {
      if (ability) values.add(String(ability));
    });
  }

  const baseName = getMegaBaseName(pokemon.name);
  const speciesNames = [
    pokemon.name,
    baseName,
    `${baseName}-Mega`,
    `${baseName}-Mega-X`,
    `${baseName}-Mega-Y`,
  ];

  for (const speciesName of speciesNames) {
    const species = Dex.species.get(speciesName);
    if (species.exists && species.abilities) {
      Object.values(species.abilities).forEach(ability => {
        if (ability) values.add(String(ability));
      });
    }
  }

  return [...values].filter(Boolean);
}

interface SanitizeMoveOptions {
  /**
   * Avoids recursive curated-set lookups while a mechanic fallback set is being
   * synthesized. This keeps fallback generation pure and fail-safe for every
   * profile/archetype, instead of only the species that already have presets.
   */
  includeCuratedMoves?: boolean;
}

function getStaticCuratedVgcSet(pokemonName: string): CuratedVgcSet | undefined {
  return CURATED_VGC_SETS[normalize(pokemonName)] ?? getPreferredVgcMechanicSet(pokemonName);
}

function sanitizeMoves(
  moves: string[],
  pokemon: PokemonData,
  options: SanitizeMoveOptions = {},
): string[] {
  const uniqueMoves = [...new Set(moves.filter(Boolean))].slice(0, 4);
  const includeCuratedMoves = options.includeCuratedMoves ?? true;

  if (includeCuratedMoves) {
    // Important: do not call getCuratedVgcSet() here. That function may need to
    // synthesize a mechanic fallback, and synthetic fallbacks also call
    // sanitizeMoves(). Calling it from here creates an unbounded recursion for
    // profile-only Pokémon. Use only static presets that do not depend on this
    // sanitizer.
    const curated = getStaticCuratedVgcSet(pokemon.name);
    if (curated) {
      for (const move of curated.moves) {
        if (uniqueMoves.length >= 4) break;
        if (!uniqueMoves.includes(move)) uniqueMoves.push(move);
      }
    }
  }

  const genericFallback = ['Protect', 'Helping Hand', 'Substitute', 'Tera Blast'];
  for (const move of genericFallback) {
    if (uniqueMoves.length >= 4) break;
    if (!uniqueMoves.includes(move)) uniqueMoves.push(move);
  }

  return uniqueMoves.slice(0, 4);
}
