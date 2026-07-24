import React, { useState } from 'react';
import { Clipboard, Check } from 'lucide-react';
import type { Locale } from '../../i18n/equinoxI18n';
import type { PokemonData } from '../../types/lead';
import { getPokemonSpriteUrl } from '../../utils/pokemonSprites';
import { toShowdown } from '../../utils/competitiveTeamExport';
import { getMoveTypeColor } from './PokemonCardV2';

interface CompetitiveTeamGridProps {
  team: PokemonData[];
  leadNames?: [string, string];
  locale: Locale;
}

export const CompetitiveTeamGrid: React.FC<CompetitiveTeamGridProps> = ({ team, leadNames, locale }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopySingle = (member: PokemonData, index: number) => {
    const text = toShowdown([member]);
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <section className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {team.map((member, idx) => {
          const set = member.competitiveSet;
          const isLead = leadNames?.some(name => name === member.name) ?? false;
          const moves = (set?.moves ?? member.moves ?? ['—', '—', '—', '—']).slice(0, 4);
          const abilityName = set?.ability ?? member.ability ?? '—';
          const itemName = set?.item ?? member.item ?? '—';
          const natureName = set?.nature ?? member.nature ?? '—';
          const roleName = isLead
            ? (locale === 'pt-BR' ? 'Lead / Opener' : 'Lead / Opener')
            : (set?.role ?? member.role ?? (locale === 'pt-BR' ? 'Sweeper / Support' : 'Sweeper / Support'));

          const spriteUrl = getPokemonSpriteUrl(member.name);

          return (
            <div
              key={member.name + idx}
              className="glass-panel hard-shadow p-4 rounded-2xl flex flex-col h-full bg-[#102034]/30 border border-[#27272A] hover:border-white transition-all"
            >
              {/* Header: Role & Number */}
              <div className="flex justify-between items-center mb-2">
                <span className="bg-white text-[#031427] text-[9px] font-bold px-2 py-0.5 tracking-tighter uppercase rounded-sm">
                  {roleName}
                </span>
                <span className="text-[10px] text-[#8e9192] font-mono">
                  #{String(idx + 1).padStart(2, '0')}
                </span>
              </div>

              {/* Sprite Container */}
              <div className="flex justify-center py-4 bg-[#0b1c30]/50 mb-3 relative overflow-hidden rounded-xl border border-[#444748]/30">
                <img
                  alt={member.name}
                  className="w-20 h-20 pokemon-sprite object-contain"
                  src={spriteUrl ?? 'https://play.pokemonshowdown.com/sprites/ani/unown.gif'}
                  onError={e => {
                    (e.target as HTMLImageElement).src = 'https://play.pokemonshowdown.com/sprites/ani/unown.gif';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#031427]/40 to-transparent pointer-events-none"></div>
              </div>

              {/* Identity & Details */}
              <div className="mb-3">
                <h3 className="text-lg font-bold text-white tracking-tight">{member.name}</h3>
                <div className="grid grid-cols-2 gap-x-2 mt-1">
                  <span className="text-[11px] text-[#c4c7c8] font-medium truncate" title={`Item: ${itemName}`}>
                    {itemName}
                  </span>
                  <span className="text-[11px] text-[#c4c7c8] text-right font-medium">
                    {natureName}
                  </span>
                </div>
                <div className="text-[10px] text-[#8e9192] mt-0.5">
                  {locale === 'pt-BR' ? 'Habilidade' : 'Ability'}: <strong className="text-white">{abilityName}</strong>
                </div>
              </div>

              {/* Move Pills */}
              <div className="flex flex-wrap gap-1 mb-4 mt-auto">
                {moves.map((move, moveIdx) => {
                  const style = getMoveTypeColor(move);
                  return (
                    <span
                      key={moveIdx}
                      className="type-pill"
                      style={{ backgroundColor: style.bg, color: style.text }}
                    >
                      {move}
                    </span>
                  );
                })}
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => handleCopySingle(member, idx)}
                className={`mt-auto w-full py-2 border transition-all text-[11px] font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 ${
                  copiedIndex === idx
                    ? 'bg-white text-[#031427] border-white'
                    : 'border-[#8e9192]/30 text-white hover:border-white hover:bg-white hover:text-[#031427]'
                }`}
              >
                {copiedIndex === idx ? (
                  <>
                    <Check size={13} />
                    <span>{locale === 'pt-BR' ? 'COPIADO!' : 'COPIED!'}</span>
                  </>
                ) : (
                  <>
                    <Clipboard size={13} />
                    <span>{locale === 'pt-BR' ? 'COPIAR SET (SHOWDOWN)' : 'PASTE SET'}</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
