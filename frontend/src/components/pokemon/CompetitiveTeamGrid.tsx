import React from 'react';
import type { CSSProperties } from 'react';
import { Clipboard } from 'lucide-react';
import type { Locale } from '../../i18n/equinoxI18n';
import type { CompetitiveStatSpread, PokemonData } from '../../types/lead';
import { getNextPokemonSpriteUrl, getPokemonSpriteUrl } from '../../utils/pokemonSprites';
import { toShowdown } from '../../utils/competitiveTeamExport';
import { getPokemonTypeColor, getPokemonTypeLabel, getReadableTextOnType } from '../../utils/pokemonTypeColors';
import { getNatureEffect } from '../../utils/natures';

interface CompetitiveTeamGridProps {
  team: PokemonData[];
  leadNames?: [string, string];
  locale: Locale;
}

const STAT_LABELS: Array<[keyof CompetitiveStatSpread, string]> = [
  ['hp', 'HP'],
  ['atk', 'Atk'],
  ['def', 'Def'],
  ['spa', 'SpA'],
  ['spd', 'SpD'],
  ['spe', 'Spe'],
];

/** EVs: só os investidos importam. */
const formatEvs = (spread?: CompetitiveStatSpread): string => {
  if (!spread) return '';
  return STAT_LABELS.filter(([stat]) => Number(spread[stat]) > 0)
    .map(([stat, label]) => `${spread[stat]} ${label}`)
    .join(' / ');
};

/**
 * IVs: só os que DESVIAM de 31 importam.
 *
 * Filtrar por `> 0` (como o formatador de EVs faz) esconde justamente os IVs
 * que existem para alguma coisa — 0 Spe em Trick Room, 0 Atk em atacante
 * especial. É a mesma regra que o exportador para Showdown já usa.
 */
const formatIvs = (spread?: CompetitiveStatSpread): string => {
  if (!spread) return '';
  return STAT_LABELS.filter(([stat]) => Number(spread[stat]) !== 31)
    .map(([stat, label]) => `${spread[stat]} ${label}`)
    .join(' / ');
};

export const CompetitiveTeamGrid: React.FC<CompetitiveTeamGridProps> = ({ team, leadNames, locale }) => {
  return (
    <section className="eq-competitive-team">
      <div className="eq-competitive-team__grid">
        {team.map(member => {
          const set = member.competitiveSet;
          const isLead = leadNames?.some(name => name === member.name) ?? false;

          const typeEntries = ((set?.types ?? member.types) ?? [])
            .map(type => ({ type, color: getPokemonTypeColor(type) }))
            .filter((entry): entry is { type: string; color: string } => entry.color !== null);

          const nature = set?.nature ?? member.nature;
          const natureEffect = getNatureEffect(nature);
          const moves = set?.moves ?? member.moves ?? [];
          const evs = formatEvs(set?.evs);
          const ivs = formatIvs(set?.ivs);
          const sprite = getPokemonSpriteUrl(member.name);

          const accent = typeEntries[0]?.color;
          const rail = typeEntries.length
            ? `linear-gradient(90deg, ${typeEntries[0].color}, ${(typeEntries[1] ?? typeEntries[0]).color})`
            : 'var(--eq-border-strong)';

          return (
            <article
              key={member.name}
              className={`eq-set-card ${isLead ? 'is-lead' : ''}`}
              style={accent ? ({ '--eq-card-accent': accent } as CSSProperties) : undefined}
            >
              <span className="eq-set-card-rail" style={{ background: rail }} aria-hidden="true" />

              <div className="eq-set-card-head">
                {isLead && <span className="eq-set-card-lead">Lead</span>}
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
                    alt={member.name}
                    loading="lazy"
                    onError={event => {
                      event.currentTarget.src = getNextPokemonSpriteUrl(member.name, event.currentTarget.src);
                    }}
                  />
                )}
              </div>

              <div className="eq-set-card-id">
                <span className="eq-set-card-name">{member.name}</span>
                {(set?.role ?? member.role) && (
                  <span className="eq-set-card-role">{set?.role ?? member.role}</span>
                )}
              </div>

              <dl className="eq-set-card-spec">
                <div>
                  <dt>{locale === 'pt-BR' ? 'Hab' : 'Abil'}</dt>
                  <dd>{set?.ability ?? member.ability ?? '—'}</dd>
                </div>
                <div>
                  <dt>Item</dt>
                  <dd>{set?.item ?? member.item ?? '—'}</dd>
                </div>
                <div>
                  <dt>Nat</dt>
                  <dd>
                    {nature ?? '—'}
                    {natureEffect && <span className="eq-dim"> {natureEffect}</span>}
                  </dd>
                </div>
                {set?.teraType && (
                  <div>
                    <dt>Tera</dt>
                    <dd>{getPokemonTypeLabel(set.teraType, locale)}</dd>
                  </div>
                )}
              </dl>

              {moves.length > 0 && (
                <ul className="eq-set-card-moves">
                  {moves.slice(0, 4).map(move => (
                    <li key={move}>{move}</li>
                  ))}
                </ul>
              )}

              <div className="eq-set-card-stats">
                <span>EVs <b>{evs || '—'}</b></span>
                <span>IVs <b>{ivs || (locale === 'pt-BR' ? '31 em tudo' : 'all 31')}</b></span>
              </div>

              <footer className="eq-set-card-footer">
                <button
                  type="button"
                  className="eq-inline-action"
                  onClick={() => navigator.clipboard.writeText(toShowdown([member]))}
                >
                  <Clipboard size={11} aria-hidden="true" />
                  {locale === 'pt-BR' ? 'Copiar set' : 'Copy set'}
                </button>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
};
