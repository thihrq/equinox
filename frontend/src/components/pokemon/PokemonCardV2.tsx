import type { CSSProperties } from 'react';
import { ExternalLink } from 'lucide-react';
import type { Locale } from '../../i18n/equinoxI18n';
import { t, translateContent } from '../../i18n/equinoxI18n';
import { getNextPokemonSpriteUrl } from '../../utils/pokemonSprites';
import { getPokemonTypeColor } from '../../utils/pokemonTypeColors';
import type { SuggestedPokemon } from '../../types/equinox';

const hexToRgba = (hex: string, alpha: number): string => {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

interface PokemonCardV2Props {
  pokemon: SuggestedPokemon;
  sprite: string | null;
  smogonUrl: string;
  locale: Locale;
}

export function PokemonCardV2({ pokemon, sprite, smogonUrl, locale }: PokemonCardV2Props) {
  const insight = pokemon.battleInsight;
  const highlights = [
    ...(insight?.offers ?? []),
    ...(insight?.pressures ?? []),
  ].slice(0, 3);
  const typeColors = (pokemon.types ?? [])
    .map(type => ({ type, color: getPokemonTypeColor(type) }))
    .filter((entry): entry is { type: string; color: string } => entry.color !== null);
  const accentColor = typeColors[0]?.color;

  return (
    <article
      className="eq-pokemon-card-v3"
      style={accentColor ? ({ '--eq-type-accent': accentColor } as CSSProperties) : undefined}
    >
      <div className="eq-pokemon-card-art">
        {sprite ? (
          <img
            src={sprite}
            alt={pokemon.name}
            onError={event => {
              event.currentTarget.src = getNextPokemonSpriteUrl(pokemon.name, event.currentTarget.src);
            }}
          />
        ) : (
          <span>?</span>
        )}
      </div>

      <div className="eq-pokemon-card-body">
        <span className="eq-pokemon-role-label">{translateContent(insight?.practicalRole ?? pokemon.kit.role, locale)}</span>
        <h3>{pokemon.name}</h3>
        {typeColors.length > 0 && (
          <div className="eq-type-pills">
            {typeColors.map(({ type, color }) => (
              <span key={type} className="eq-type-pill" style={{ background: hexToRgba(color, 0.18), color }}>
                {type}
              </span>
            ))}
          </div>
        )}
        <p>{translateContent(insight?.usageTip, locale) || `${pokemon.kit.nature} · ${translateContent(pokemon.kit.role, locale)}`}</p>

        <ul>
          {(highlights.length ? highlights : [pokemon.kit.nature, pokemon.kit.role]).slice(0, 3).map(item => (
            <li key={item}>{translateContent(item, locale)}</li>
          ))}
        </ul>

        <div className="eq-battle-kit-details" style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px dashed var(--eq-border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--eq-muted)', display: 'grid', gap: '3px' }}>
            <div><strong>{locale === 'pt-BR' ? 'Habilidade' : 'Ability'}:</strong> {pokemon.ability || pokemon.kit.ability || 'Nenhuma'}</div>
            <div><strong>{locale === 'pt-BR' ? 'Item' : 'Item'}:</strong> {pokemon.item || pokemon.kit.item || 'Nenhum'}</div>
            {pokemon.moves && pokemon.moves.length > 0 && (
              <div>
                <strong>{locale === 'pt-BR' ? 'Movimentos' : 'Moves'}:</strong> {pokemon.moves.join(' / ')}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="eq-pokemon-card-footer">
        <div className="eq-card-tags">
          <span>{translateContent(pokemon.kit.role, locale)}</span>
          <span>{pokemon.kit.nature}</span>
        </div>
        <a href={smogonUrl} target="_blank" rel="noopener noreferrer">
          {t(locale, 'smogon')} <ExternalLink size={12} />
        </a>
      </footer>
    </article>
  );
}
