import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Clipboard } from 'lucide-react';
import type { Locale } from '../../i18n/equinoxI18n';
import type { CompetitiveStatSpread, PokemonData } from '../../types/lead';
import { getPokemonSpriteUrl } from '../../utils/pokemonSprites';
import { toShowdown } from '../../utils/competitiveTeamExport';

interface CompetitiveTeamGridProps {
  team: PokemonData[];
  leadNames?: [string, string];
  locale: Locale;
}

const formatSpread = (spread?: CompetitiveStatSpread): string => {
  if (!spread) return '';
  const entries: Array<[keyof CompetitiveStatSpread, string]> = [
    ['hp', 'HP'],
    ['atk', 'Atk'],
    ['def', 'Def'],
    ['spa', 'SpA'],
    ['spd', 'SpD'],
    ['spe', 'Spe'],
  ];
  return entries
    .filter(([stat]) => Number(spread[stat]) > 0)
    .map(([stat, label]) => `${spread[stat]} ${label}`)
    .join(' / ');
};

export const CompetitiveTeamGrid: React.FC<CompetitiveTeamGridProps> = ({ team, leadNames, locale }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const allExpanded = team.every(member => expanded.has(member.name));

  const toggle = (name: string) => {
    setExpanded(current => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAll = () => {
    setExpanded(allExpanded ? new Set() : new Set(team.map(member => member.name)));
  };

  return (
    <section className="eq-competitive-team">
      <div className="eq-competitive-team__toolbar">
        <button type="button" className="eq-inline-action" onClick={toggleAll}>
          {allExpanded
            ? (locale === 'pt-BR' ? 'Recolher todos' : 'Collapse all')
            : (locale === 'pt-BR' ? 'Expandir todos' : 'Expand all')}
        </button>
      </div>

      <div className="eq-competitive-team__grid">
        {team.map(member => {
          const set = member.competitiveSet;
          const isLead = leadNames?.some(name => name === member.name) ?? false;
          const isExpanded = expanded.has(member.name);

          return (
            <article key={member.name} className={`eq-pokemon-card-v3 eq-competitive-set-card ${isLead ? 'eq-pokemon-card-v3--lead' : ''}`}>
              <button
                type="button"
                className="eq-competitive-set-card__summary"
                onClick={() => toggle(member.name)}
                aria-expanded={isExpanded}
              >
                {isLead && <span className="eq-tag-v3 eq-tag-v3--primary">Lead</span>}
                <img
                  src={getPokemonSpriteUrl(member.name) ?? undefined}
                  alt=""
                  className="eq-competitive-set-card__sprite"
                  onError={event => {
                    (event.target as HTMLImageElement).src = 'https://play.pokemonshowdown.com/sprites/ani/unown.gif';
                  }}
                />
                <span className="eq-competitive-set-card__name">{member.name}</span>
                <span className="eq-competitive-set-card__meta">{set?.item ?? member.item}</span>
                <span className="eq-competitive-set-card__meta">{set?.ability ?? member.ability}</span>
                {isExpanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
              </button>

              {isExpanded && (
                <div className="eq-competitive-set-card__details">
                  <dl>
                    <div><dt>{locale === 'pt-BR' ? 'Função' : 'Role'}</dt><dd>{set?.role ?? member.role ?? '-'}</dd></div>
                    <div><dt>{locale === 'pt-BR' ? 'Natureza' : 'Nature'}</dt><dd>{set?.nature ?? member.nature ?? '-'}</dd></div>
                    <div><dt>EVs</dt><dd>{formatSpread(set?.evs) || '-'}</dd></div>
                    <div><dt>IVs</dt><dd>{formatSpread(set?.ivs) || '31 em todos'}</dd></div>
                    <div><dt>{locale === 'pt-BR' ? 'Origem' : 'Source'}</dt><dd>{set?.setSource ?? '-'}</dd></div>
                  </dl>
                  <ul className="eq-competitive-set-card__moves">
                    {(set?.moves ?? member.moves ?? []).map(move => <li key={move}>{move}</li>)}
                  </ul>
                  <button type="button" className="eq-inline-action" onClick={() => navigator.clipboard.writeText(toShowdown([member]))}>
                    <Clipboard size={14} aria-hidden="true" />
                    {locale === 'pt-BR' ? 'Copiar set' : 'Copy set'}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};
