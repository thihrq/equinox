import type { Locale } from '../../i18n/equinoxI18n';
import type { SuggestedPokemon } from '../../types/equinox';
import { PokemonCardV2 } from './PokemonCardV2';

interface PokemonGridProps {
  pokemons: SuggestedPokemon[];
  locale: Locale;
  getSpriteUrl: (name: string) => string | null;
  getSmogonUrl: (name: string) => string;
}

export function PokemonGrid({ pokemons, locale, getSpriteUrl, getSmogonUrl }: PokemonGridProps) {
  return (
    <section className="eq-pokemon-grid-v3">
      {pokemons.map(pokemon => (
        <PokemonCardV2
          key={pokemon.name}
          pokemon={pokemon}
          locale={locale}
          sprite={getSpriteUrl(pokemon.name)}
          smogonUrl={getSmogonUrl(pokemon.name)}
        />
      ))}
    </section>
  );
}
