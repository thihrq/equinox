import { PokemonData } from '../core/AnalysisContext';
import { getMegaBaseName, getSpeciesClauseKey } from '../utils/PokemonUtils';

export type VgcMechanicKind =
  | 'trick_room'
  | 'weather'
  | 'terrain'
  | 'redirection'
  | 'tailwind'
  | 'turn_control'
  | 'setup'
  | 'priority';

export type VgcMechanicRole =
  | 'setter'
  | 'abuser'
  | 'support'
  | 'enabler'
  | 'disruptor'
  | 'cleaner';

export type VgcWeatherFamily = 'sun' | 'rain' | 'sand' | 'snow';
export type VgcTerrainFamily = 'psychic' | 'electric' | 'grassy' | 'misty';

export interface VgcMechanicSetPreset {
  ability: string;
  item: string;
  nature: string;
  role: string;
  moves: string[];
}

export interface VgcMechanicTag {
  mechanic: VgcMechanicKind;
  role: VgcMechanicRole;
  confidence: number;
  weather?: VgcWeatherFamily;
  terrain?: VgcTerrainFamily;
  primary?: boolean;
  notes?: string[];
}

export interface VgcMechanicProfile {
  key: string;
  displayName: string;
  aliases?: string[];
  tags: VgcMechanicTag[];
  preferredSet?: VgcMechanicSetPreset;
}

const normalize = (value?: string): string =>
  String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const profile = (
  displayName: string,
  tags: VgcMechanicTag[],
  preferredSet?: VgcMechanicSetPreset,
  aliases: string[] = [],
): VgcMechanicProfile => ({
  key: normalize(displayName),
  displayName,
  aliases: [displayName, ...aliases].map(normalize),
  tags,
  preferredSet,
});

const MECHANIC_PROFILES: VgcMechanicProfile[] = [
  // Trick Room setters and enablers
  profile('Farigiraf', [
    { mechanic: 'trick_room', role: 'setter', confidence: 0.96, primary: true },
    { mechanic: 'turn_control', role: 'support', confidence: 0.92, notes: ['Armor Tail bloqueia prioridade contra o lado do usuário.'] },
  ], {
    ability: 'Armor Tail', item: 'Safety Goggles', nature: 'Sassy', role: 'Trick Room Setter / Anti Priority Support',
    moves: ['Trick Room', 'Psychic', 'Hyper Voice', 'Protect'],
  }),
  profile('Cresselia', [
    { mechanic: 'trick_room', role: 'setter', confidence: 0.94, primary: true },
    { mechanic: 'turn_control', role: 'support', confidence: 0.82 },
  ], {
    ability: 'Levitate', item: 'Mental Herb', nature: 'Sassy', role: 'Trick Room Setter / Helping Hand Support',
    moves: ['Trick Room', 'Helping Hand', 'Ice Beam', 'Protect'],
  }),
  profile('Porygon2', [
    { mechanic: 'trick_room', role: 'setter', confidence: 0.93, primary: true },
    { mechanic: 'turn_control', role: 'support', confidence: 0.75 },
  ], {
    ability: 'Download', item: 'Eviolite', nature: 'Sassy', role: 'Trick Room Setter / Defensive Glue',
    moves: ['Trick Room', 'Recover', 'Ice Beam', 'Thunderbolt'],
  }),
  profile('Dusclops', [
    { mechanic: 'trick_room', role: 'setter', confidence: 0.9, primary: true },
    { mechanic: 'turn_control', role: 'support', confidence: 0.82 },
  ], {
    ability: 'Frisk', item: 'Eviolite', nature: 'Sassy', role: 'Trick Room Setter / Disruption',
    moves: ['Trick Room', 'Will-O-Wisp', 'Night Shade', 'Pain Split'],
  }),
  profile('Dusknoir', [
    { mechanic: 'trick_room', role: 'setter', confidence: 0.78, primary: true },
    { mechanic: 'turn_control', role: 'support', confidence: 0.7 },
  ]),
  profile('Hatterene', [
    { mechanic: 'trick_room', role: 'setter', confidence: 0.9, primary: true },
    { mechanic: 'trick_room', role: 'abuser', confidence: 0.85, primary: true },
    { mechanic: 'redirection', role: 'support', confidence: 0.55 },
  ], {
    ability: 'Magic Bounce', item: 'Life Orb', nature: 'Quiet', role: 'Trick Room Setter / Special Damage',
    moves: ['Trick Room', 'Dazzling Gleam', 'Psychic', 'Protect'],
  }),
  profile('Indeedee-F', [
    { mechanic: 'terrain', terrain: 'psychic', role: 'setter', confidence: 0.97, primary: true },
    { mechanic: 'redirection', role: 'support', confidence: 0.96, primary: true },
    { mechanic: 'trick_room', role: 'enabler', confidence: 0.86 },
  ], {
    ability: 'Psychic Surge', item: 'Psychic Seed', nature: 'Sassy', role: 'Psychic Terrain / Redirection / Trick Room Support',
    moves: ['Follow Me', 'Helping Hand', 'Trick Room', 'Protect'],
  }, ['Indeedee Female', 'Indeedee-Female']),
  profile('Indeedee', [
    { mechanic: 'terrain', terrain: 'psychic', role: 'setter', confidence: 0.86, primary: true },
    { mechanic: 'trick_room', role: 'enabler', confidence: 0.72 },
  ], {
    ability: 'Psychic Surge', item: 'Psychic Seed', nature: 'Sassy', role: 'Psychic Terrain / Trick Room Support',
    moves: ['Follow Me', 'Helping Hand', 'Trick Room', 'Protect'],
  }),
  profile('Armarouge', [
    { mechanic: 'terrain', terrain: 'psychic', role: 'abuser', confidence: 0.9, primary: true },
    { mechanic: 'trick_room', role: 'setter', confidence: 0.78 },
    { mechanic: 'trick_room', role: 'abuser', confidence: 0.72 },
  ], {
    ability: 'Flash Fire', item: 'Life Orb', nature: 'Quiet', role: 'Psychic Terrain / Trick Room Special Damage',
    moves: ['Armor Cannon', 'Expanding Force', 'Trick Room', 'Protect'],
  }),
  profile('Oranguru', [
    { mechanic: 'trick_room', role: 'setter', confidence: 0.9, primary: true },
    { mechanic: 'turn_control', role: 'support', confidence: 0.82 },
  ], {
    ability: 'Inner Focus', item: 'Mental Herb', nature: 'Sassy', role: 'Trick Room Setter / Instruct Support',
    moves: ['Trick Room', 'Instruct', 'Psychic', 'Protect'],
  }),
  profile('Mimikyu', [
    { mechanic: 'trick_room', role: 'setter', confidence: 0.82, primary: true },
    { mechanic: 'turn_control', role: 'support', confidence: 0.7 },
  ], {
    ability: 'Disguise', item: 'Mental Herb', nature: 'Brave', role: 'Trick Room Setter / Disruption',
    moves: ['Trick Room', 'Play Rough', 'Shadow Sneak', 'Protect'],
  }),
  profile('Bronzong', [
    { mechanic: 'trick_room', role: 'setter', confidence: 0.82, primary: true },
    { mechanic: 'turn_control', role: 'support', confidence: 0.72 },
  ], {
    ability: 'Levitate', item: 'Mental Herb', nature: 'Sassy', role: 'Trick Room Setter / Steel Defensive Glue',
    moves: ['Trick Room', 'Gyro Ball', 'Hypnosis', 'Protect'],
  }),
  profile('Gothitelle', [
    { mechanic: 'trick_room', role: 'setter', confidence: 0.83, primary: true },
    { mechanic: 'turn_control', role: 'support', confidence: 0.86 },
  ], {
    ability: 'Shadow Tag', item: 'Sitrus Berry', nature: 'Sassy', role: 'Trick Room Setter / Trap Support',
    moves: ['Trick Room', 'Fake Out', 'Psychic', 'Protect'],
  }),
  profile('Stakataka', [
    { mechanic: 'trick_room', role: 'setter', confidence: 0.72 },
    { mechanic: 'trick_room', role: 'abuser', confidence: 0.9, primary: true },
  ], {
    ability: 'Beast Boost', item: 'Life Orb', nature: 'Brave', role: 'Trick Room Rock/Steel Damage',
    moves: ['Gyro Ball', 'Rock Slide', 'Trick Room', 'Protect'],
  }),
  profile('Carbink', [
    { mechanic: 'trick_room', role: 'setter', confidence: 0.7 },
    { mechanic: 'turn_control', role: 'support', confidence: 0.65 },
  ]),
  profile('Slowbro', [{ mechanic: 'trick_room', role: 'setter', confidence: 0.66 }]),
  profile('Slowking', [{ mechanic: 'trick_room', role: 'setter', confidence: 0.68 }]),
  profile('Reuniclus', [
    { mechanic: 'trick_room', role: 'setter', confidence: 0.76 },
    { mechanic: 'trick_room', role: 'abuser', confidence: 0.78 },
  ]),
  profile('Aromatisse', [{ mechanic: 'trick_room', role: 'setter', confidence: 0.74 }]),

  // Trick Room abusers
  profile('Torkoal', [
    { mechanic: 'weather', weather: 'sun', role: 'setter', confidence: 0.96, primary: true },
    { mechanic: 'weather', weather: 'sun', role: 'abuser', confidence: 0.9, primary: true },
    { mechanic: 'trick_room', role: 'abuser', confidence: 0.94, primary: true },
  ], {
    ability: 'Drought', item: 'Charcoal', nature: 'Quiet', role: 'Trick Room Sun Abuser / Spread Special Damage',
    moves: ['Eruption', 'Heat Wave', 'Earth Power', 'Protect'],
  }),
  profile('Mawile-Mega', [
    { mechanic: 'trick_room', role: 'abuser', confidence: 0.9, primary: true },
    { mechanic: 'priority', role: 'cleaner', confidence: 0.76 },
  ], {
    ability: 'Huge Power', item: 'Mawilite', nature: 'Brave', role: 'Mega Trick Room Physical Damage / Priority',
    moves: ['Play Rough', 'Iron Head', 'Sucker Punch', 'Protect'],
  }, ['Mawile']),
  profile('Ursaluna', [
    { mechanic: 'trick_room', role: 'abuser', confidence: 0.95, primary: true },
  ], {
    ability: 'Guts', item: 'Flame Orb', nature: 'Brave', role: 'Trick Room Physical Damage',
    moves: ['Facade', 'Headlong Rush', 'Earthquake', 'Protect'],
  }),
  profile('Ursaluna-Bloodmoon', [
    { mechanic: 'trick_room', role: 'abuser', confidence: 0.94, primary: true },
  ], {
    ability: "Mind's Eye", item: 'Life Orb', nature: 'Quiet', role: 'Trick Room Special Damage',
    moves: ['Blood Moon', 'Hyper Voice', 'Earth Power', 'Protect'],
  }, ['Ursaluna Bloodmoon']),
  profile('Iron Hands', [
    { mechanic: 'trick_room', role: 'abuser', confidence: 0.82 },
    { mechanic: 'turn_control', role: 'support', confidence: 0.9 },
  ], {
    ability: 'Quark Drive', item: 'Assault Vest', nature: 'Brave', role: 'Bulky Trick Room Physical Damage / Fake Out',
    moves: ['Fake Out', 'Drain Punch', 'Wild Charge', 'Heavy Slam'],
  }),
  profile('Camerupt-Mega', [
    { mechanic: 'trick_room', role: 'abuser', confidence: 0.92, primary: true },
    { mechanic: 'weather', weather: 'sun', role: 'abuser', confidence: 0.72 },
  ], {
    ability: 'Sheer Force', item: 'Cameruptite', nature: 'Quiet', role: 'Mega Trick Room Special Damage',
    moves: ['Heat Wave', 'Earth Power', 'Ancient Power', 'Protect'],
  }, ['Camerupt']),
  profile('Rhyperior', [{ mechanic: 'trick_room', role: 'abuser', confidence: 0.88, primary: true }], {
    ability: 'Solid Rock', item: 'Weakness Policy', nature: 'Brave', role: 'Trick Room Physical Damage',
    moves: ['Rock Slide', 'High Horsepower', 'Ice Punch', 'Protect'],
  }),
  profile('Glastrier', [{ mechanic: 'trick_room', role: 'abuser', confidence: 0.9, primary: true }]),
  profile('Calyrex-Ice', [{ mechanic: 'trick_room', role: 'abuser', confidence: 0.96, primary: true }]),
  profile('Marowak-Alola', [{ mechanic: 'trick_room', role: 'abuser', confidence: 0.86, primary: true }]),
  profile('Araquanid', [{ mechanic: 'trick_room', role: 'abuser', confidence: 0.78 }]),
  profile('Kingambit', [
    { mechanic: 'trick_room', role: 'abuser', confidence: 0.7 },
    { mechanic: 'priority', role: 'cleaner', confidence: 0.88 },
  ], {
    ability: 'Supreme Overlord', item: 'Black Glasses', nature: 'Adamant', role: 'Late Game Cleaner / Priority',
    moves: ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Protect'],
  }),

  // Sun
  profile('Charizard-Mega-Y', [
    { mechanic: 'weather', weather: 'sun', role: 'setter', confidence: 0.97, primary: true },
    { mechanic: 'weather', weather: 'sun', role: 'abuser', confidence: 0.72 },
  ], {
    ability: 'Drought', item: 'Charizardite Y', nature: 'Timid', role: 'Sun Setter / Spread Special Damage',
    moves: ['Heat Wave', 'Overheat', 'Solar Beam', 'Protect'],
  }),
  profile('Ninetales', [{ mechanic: 'weather', weather: 'sun', role: 'setter', confidence: 0.9, primary: true }], {
    ability: 'Drought', item: 'Heat Rock', nature: 'Timid', role: 'Sun Setter / Utility',
    moves: ['Heat Wave', 'Solar Beam', 'Will-O-Wisp', 'Protect'],
  }),
  profile('Groudon', [
    { mechanic: 'weather', weather: 'sun', role: 'setter', confidence: 0.96, primary: true },
    { mechanic: 'weather', weather: 'sun', role: 'abuser', confidence: 0.88, primary: true },
  ]),
  profile('Koraidon', [
    { mechanic: 'weather', weather: 'sun', role: 'setter', confidence: 0.95, primary: true },
    { mechanic: 'weather', weather: 'sun', role: 'abuser', confidence: 0.84, primary: true },
  ]),
  profile('Venusaur', [{ mechanic: 'weather', weather: 'sun', role: 'abuser', confidence: 0.98, primary: true }], {
    ability: 'Chlorophyll', item: 'Focus Sash', nature: 'Timid', role: 'Sun Abuser / Sleep Pressure',
    moves: ['Energy Ball', 'Sludge Bomb', 'Sleep Powder', 'Protect'],
  }),
  profile('Lilligant', [
    { mechanic: 'weather', weather: 'sun', role: 'abuser', confidence: 0.9, primary: true },
    { mechanic: 'turn_control', role: 'support', confidence: 0.75 },
  ], {
    ability: 'Chlorophyll', item: 'Focus Sash', nature: 'Timid', role: 'Sun Abuser / Sleep Pressure',
    moves: ['Leaf Storm', 'Sleep Powder', 'After You', 'Protect'],
  }),
  profile('Lilligant-Hisui', [
    { mechanic: 'weather', weather: 'sun', role: 'abuser', confidence: 0.88, primary: true },
    { mechanic: 'turn_control', role: 'support', confidence: 0.72 },
  ]),
  profile('Leafeon', [{ mechanic: 'weather', weather: 'sun', role: 'abuser', confidence: 0.78, primary: true }], {
    ability: 'Chlorophyll', item: 'Life Orb', nature: 'Jolly', role: 'Physical Sun Abuser',
    moves: ['Leaf Blade', 'Solar Blade', 'Knock Off', 'Protect'],
  }),
  profile('Exeggutor', [{ mechanic: 'weather', weather: 'sun', role: 'abuser', confidence: 0.82, primary: true }], {
    ability: 'Chlorophyll', item: 'Life Orb', nature: 'Modest', role: 'Sun Abuser / Special Damage',
    moves: ['Leaf Storm', 'Psychic', 'Sleep Powder', 'Protect'],
  }),
  profile('Exeggutor-Alola', [{ mechanic: 'weather', weather: 'sun', role: 'abuser', confidence: 0.78, primary: true }], {
    ability: 'Chlorophyll', item: 'Life Orb', nature: 'Modest', role: 'Sun Abuser / Special Damage',
    moves: ['Leaf Storm', 'Draco Meteor', 'Sleep Powder', 'Protect'],
  }),
  profile('Tangrowth', [{ mechanic: 'weather', weather: 'sun', role: 'abuser', confidence: 0.72, primary: true }], {
    ability: 'Chlorophyll', item: 'Rocky Helmet', nature: 'Bold', role: 'Bulky Sun Abuser / Sleep Pressure',
    moves: ['Giga Drain', 'Sleep Powder', 'Leech Seed', 'Protect'],
  }),
  profile('Walking Wake', [{ mechanic: 'weather', weather: 'sun', role: 'abuser', confidence: 0.74 }], {
    ability: 'Protosynthesis', item: 'Life Orb', nature: 'Timid', role: 'Sun-Compatible Special Damage',
    moves: ['Hydro Steam', 'Draco Meteor', 'Flamethrower', 'Protect'],
  }),
  profile('Flutter Mane', [{ mechanic: 'weather', weather: 'sun', role: 'abuser', confidence: 0.68 }], {
    ability: 'Protosynthesis', item: 'Booster Energy', nature: 'Timid', role: 'Special Damage / Speed Control',
    moves: ['Moonblast', 'Shadow Ball', 'Dazzling Gleam', 'Protect'],
  }),
  profile('Raging Bolt', [
    { mechanic: 'weather', weather: 'sun', role: 'abuser', confidence: 0.66 },
    { mechanic: 'priority', role: 'cleaner', confidence: 0.8 },
  ], {
    ability: 'Protosynthesis', item: 'Booster Energy', nature: 'Modest', role: 'Bulky Special Damage / Priority',
    moves: ['Thunderclap', 'Thunderbolt', 'Draco Meteor', 'Protect'],
  }),
  profile('Gouging Fire', [{ mechanic: 'weather', weather: 'sun', role: 'abuser', confidence: 0.72 }], {
    ability: 'Protosynthesis', item: 'Clear Amulet', nature: 'Adamant', role: 'Bulky Physical Damage',
    moves: ['Heat Crash', 'Breaking Swipe', 'Burning Bulwark', 'Protect'],
  }),
  profile('Slither Wing', [
    { mechanic: 'weather', weather: 'sun', role: 'abuser', confidence: 0.62 },
    { mechanic: 'priority', role: 'cleaner', confidence: 0.68 },
  ], {
    ability: 'Protosynthesis', item: 'Assault Vest', nature: 'Adamant', role: 'Bulky Physical Damage / Priority',
    moves: ['First Impression', 'Close Combat', 'Leech Life', 'Flare Blitz'],
  }),
  profile('Sandy Shocks', [{ mechanic: 'weather', weather: 'sun', role: 'abuser', confidence: 0.62 }], {
    ability: 'Protosynthesis', item: 'Booster Energy', nature: 'Timid', role: 'Fast Special Damage',
    moves: ['Thunderbolt', 'Earth Power', 'Volt Switch', 'Protect'],
  }),

  // Rain
  profile('Pelipper', [
    { mechanic: 'weather', weather: 'rain', role: 'setter', confidence: 0.95, primary: true },
    { mechanic: 'tailwind', role: 'setter', confidence: 0.72 },
  ], {
    ability: 'Drizzle', item: 'Focus Sash', nature: 'Timid', role: 'Rain Setter / Tailwind Support',
    moves: ['Hurricane', 'Weather Ball', 'Tailwind', 'Protect'],
  }),
  profile('Politoed', [{ mechanic: 'weather', weather: 'rain', role: 'setter', confidence: 0.9, primary: true }], {
    ability: 'Drizzle', item: 'Sitrus Berry', nature: 'Calm', role: 'Rain Setter / Utility',
    moves: ['Muddy Water', 'Helping Hand', 'Encore', 'Protect'],
  }),
  profile('Blastoise', [
    { mechanic: 'weather', weather: 'rain', role: 'support', confidence: 0.72 },
    { mechanic: 'turn_control', role: 'support', confidence: 0.68 },
  ], {
    ability: 'Rain Dish', item: 'Wacan Berry', nature: 'Calm', role: 'Rain Utility / Speed Control',
    moves: ['Muddy Water', 'Icy Wind', 'Aura Sphere', 'Protect'],
  }),
  profile('Swampert-Mega', [
    { mechanic: 'weather', weather: 'rain', role: 'abuser', confidence: 0.96, primary: true },
  ], {
    ability: 'Swift Swim', item: 'Swampertite', nature: 'Adamant', role: 'Mega Rain Physical Damage',
    moves: ['Liquidation', 'High Horsepower', 'Rock Slide', 'Protect'],
  }, ['Swampert']),
  profile('Kyogre', [
    { mechanic: 'weather', weather: 'rain', role: 'setter', confidence: 0.96, primary: true },
    { mechanic: 'weather', weather: 'rain', role: 'abuser', confidence: 0.92, primary: true },
  ]),
  profile('Barraskewda', [{ mechanic: 'weather', weather: 'rain', role: 'abuser', confidence: 0.88, primary: true }], {
    ability: 'Swift Swim', item: 'Mystic Water', nature: 'Adamant', role: 'Fast Rain Physical Damage',
    moves: ['Liquidation', 'Close Combat', 'Aqua Jet', 'Protect'],
  }),
  profile('Ludicolo', [{ mechanic: 'weather', weather: 'rain', role: 'abuser', confidence: 0.86, primary: true }], {
    ability: 'Swift Swim', item: 'Expert Belt', nature: 'Modest', role: 'Rain Special Damage / Grass Coverage',
    moves: ['Muddy Water', 'Energy Ball', 'Ice Beam', 'Protect'],
  }),
  profile('Kingdra', [{ mechanic: 'weather', weather: 'rain', role: 'abuser', confidence: 0.84, primary: true }], {
    ability: 'Swift Swim', item: 'Scope Lens', nature: 'Modest', role: 'Rain Special Damage / Dragon Coverage',
    moves: ['Muddy Water', 'Draco Meteor', 'Hurricane', 'Protect'],
  }),
  profile('Basculegion', [{ mechanic: 'weather', weather: 'rain', role: 'abuser', confidence: 0.8, primary: true }], {
    ability: 'Swift Swim', item: 'Spell Tag', nature: 'Adamant', role: 'Rain Physical Cleaner / Priority',
    moves: ['Wave Crash', 'Last Respects', 'Aqua Jet', 'Protect'],
  }),
  profile('Archaludon', [{ mechanic: 'weather', weather: 'rain', role: 'abuser', confidence: 0.76 }], {
    ability: 'Stamina', item: 'Assault Vest', nature: 'Modest', role: 'Rain-Compatible Special Damage',
    moves: ['Electro Shot', 'Draco Meteor', 'Flash Cannon', 'Body Press'],
  }),
  profile('Drednaw', [{ mechanic: 'weather', weather: 'rain', role: 'abuser', confidence: 0.7, primary: true }], {
    ability: 'Swift Swim', item: 'Clear Amulet', nature: 'Adamant', role: 'Rain Physical Damage / Rock Pressure',
    moves: ['Liquidation', 'Rock Slide', 'High Horsepower', 'Protect'],
  }),
  profile('Palafin', [{ mechanic: 'weather', weather: 'rain', role: 'abuser', confidence: 0.68 }], {
    ability: 'Zero to Hero', item: 'Mystic Water', nature: 'Adamant', role: 'Rain-Compatible Physical Cleaner',
    moves: ['Wave Crash', 'Jet Punch', 'Close Combat', 'Protect'],
  }),

  // Sand and snow
  profile('Tyranitar', [{ mechanic: 'weather', weather: 'sand', role: 'setter', confidence: 0.94, primary: true }]),
  profile('Hippowdon', [{ mechanic: 'weather', weather: 'sand', role: 'setter', confidence: 0.82, primary: true }]),
  profile('Gigalith', [
    { mechanic: 'weather', weather: 'sand', role: 'setter', confidence: 0.82, primary: true },
    { mechanic: 'trick_room', role: 'abuser', confidence: 0.72 },
  ]),
  profile('Excadrill', [{ mechanic: 'weather', weather: 'sand', role: 'abuser', confidence: 0.94, primary: true }]),
  profile('Lycanroc', [{ mechanic: 'weather', weather: 'sand', role: 'abuser', confidence: 0.7 }]),
  profile('Ninetales-Alola', [{ mechanic: 'weather', weather: 'snow', role: 'setter', confidence: 0.92, primary: true }], {
    ability: 'Snow Warning', item: 'Light Clay', nature: 'Timid', role: 'Snow Setter / Aurora Veil Support',
    moves: ['Blizzard', 'Aurora Veil', 'Encore', 'Protect'],
  }),
  profile('Abomasnow', [{ mechanic: 'weather', weather: 'snow', role: 'setter', confidence: 0.86, primary: true }]),
  profile('Cetitan', [{ mechanic: 'weather', weather: 'snow', role: 'abuser', confidence: 0.8, primary: true }]),
  profile('Sandslash-Alola', [{ mechanic: 'weather', weather: 'snow', role: 'abuser', confidence: 0.78, primary: true }]),
  profile('Beartic', [{ mechanic: 'weather', weather: 'snow', role: 'abuser', confidence: 0.66 }]),
  profile('Baxcalibur', [{ mechanic: 'weather', weather: 'snow', role: 'abuser', confidence: 0.55 }]),

  // Terrain cores
  profile('Tapu Lele', [{ mechanic: 'terrain', terrain: 'psychic', role: 'setter', confidence: 0.94, primary: true }]),
  profile('Rillaboom', [
    { mechanic: 'terrain', terrain: 'grassy', role: 'setter', confidence: 0.96, primary: true },
    { mechanic: 'turn_control', role: 'support', confidence: 0.92 },
    { mechanic: 'priority', role: 'cleaner', confidence: 0.78 },
  ], {
    ability: 'Grassy Surge', item: 'Assault Vest', nature: 'Adamant', role: 'Grassy Terrain / Fake Out Pivot',
    moves: ['Fake Out', 'Grassy Glide', 'Wood Hammer', 'U-turn'],
  }),
  profile('Tapu Bulu', [{ mechanic: 'terrain', terrain: 'grassy', role: 'setter', confidence: 0.86, primary: true }]),
  profile('Tapu Koko', [{ mechanic: 'terrain', terrain: 'electric', role: 'setter', confidence: 0.94, primary: true }], {
    ability: 'Electric Surge', item: 'Life Orb', nature: 'Timid', role: 'Electric Terrain Pressure / Fast Special Damage',
    moves: ['Thunderbolt', 'Dazzling Gleam', 'Volt Switch', 'Protect'],
  }),
  profile('Miraidon', [
    { mechanic: 'terrain', terrain: 'electric', role: 'setter', confidence: 0.98, primary: true },
    { mechanic: 'terrain', terrain: 'electric', role: 'abuser', confidence: 0.92, primary: true },
  ]),
  profile('Pincurchin', [{ mechanic: 'terrain', terrain: 'electric', role: 'setter', confidence: 0.78, primary: true }]),
  profile('Tapu Fini', [{ mechanic: 'terrain', terrain: 'misty', role: 'setter', confidence: 0.9, primary: true }]),
  profile('Weezing-Galar', [{ mechanic: 'terrain', terrain: 'misty', role: 'setter', confidence: 0.74 }]),
  profile('Iron Boulder', [{ mechanic: 'terrain', terrain: 'electric', role: 'abuser', confidence: 0.52 }], {
    ability: 'Quark Drive', item: 'Life Orb', nature: 'Jolly', role: 'Fast Physical Damage / Anti Fire',
    moves: ['Rock Slide', 'Mighty Cleave', 'Zen Headbutt', 'Protect'],
  }),
  profile('Iron Crown', [{ mechanic: 'terrain', terrain: 'electric', role: 'abuser', confidence: 0.56 }]),
  profile('Iron Bundle', [{ mechanic: 'terrain', terrain: 'electric', role: 'abuser', confidence: 0.5 }]),
  profile('Iron Valiant', [{ mechanic: 'terrain', terrain: 'electric', role: 'abuser', confidence: 0.5 }]),

  // Redirection and defensive enablers
  profile('Amoonguss', [
    { mechanic: 'redirection', role: 'support', confidence: 0.96, primary: true },
    { mechanic: 'trick_room', role: 'enabler', confidence: 0.88 },
    { mechanic: 'turn_control', role: 'support', confidence: 0.92 },
  ], {
    ability: 'Regenerator', item: 'Rocky Helmet', nature: 'Relaxed', role: 'Redirection / Sleep Pressure / Trick Room Support',
    moves: ['Spore', 'Rage Powder', 'Pollen Puff', 'Protect'],
  }),

  profile('Brute Bonnet', [
    { mechanic: 'redirection', role: 'support', confidence: 0.88, primary: true },
    { mechanic: 'trick_room', role: 'abuser', confidence: 0.78 },
    { mechanic: 'turn_control', role: 'support', confidence: 0.82 },
  ], {
    ability: 'Protosynthesis', item: 'Rocky Helmet', nature: 'Brave', role: 'Trick Room Redirection / Sleep Pressure',
    moves: ['Spore', 'Rage Powder', 'Seed Bomb', 'Protect'],
  }),
  profile('Maushold', [
    { mechanic: 'redirection', role: 'support', confidence: 0.92, primary: true },
    { mechanic: 'turn_control', role: 'support', confidence: 0.78 },
  ], {
    ability: 'Friend Guard', item: 'Safety Goggles', nature: 'Jolly', role: 'Redirection / Friend Guard Support',
    moves: ['Super Fang', 'Follow Me', 'Taunt', 'Protect'],
  }),
  profile('Clefairy', [
    { mechanic: 'redirection', role: 'support', confidence: 0.94, primary: true },
    { mechanic: 'turn_control', role: 'support', confidence: 0.78 },
  ], {
    ability: 'Friend Guard', item: 'Eviolite', nature: 'Relaxed', role: 'Friend Guard / Redirection',
    moves: ['Follow Me', 'Helping Hand', 'Life Dew', 'Protect'],
  }),
  profile('Clefable', [{ mechanic: 'redirection', role: 'support', confidence: 0.78 }]),
  profile('Togekiss', [
    { mechanic: 'redirection', role: 'support', confidence: 0.86 },
    { mechanic: 'tailwind', role: 'setter', confidence: 0.6 },
  ], {
    ability: 'Serene Grace', item: 'Safety Goggles', nature: 'Bold', role: 'Bulky Redirection / Follow Me Support',
    moves: ['Follow Me', 'Helping Hand', 'Dazzling Gleam', 'Protect'],
  }),
  profile('Volcarona', [
    { mechanic: 'setup', role: 'abuser', confidence: 0.72 },
  ], {
    ability: 'Flame Body', item: 'Rocky Helmet', nature: 'Bold', role: 'Setup Special Damage / Situational Rage Powder',
    moves: ['Rage Powder', 'Heat Wave', 'Bug Buzz', 'Protect'],
  }),
  profile('Ogerpon', [{ mechanic: 'redirection', role: 'support', confidence: 0.72 }]),
  profile('Ogerpon-Wellspring', [{ mechanic: 'redirection', role: 'support', confidence: 0.76 }]),
  profile('Ogerpon-Hearthflame', [{ mechanic: 'redirection', role: 'support', confidence: 0.72 }]),
  profile('Ogerpon-Cornerstone', [{ mechanic: 'redirection', role: 'support', confidence: 0.72 }]),

  // Tailwind setters
  profile('Whimsicott', [
    { mechanic: 'tailwind', role: 'setter', confidence: 0.98, primary: true },
    { mechanic: 'weather', weather: 'sun', role: 'support', confidence: 0.86 },
    { mechanic: 'turn_control', role: 'disruptor', confidence: 0.92 },
  ], {
    ability: 'Prankster', item: 'Mental Herb', nature: 'Timid', role: 'Prankster Speed Control / Anti Weather',
    moves: ['Moonblast', 'Tailwind', 'Sunny Day', 'Encore'],
  }),
  profile('Tornadus', [
    { mechanic: 'tailwind', role: 'setter', confidence: 0.98, primary: true },
    { mechanic: 'weather', weather: 'rain', role: 'support', confidence: 0.78 },
    { mechanic: 'weather', weather: 'sun', role: 'support', confidence: 0.62 },
  ], {
    ability: 'Prankster', item: 'Covert Cloak', nature: 'Timid', role: 'Prankster Tailwind / Weather Support',
    moves: ['Bleakwind Storm', 'Tailwind', 'Rain Dance', 'Protect'],
  }),
  profile('Murkrow', [{ mechanic: 'tailwind', role: 'setter', confidence: 0.9, primary: true }], {
    ability: 'Prankster', item: 'Eviolite', nature: 'Timid', role: 'Prankster Tailwind / Disruption',
    moves: ['Foul Play', 'Tailwind', 'Taunt', 'Protect'],
  }),
  profile('Talonflame', [{ mechanic: 'tailwind', role: 'setter', confidence: 0.86, primary: true }]),
  profile('Salamence', [
    { mechanic: 'tailwind', role: 'setter', confidence: 0.72 },
    { mechanic: 'turn_control', role: 'support', confidence: 0.66 },
  ], {
    ability: 'Intimidate', item: 'Safety Goggles', nature: 'Jolly', role: 'Intimidate Speed Control',
    moves: ['Dragon Claw', 'Rock Slide', 'Tailwind', 'Protect'],
  }),
  profile('Salamence-Mega', [
    { mechanic: 'tailwind', role: 'setter', confidence: 0.68 },
    { mechanic: 'setup', role: 'abuser', confidence: 0.72 },
  ], {
    ability: 'Aerilate', item: 'Salamencite', nature: 'Jolly', role: 'Mega Physical Damage / Tailwind',
    moves: ['Double-Edge', 'Tailwind', 'Hyper Voice', 'Protect'],
  }),
  profile('Dragonite', [{ mechanic: 'tailwind', role: 'setter', confidence: 0.58 }, { mechanic: 'priority', role: 'cleaner', confidence: 0.7 }]),
  profile('Zapdos', [{ mechanic: 'tailwind', role: 'setter', confidence: 0.72 }]),
  profile('Corviknight', [{ mechanic: 'tailwind', role: 'setter', confidence: 0.7 }]),
  profile('Kilowattrel', [{ mechanic: 'tailwind', role: 'setter', confidence: 0.72 }]),
  profile('Suicune', [{ mechanic: 'tailwind', role: 'setter', confidence: 0.7 }]),

  // Turn control / pivots that should be recognized from name alone
  profile('Incineroar', [
    { mechanic: 'turn_control', role: 'support', confidence: 0.98, primary: true },
    { mechanic: 'redirection', role: 'enabler', confidence: 0.5 },
  ], {
    ability: 'Intimidate', item: 'Sitrus Berry', nature: 'Careful', role: 'Fake Out Pivot / Defensive Glue',
    moves: ['Flare Blitz', 'Fake Out', 'Taunt', 'Parting Shot'],
  }),
  profile('Hariyama', [
    { mechanic: 'turn_control', role: 'support', confidence: 0.86 },
    { mechanic: 'trick_room', role: 'enabler', confidence: 0.74 },
  ]),
  profile('Hitmontop', [{ mechanic: 'turn_control', role: 'support', confidence: 0.82 }]),
  profile('Raichu', [{ mechanic: 'turn_control', role: 'support', confidence: 0.76 }]),
  profile('Mienshao', [{ mechanic: 'turn_control', role: 'support', confidence: 0.76 }]),
  profile('Kangaskhan-Mega', [{ mechanic: 'turn_control', role: 'support', confidence: 0.84 }]),
  profile('Weavile', [
    { mechanic: 'turn_control', role: 'support', confidence: 0.72 },
    { mechanic: 'priority', role: 'cleaner', confidence: 0.74 },
  ]),

  // Common Tailwind/fast-mode abusers for role inference
  profile('Urshifu', [{ mechanic: 'tailwind', role: 'abuser', confidence: 0.72 }]),
  profile('Chi-Yu', [{ mechanic: 'tailwind', role: 'abuser', confidence: 0.72 }]),
  profile('Chien-Pao', [{ mechanic: 'tailwind', role: 'abuser', confidence: 0.72 }, { mechanic: 'priority', role: 'cleaner', confidence: 0.78 }]),
  profile('Garchomp', [{ mechanic: 'tailwind', role: 'abuser', confidence: 0.62 }], {
    ability: 'Rough Skin', item: 'Clear Amulet', nature: 'Jolly', role: 'Physical Damage / Ground Pressure',
    moves: ['Stomping Tantrum', 'Dragon Claw', 'Rock Slide', 'Protect'],
  }),
  profile('Landorus-Therian', [{ mechanic: 'tailwind', role: 'abuser', confidence: 0.62 }]),

  // Useful presets that avoid generic/singles fallbacks
  profile('Nihilego', [{ mechanic: 'tailwind', role: 'abuser', confidence: 0.56 }], {
    ability: 'Beast Boost', item: 'Life Orb', nature: 'Timid', role: 'Fast Special Damage / Anti Fire',
    moves: ['Power Gem', 'Sludge Bomb', 'Dazzling Gleam', 'Protect'],
  }),
  profile('Tentacruel', [{ mechanic: 'tailwind', role: 'support', confidence: 0.42 }], {
    ability: 'Clear Body', item: 'Black Sludge', nature: 'Timid', role: 'Creative Utility / Speed Control',
    moves: ['Muddy Water', 'Sludge Bomb', 'Icy Wind', 'Protect'],
  }),
  profile('Scream Tail', [
    { mechanic: 'turn_control', role: 'support', confidence: 0.84 },
    { mechanic: 'weather', weather: 'sun', role: 'abuser', confidence: 0.48 },
  ], {
    ability: 'Protosynthesis', item: 'Booster Energy', nature: 'Timid', role: 'Support / Anti Trick Room',
    moves: ['Dazzling Gleam', 'Encore', 'Disable', 'Protect'],
  }),
];

const PROFILE_BY_ALIAS = new Map<string, VgcMechanicProfile>();

for (const item of MECHANIC_PROFILES) {
  PROFILE_BY_ALIAS.set(item.key, item);
  for (const alias of item.aliases ?? []) PROFILE_BY_ALIAS.set(alias, item);
}

export function getVgcMechanicProfile(nameOrPokemon?: string | PokemonData | null): VgcMechanicProfile | undefined {
  const rawName = typeof nameOrPokemon === 'string'
    ? nameOrPokemon
    : nameOrPokemon?.name;

  if (!rawName) return undefined;

  const direct = PROFILE_BY_ALIAS.get(normalize(rawName));
  if (direct) return direct;

  const base = getMegaBaseName(rawName);
  const baseProfile = PROFILE_BY_ALIAS.get(normalize(base));
  if (baseProfile) return baseProfile;

  const speciesKey = getSpeciesClauseKey(rawName);
  return PROFILE_BY_ALIAS.get(speciesKey);
}

export function getVgcMechanicTags(nameOrPokemon?: string | PokemonData | null): VgcMechanicTag[] {
  return getVgcMechanicProfile(nameOrPokemon)?.tags ?? [];
}

export function getPreferredVgcMechanicSet(nameOrPokemon?: string | PokemonData | null): VgcMechanicSetPreset | undefined {
  return getVgcMechanicProfile(nameOrPokemon)?.preferredSet;
}

export function hasVgcMechanicTag(
  nameOrPokemon: string | PokemonData,
  matcher: Partial<Pick<VgcMechanicTag, 'mechanic' | 'role' | 'weather' | 'terrain' | 'primary'>>,
  minConfidence = 0.5,
): boolean {
  return getVgcMechanicTags(nameOrPokemon).some(tag => {
    if (tag.confidence < minConfidence) return false;
    if (matcher.mechanic && tag.mechanic !== matcher.mechanic) return false;
    if (matcher.role && tag.role !== matcher.role) return false;
    if (matcher.weather && tag.weather !== matcher.weather) return false;
    if (matcher.terrain && tag.terrain !== matcher.terrain) return false;
    if (typeof matcher.primary === 'boolean' && Boolean(tag.primary) !== matcher.primary) return false;
    return true;
  });
}

export function isVgcMechanicTrickRoomSetter(pokemon: PokemonData): boolean {
  return hasVgcMechanicTag(pokemon, { mechanic: 'trick_room', role: 'setter' }, 0.65);
}

export function isVgcMechanicTrickRoomAbuser(pokemon: PokemonData): boolean {
  return hasVgcMechanicTag(pokemon, { mechanic: 'trick_room', role: 'abuser' }, 0.6);
}

export function isVgcMechanicRedirectionSupport(pokemon: PokemonData): boolean {
  return hasVgcMechanicTag(pokemon, { mechanic: 'redirection', role: 'support' }, 0.75);
}

export function isVgcMechanicTailwindSetter(pokemon: PokemonData): boolean {
  return hasVgcMechanicTag(pokemon, { mechanic: 'tailwind', role: 'setter' }, 0.55);
}

export function isVgcMechanicWeatherSetter(pokemon: PokemonData, weather?: VgcWeatherFamily): boolean {
  return getVgcMechanicTags(pokemon).some(tag =>
    tag.mechanic === 'weather' &&
    tag.role === 'setter' &&
    tag.confidence >= 0.6 &&
    (!weather || tag.weather === weather),
  );
}

export function isVgcMechanicWeatherAbuser(
  pokemon: PokemonData,
  weather?: VgcWeatherFamily,
  primaryOnly = false,
): boolean {
  return getVgcMechanicTags(pokemon).some(tag =>
    tag.mechanic === 'weather' &&
    tag.role === 'abuser' &&
    tag.confidence >= 0.5 &&
    (!weather || tag.weather === weather) &&
    (!primaryOnly || Boolean(tag.primary)),
  );
}

export function isVgcMechanicTerrainSetter(pokemon: PokemonData, terrain?: VgcTerrainFamily): boolean {
  return getVgcMechanicTags(pokemon).some(tag =>
    tag.mechanic === 'terrain' &&
    tag.role === 'setter' &&
    tag.confidence >= 0.6 &&
    (!terrain || tag.terrain === terrain),
  );
}

export function isVgcMechanicTerrainAbuser(pokemon: PokemonData, terrain?: VgcTerrainFamily): boolean {
  return getVgcMechanicTags(pokemon).some(tag =>
    tag.mechanic === 'terrain' &&
    tag.role === 'abuser' &&
    tag.confidence >= 0.5 &&
    (!terrain || tag.terrain === terrain),
  );
}

export function getVgcMechanicProfileSummary(pokemon: PokemonData): string[] {
  const tags = getVgcMechanicTags(pokemon);
  return tags
    .filter(tag => tag.confidence >= 0.65)
    .map(tag => [tag.mechanic, tag.weather ?? tag.terrain, tag.role].filter(Boolean).join(':'));
}

export function hasTerrainSleepConflict(team: PokemonData[]): boolean {
  const hasElectricTerrain = team.some(pokemon => isVgcMechanicTerrainSetter(pokemon, 'electric'));
  const hasMistyTerrain = team.some(pokemon => isVgcMechanicTerrainSetter(pokemon, 'misty'));
  const sleepMoves = ['sleeppowder', 'spore', 'yawn', 'hypnosis'];

  const hasGroundedSleepPlan = team.some(pokemon =>
    (pokemon.moves ?? []).some(move => sleepMoves.includes(normalize(move))),
  );

  return (hasElectricTerrain || hasMistyTerrain) && hasGroundedSleepPlan;
}

export function listVgcMechanicProfiles(): VgcMechanicProfile[] {
  return [...MECHANIC_PROFILES];
}
