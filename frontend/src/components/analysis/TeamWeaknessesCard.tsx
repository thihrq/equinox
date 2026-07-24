import React from 'react';
import type { Locale } from '../../i18n/equinoxI18n';
import type { PokemonData } from '../../types/lead';
import { calculateTeamWeaknesses, ALL_TYPES } from '../../utils/pokemonTypes';

interface TeamWeaknessesCardProps {
  team: PokemonData[];
  locale: Locale;
}

const TYPE_SHORT_CODES: Record<string, string> = {
  Normal: 'NRM',
  Fire: 'FIR',
  Water: 'WTR',
  Electric: 'ELC',
  Grass: 'GRS',
  Ice: 'ICE',
  Fighting: 'FGT',
  Poison: 'PSN',
  Ground: 'GRD',
  Flying: 'FLY',
  Psychic: 'PSY',
  Bug: 'BUG',
  Rock: 'RCK',
  Ghost: 'GST',
  Dragon: 'DRG',
  Dark: 'DRK',
  Steel: 'STL',
  Fairy: 'FAY',
};

const TYPE_COLORS: Record<string, string> = {
  Normal: '#A8A878',
  Fire: '#F08030',
  Water: '#6890F0',
  Electric: '#F8D030',
  Grass: '#78C850',
  Ice: '#98D8D8',
  Fighting: '#C03028',
  Poison: '#A040A0',
  Ground: '#E0C068',
  Flying: '#A890F0',
  Psychic: '#F85888',
  Bug: '#A8B820',
  Rock: '#B8A038',
  Ghost: '#705898',
  Dragon: '#7038F8',
  Dark: '#705848',
  Steel: '#B7B7CE',
  Fairy: '#EE99AC',
};

export const TeamWeaknessesCard: React.FC<TeamWeaknessesCardProps> = ({ team, locale }) => {
  // Extrai os tipos reais de cada um dos 6 Pokémon do time
  const teamTypes = team.map(member => (member.types && member.types.length ? member.types : ['Normal']));

  // Calcula matriz real de 18 tipos elementais
  const analysis = calculateTeamWeaknesses(teamTypes);

  // Ordena os maiores riscos
  const highRiskTypes = ALL_TYPES.filter(t => analysis[t].weakCount >= 2 || analysis[t].doubleWeakCount > 0).sort(
    (a, b) => analysis[b].highestMultiplier - analysis[a].highestMultiplier || analysis[b].weakCount - analysis[a].weakCount
  );

  return (
    <div className="bg-[#102034]/40 p-5 border border-[#444748]/50 rounded-xl">
      <h3 className="text-xs font-bold text-white mb-4 uppercase tracking-widest flex items-center justify-between">
        <span>{locale === 'pt-BR' ? 'Fraquezas Elementais do Time' : 'Team Weaknesses'}</span>
        <span className="text-[10px] text-[#8e9192] font-mono">18 TYPES</span>
      </h3>

      <div className="grid grid-cols-6 gap-1.5">
        {ALL_TYPES.map(type => {
          const item = analysis[type];
          const code = TYPE_SHORT_CODES[type] || type.slice(0, 3).toUpperCase();
          const color = TYPE_COLORS[type] || '#8e9192';

          const isDarkText = type === 'Normal' || type === 'Electric' || type === 'Grass' || type === 'Ice' || type === 'Ground' || type === 'Steel';

          let displayLabel = '—';
          let textColor = 'text-[#8e9192]';

          if (item.doubleWeakCount > 0) {
            displayLabel = '4x';
            textColor = 'text-red-400 font-extrabold';
          } else if (item.weakCount >= 3) {
            displayLabel = `${item.weakCount}x`;
            textColor = 'text-red-400 font-bold';
          } else if (item.weakCount >= 1) {
            displayLabel = `${item.weakCount}x`;
            textColor = 'text-amber-300 font-semibold';
          } else if (item.immuneCount > 0) {
            displayLabel = '0x';
            textColor = 'text-emerald-400 font-bold';
          }

          return (
            <div key={type} className="flex flex-col items-center gap-1">
              <span
                className="w-full py-1 text-center text-[9px] font-bold rounded uppercase tracking-wider"
                style={{ backgroundColor: color, color: isDarkText ? '#000000' : '#FFFFFF' }}
              >
                {code}
              </span>
              <span className={`text-[10px] ${textColor}`}>{displayLabel}</span>
            </div>
          );
        })}
      </div>

      {highRiskTypes.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#444748]/30 text-[11px] text-[#c4c7c8] space-y-1">
          {highRiskTypes.slice(0, 2).map(type => {
            const item = analysis[type];
            return (
              <p key={type} className="italic text-amber-300">
                ⚠️ {locale === 'pt-BR' ? `Atenção:` : `Alert:`} {item.weakCount} {locale === 'pt-BR' ? 'membros vulneráveis a golpes do tipo' : 'members weak to'}{' '}
                <strong>{type}</strong> {item.doubleWeakCount > 0 ? '(4x fraqueza dupla)' : ''}.
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
};
