import type { CSSProperties } from 'react';
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
 * Card de set, em formato de carta.
 *
 * Retrato estreito com a arte no topo: o Pokémon é reconhecido pela sprite
 * antes de qualquer leitura, e o time inteiro cabe numa tela. Mostra o
 * conjunto que o motor escolheu — habilidade, item, natureza com o efeito
 * explícito e os quatro golpes. EVs e IVs não aparecem aqui porque
 * `SuggestedPokemon` não os carrega; quem tem essa informação é o fluxo
 * competitivo, em CompetitiveTeamGrid.
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

  const accent = typeEntries[0]?.color;
  const rail = typeEntries.length
    ? `linear-gradient(90deg, ${typeEntries[0].color}, ${(typeEntries[1] ?? typeEntries[0]).color})`
    : 'var(--eq-border-strong)';

  return (
    <article
      className="eq-set-card"
      style={accent ? ({ '--eq-card-accent': accent } as CSSProperties) : undefined}
    >
      <span className="eq-set-card-rail" style={{ background: rail }} aria-hidden="true" />

      <div className="eq-set-card-head">
        {typeEntries.map(({ type, color }) => (
          <span
            key={type}
            className="eq-set-type-pill"
            style={{ background: color, color: getReadableTextOnType(color) }}
          >
            {getPokemonTypeLabel(type, locale)}
          </span>
        ))}
      </div>

      <div className="eq-set-card-art">
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
      </div>

      <div className="eq-set-card-id">
        <span className="eq-set-card-name">{pokemon.name}</span>
        <span className="eq-set-card-role">{role}</span>
      </div>

      <dl className="eq-set-card-spec">
        <div>
          <dt>{locale === 'pt-BR' ? 'Hab' : 'Abil'}</dt>
          <dd>{ability || '—'}</dd>
        </div>
        <div>
          <dt>Item</dt>
          <dd>{item || '—'}</dd>
        </div>
        <div>
          <dt>Nat</dt>
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

      <footer className="eq-set-card-footer">
        <a href={smogonUrl} target="_blank" rel="noopener noreferrer">
          {t(locale, 'smogon')} <ExternalLink size={11} aria-hidden="true" />
        </a>
      </footer>
    </article>
  );
}
