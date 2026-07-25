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

const TYPE_LABEL_PT: Record<string, string> = {
  normal: 'Normal',
  fire: 'Fogo',
  water: 'Água',
  electric: 'Elétrico',
  grass: 'Planta',
  ice: 'Gelo',
  fighting: 'Lutador',
  poison: 'Veneno',
  ground: 'Terra',
  flying: 'Voador',
  psychic: 'Psíquico',
  bug: 'Inseto',
  rock: 'Pedra',
  ghost: 'Fantasma',
  dragon: 'Dragão',
  dark: 'Sombrio',
  steel: 'Aço',
  fairy: 'Fada',
};

const TYPE_LABEL_EN: Record<string, string> = {
  normal: 'Normal',
  fire: 'Fire',
  water: 'Water',
  electric: 'Electric',
  grass: 'Grass',
  ice: 'Ice',
  fighting: 'Fighting',
  poison: 'Poison',
  ground: 'Ground',
  flying: 'Flying',
  psychic: 'Psychic',
  bug: 'Bug',
  rock: 'Rock',
  ghost: 'Ghost',
  dragon: 'Dragon',
  dark: 'Dark',
  steel: 'Steel',
  fairy: 'Fairy',
};

/** Texto claro e escuro usados sobre as cores de tipo. */
const INK = '#0b0e14';
const PAPER = '#f7f5f0';

export function normalizePokemonType(type: string | undefined | null): string | null {
  if (!type) return null;
  const normalized = type.trim().toLowerCase();
  return normalized in POKEMON_TYPE_COLORS ? normalized : null;
}

export function getPokemonTypeColor(type: string | undefined | null): string | null {
  const normalized = normalizePokemonType(type);
  return normalized ? POKEMON_TYPE_COLORS[normalized] : null;
}

export function getPokemonTypeColors(types: string[] | undefined | null): string[] {
  if (!types || types.length === 0) return [];
  return types
    .map(type => getPokemonTypeColor(type))
    .filter((color): color is string => color !== null);
}

export function getPokemonTypeLabel(type: string, locale: 'pt-BR' | 'en-US'): string {
  const normalized = normalizePokemonType(type);
  if (!normalized) return type;
  return (locale === 'pt-BR' ? TYPE_LABEL_PT : TYPE_LABEL_EN)[normalized];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number): number => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

/**
 * Escolhe entre texto escuro e claro comparando a razão de contraste real
 * (WCAG) contra as duas opções, e não por um limiar fixo de luminância.
 *
 * As 18 cores oficiais de tipo variam demais: Electric (#f8d030) exige texto
 * escuro, Ghost (#705898) exige texto claro. Fixar uma das duas deixa metade
 * das pills ilegível — e um limiar de luminância erra justamente nos tons
 * médios saturados, como Fire (#f08030).
 */
export function getReadableTextOnType(backgroundHex: string): string {
  const background = relativeLuminance(hexToRgb(backgroundHex));
  const againstInk = contrastRatio(background, relativeLuminance(hexToRgb(INK)));
  const againstPaper = contrastRatio(background, relativeLuminance(hexToRgb(PAPER)));
  return againstInk >= againstPaper ? INK : PAPER;
}
