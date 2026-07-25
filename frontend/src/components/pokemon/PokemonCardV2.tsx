import { ExternalLink } from 'lucide-react';
import type { Locale } from '../../i18n/equinoxI18n';
import { t, translateContent } from '../../i18n/equinoxI18n';
import { getNextPokemonSpriteUrl } from '../../utils/pokemonSprites';
import { getPokemonTypeColor, getPokemonTypeLabel, getReadableTextOnType } from '../../utils/pokemonTypeColors';
import { getNatureEffect } from '../../utils/natures';
import type { SuggestedPokemon } from '../../types/equinox';

interface PokemonCardV2Props {
  pokemon: SuggestedPokemon;
  sprite: string | null;
  smogonUrl: string;
  locale: Locale;
}

/**
 * Card de set.
 *
 * Mostra o conjunto que o motor efetivamente escolheu — habilidade, item,
 * natureza (com o efeito explícito) e os quatro movimentos. EVs e IVs não
 * aparecem aqui porque `SuggestedPokemon` não os carrega; quem tem essa
 * informação é o fluxo competitivo, em CompetitiveTeamGrid.
 */
export function PokemonCardV2({ pokemon, sprite, smogonUrl, locale }: PokemonCardV2Props) {
  const insight = pokemon.battleInsight;
  const role = translateContent(insight?.practicalRole ?? pokemon.role ?? pokemon.kit.role, locale);

  const typeEntries = (pokemon.types ?? [])
    .map(type => ({ type, color: getPokemonTypeColor(type) }))
    .filter((entry): entry is { type: string; color: string } => entry.color !== null);

  const ability = pokemon.ability || pokemon.kit.ability;
  const item = pokemon.item || pokemon.kit.item;
  const nature = pokemon.nature || pokemon.kit.nature;
  const natureEffect = getNatureEffect(nature);
  const moves = pokemon.moves?.length ? pokemon.moves : pokemon.kit.moves ?? [];

  // O trilho superior carrega as cores dos tipos: identifica o Pokémon antes
  // mesmo da leitura do nome. Com um tipo só, o gradiente vira cor sólida.
  const rail = typeEntries.length
    ? `linear-gradient(90deg, ${typeEntries[0].color}, ${(typeEntries[1] ?? typeEntries[0]).color})`
    : 'var(--eq-border-strong)';

  return (
    <article className="eq-set-card">
      <span className="eq-set-card-rail" style={{ background: rail }} aria-hidden="true" />

      <div className="eq-set-card-body">
        <div className="eq-set-card-top">
          <span className="eq-set-card-art">
            {sprite && (
              <img
                src={sprite}
                alt={pokemon.name}
                loading="lazy"
                onError={event => {
                  event.currentTarget.src = getNextPokemonSpriteUrl(pokemon.name, event.currentTarget.src);
                }}
              />
            )}
          </span>
          <span>
            <span className="eq-set-card-name">{pokemon.name}</span>
            <span className="eq-set-card-role">{role}</span>
            {typeEntries.length > 0 && (
              <span className="eq-set-card-types">
                {typeEntries.map(({ type, color }) => (
                  <span
                    key={type}
                    className="eq-set-type-pill"
                    style={{ background: color, color: getReadableTextOnType(color) }}
                  >
                    {getPokemonTypeLabel(type, locale)}
                  </span>
                ))}
              </span>
            )}
          </span>
        </div>

        <span className="eq-set-card-divider" aria-hidden="true" />

        <dl className="eq-set-card-spec">
          <div>
            <dt>{locale === 'pt-BR' ? 'Hab.' : 'Ability'}</dt>
            <dd>{ability || '—'}</dd>
          </div>
          <div>
            <dt>{locale === 'pt-BR' ? 'Item' : 'Item'}</dt>
            <dd>{item || '—'}</dd>
          </div>
          <div>
            <dt>{locale === 'pt-BR' ? 'Nat.' : 'Nature'}</dt>
            <dd>
              {nature || '—'}
              {natureEffect && <span className="eq-dim"> {natureEffect}</span>}
            </dd>
          </div>
        </dl>

        {moves.length > 0 && (
          <ul className="eq-set-card-moves">
            {moves.slice(0, 4).map(move => (
              <li key={move}>{translateContent(move, locale)}</li>
            ))}
          </ul>
        )}
      </div>

      <footer className="eq-set-card-footer">
        <a href={smogonUrl} target="_blank" rel="noopener noreferrer">
          {t(locale, 'smogon')} <ExternalLink size={12} aria-hidden="true" />
        </a>
      </footer>
    </article>
  );
}
