const basePokemonNames = [
  'Abomasnow',
  'Abomasnow-Mega',
  'Aegislash',
  'Alakazam',
  'Alakazam-Mega',
  'Amoonguss',
  'Arbok',
  'Arcanine',
  'Azumarill',
  'Baxcalibur',
  'Blastoise',
  'Blaziken',
  'Breloom',
  'Bulbasaur',
  'Calyrex-I',
  'Charizard',
  'Charizard-Mega-X',
  'Charizard-Mega-Y',
  'Chien-Pao',
  'Clefable',
  'Corviknight',
  'Dialga-Primal',
  'Ditto',
  'Dragonite',
  'Dragapult',
  'Eternatus',
  'Excadrill',
  'Farigiraf',
  'Flutter Mane',
  'Garchomp',
  'Gengar',
  'Gengar-Mega',
  'Gholdengo',
  'Glaceon',
  'Great Tusk',
  'Greninja',
  'Gyarados',
  'Heatran',
  'Indeedee-F',
  'Incineroar',
  'Infernape',
  'Iron Bundle',
  'Iron Hands',
  'Iron Valiant',
  'Jolteon',
  'Kingambit',
  'Kommo-o',
  'Koraidon',
  'Kyogre-Primal',
  'Kyurem',
  'Landorus-Therian',
  'Lapras',
  'Lucario',
  'Lucario-Mega',
  'Marshadow',
  'Meganium',
  'Metagross',
  'Metagross-Mega',
  'Milotic',
  'Miraidon',
  'Ninetales-A',
  'Ogerpon-Wellspring',
  'Pheromosa',
  'Pikachu',
  'Politoed',
  'Raging Bolt',
  'Rillaboom',
  'Roaring Moon',
  'Rotom-Wash',
  'Salamence-Mega',
  'Scizor',
  'Slowbro',
  'Sneasler',
  'Swampert',
  'Swampert-Mega',
  'Ting-Lu',
  'Torkoal',
  'Tornadus',
  'Tyranitar',
  'Umbreon',
  'Urshifu-Rapid-Strike',
  'Urshifu-Single-Strike',
  'Venusaur',
  'Volcarona',
  'Walking Wake',
  'Yveltal',
  'Zacian-Crowned',
  'Zapdos',
  'Zoroark',
];

export const POKEMON_NAME_SUGGESTIONS = [...new Set(basePokemonNames)].sort((a, b) => a.localeCompare(b));

export function normalizePokemonNameForSearch(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.'']/g, '')
    .replace(/\s+/g, '-')
    .replace(/_+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function findPokemonNameSuggestions(query: string, limit = 6): string[] {
  const normalizedQuery = normalizePokemonNameForSearch(query);
  if (!normalizedQuery) return [];

  const startsWithMatches = POKEMON_NAME_SUGGESTIONS.filter(name =>
    normalizePokemonNameForSearch(name).startsWith(normalizedQuery),
  );
  const includesMatches = POKEMON_NAME_SUGGESTIONS.filter(name => {
    const normalizedName = normalizePokemonNameForSearch(name);
    return !normalizedName.startsWith(normalizedQuery) && normalizedName.includes(normalizedQuery);
  });

  return [...startsWithMatches, ...includesMatches].slice(0, limit);
}

export function isKnownPokemonName(name: string): boolean {
  const normalizedName = normalizePokemonNameForSearch(name);
  return POKEMON_NAME_SUGGESTIONS.some(candidate => normalizePokemonNameForSearch(candidate) === normalizedName);
}
