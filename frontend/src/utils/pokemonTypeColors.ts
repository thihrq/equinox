const POKEMON_TYPE_COLORS: Record<string, string> = {
  normal: '#a8a878',
  fire: '#f08030',
  water: '#6890f0',
  electric: '#f8d030',
  grass: '#78c850',
  ice: '#98d8d8',
  fighting: '#c03028',
  poison: '#a040a0',
  ground: '#e0c068',
  flying: '#a890f0',
  psychic: '#f85888',
  bug: '#a8b820',
  rock: '#b8a038',
  ghost: '#705898',
  dragon: '#7038f8',
  dark: '#705848',
  steel: '#b8b8d0',
  fairy: '#ee99ac',
};

export function getPokemonTypeColor(type: string | undefined | null): string | null {
  if (!type) return null;
  return POKEMON_TYPE_COLORS[type.trim().toLowerCase()] ?? null;
}

export function getPokemonTypeColors(types: string[] | undefined | null): string[] {
  if (!types || types.length === 0) return [];
  return types
    .map(type => getPokemonTypeColor(type))
    .filter((color): color is string => color !== null);
}
