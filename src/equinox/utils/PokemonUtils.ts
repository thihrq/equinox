// TODO: Implementar a classe/módulo PokemonUtils.ts
import { PokemonData, PokemonVariant } from '../core/AnalysisContext';

export function getVariant(
  pokemon: PokemonData,
  format: string,
): PokemonVariant | undefined {
  const explicitVariant =
    pokemon.variants?.find(
      variant => variant.formatId === format || variant.formatId === 'vanilla',
    ) ?? pokemon.variants?.[0];

  if (explicitVariant) return explicitVariant;

  const directPokemon = pokemon as PokemonData & {
    baseStats?: PokemonVariant['baseStats'];
    abilities?: PokemonVariant['abilities'];
  };

  if (directPokemon.baseStats || pokemon.types?.length) {
    return {
      formatId: format,
      baseStats: directPokemon.baseStats,
      types: pokemon.types,
      abilities: directPokemon.abilities,
    };
  }

  return undefined;
}

export function getPokemonTypes(pokemon: PokemonData, format: string): string[] {
  const variant = getVariant(pokemon, format);

  return variant?.types ?? pokemon.types ?? [];
}

export function calculateBST(stats?: PokemonVariant['baseStats']): number {
  if (!stats) return 0;

  return (
    Number(stats.hp ?? 0) +
    Number(stats.atk ?? 0) +
    Number(stats.def ?? 0) +
    Number(stats.spa ?? 0) +
    Number(stats.spd ?? 0) +
    Number(stats.spe ?? 0)
  );
}

export function generateBasicKit(pokemon: PokemonData, format: string) {
  const variant = getVariant(pokemon, format);

  const stats = variant?.baseStats ?? {
    hp: 80,
    atk: 80,
    def: 80,
    spa: 80,
    spd: 80,
    spe: 80,
  };

  const hp = Number(stats.hp ?? 0);
  const atk = Number(stats.atk ?? 0);
  const def = Number(stats.def ?? 0);
  const spa = Number(stats.spa ?? 0);
  const spd = Number(stats.spd ?? 0);
  const spe = Number(stats.spe ?? 0);

  if (spe >= 100 && atk > spa) {
    return { nature: 'Jolly', role: 'Atacante Físico (Rápido)' };
  }

  if (spe >= 100 && spa >= atk) {
    return { nature: 'Timid', role: 'Atacante Especial (Rápido)' };
  }

  if (def >= 100 && hp >= 80) {
    return { nature: 'Impish / Bold', role: 'Barreira Física (Tank)' };
  }

  if (spd >= 100 && hp >= 80) {
    return { nature: 'Careful / Calm', role: 'Barreira Especial (Tank)' };
  }

  if (atk > 110) {
    return { nature: 'Adamant', role: 'Demolidor Físico (Wallbreaker)' };
  }

  if (spa > 110) {
    return { nature: 'Modest', role: 'Demolidor Especial (Wallbreaker)' };
  }

  return { nature: 'Sassy / Relaxed', role: 'Suporte Robusto (Bulky Pivot)' };
}
