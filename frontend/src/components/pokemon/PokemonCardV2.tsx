import { useState } from 'react';
import type { Locale } from '../../i18n/equinoxI18n';
import { translateContent } from '../../i18n/equinoxI18n';
import { getNextPokemonSpriteUrl, getPokemonSpriteUrl } from '../../utils/pokemonSprites';
import type { SuggestedPokemon } from '../../types/equinox';

interface PokemonCardV2Props {
  pokemon: SuggestedPokemon;
  sprite: string | null;
  smogonUrl: string;
  locale: Locale;
}

export const getMoveTypeColor = (moveName: string): { bg: string; text: string } => {
  const name = moveName.toLowerCase();
  if (name.includes('fire') || name.includes('flare') || name.includes('heat') || name.includes('flame') || name.includes('blitz') || name.includes('wave')) return { bg: '#F08030', text: '#FFFFFF' };
  if (name.includes('water') || name.includes('surf') || name.includes('hydro') || name.includes('aqua') || name.includes('scald') || name.includes('surging') || name.includes('gem')) return { bg: '#6890F0', text: '#FFFFFF' };
  if (name.includes('grass') || name.includes('leaf') || name.includes('wood') || name.includes('spore') || name.includes('seed') || name.includes('grassy')) return { bg: '#78C850', text: '#000000' };
  if (name.includes('electric') || name.includes('bolt') || name.includes('thunder') || name.includes('volt') || name.includes('discharge')) return { bg: '#F8D030', text: '#000000' };
  if (name.includes('psychic') || name.includes('psyshock') || name.includes('future') || name.includes('zen') || name.includes('expanding')) return { bg: '#F85888', text: '#FFFFFF' };
  if (name.includes('ice') || name.includes('blizzard') || name.includes('freeze') || name.includes('icy') || name.includes('cold')) return { bg: '#98D8D8', text: '#000000' };
  if (name.includes('dragon') || name.includes('draco') || name.includes('outrage') || name.includes('pulse')) return { bg: '#7038F8', text: '#FFFFFF' };
  if (name.includes('dark') || name.includes('knock') || name.includes('foul') || name.includes('snarl') || name.includes('sucker') || name.includes('parting') || name.includes('shadow')) return { bg: '#705848', text: '#FFFFFF' };
  if (name.includes('fairy') || name.includes('moon') || name.includes('dazzling') || name.includes('play') || name.includes('gleam') || name.includes('fake out')) return { bg: '#EE99AC', text: '#000000' };
  if (name.includes('steel') || name.includes('iron') || name.includes('flash') || name.includes('make it') || name.includes('meteor') || name.includes('heavy')) return { bg: '#B7B7CE', text: '#000000' };
  if (name.includes('ghost') || name.includes('curse') || name.includes('hex') || name.includes('ball')) return { bg: '#705898', text: '#FFFFFF' };
  if (name.includes('fight') || name.includes('close') || name.includes('combat') || name.includes('body') || name.includes('aura') || name.includes('mach')) return { bg: '#C03028', text: '#FFFFFF' };
  if (name.includes('poison') || name.includes('sludge') || name.includes('toxic') || name.includes('gunk')) return { bg: '#A040A0', text: '#FFFFFF' };
  if (name.includes('ground') || name.includes('earth') || name.includes('horsepower') || name.includes('stomping')) return { bg: '#E0C068', text: '#000000' };
  if (name.includes('fly') || name.includes('air') || name.includes('brave') || name.includes('hurricane') || name.includes('roost')) return { bg: '#A890F0', text: '#FFFFFF' };
  if (name.includes('bug') || name.includes('u-turn') || name.includes('pounce') || name.includes('struggle')) return { bg: '#A8B820', text: '#000000' };
  if (name.includes('rock') || name.includes('stone') || name.includes('ancient')) return { bg: '#B8A038', text: '#FFFFFF' };
  return { bg: '#444748', text: '#FFFFFF' };
};

export function PokemonCardV2({ pokemon, sprite, smogonUrl, locale }: PokemonCardV2Props) {
  const [copied, setCopied] = useState(false);
  const insight = pokemon.battleInsight;
  const roleLabel = translateContent(insight?.practicalRole ?? pokemon.kit.role, locale);
  const abilityName = pokemon.ability || pokemon.kit.ability || '—';
  const itemName = pokemon.item || pokemon.kit.item || '—';
  const natureName = pokemon.kit.nature || '—';
  const moves = pokemon.moves && pokemon.moves.length > 0 ? pokemon.moves : ['—', '—', '—', '—'];
  const spriteSrc = sprite || getPokemonSpriteUrl(pokemon.name);

  const handleCopyShowdown = () => {
    const lines = [
      `${pokemon.name} @ ${itemName}`,
      `Ability: ${abilityName}`,
      `Nature: ${natureName}`,
      ...moves.map(m => `- ${m}`),
    ].join('\n');

    navigator.clipboard.writeText(lines);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="glass-panel hard-shadow p-4 rounded-2xl flex flex-col h-full bg-[#102034]/30 border border-[#27272A] hover:border-white transition-all">
      {/* Header: Role & Dex Number */}
      <div className="flex justify-between items-center mb-2">
        <span className="bg-white text-[#031427] text-[9px] font-bold px-2 py-0.5 tracking-tighter uppercase rounded-sm">
          {roleLabel}
        </span>
        <a
          href={smogonUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-[#8e9192] hover:text-white transition-colors font-mono uppercase tracking-wider"
        >
          Smogon ↗
        </a>
      </div>

      {/* Sprite Container */}
      <div className="flex justify-center py-4 bg-[#0b1c30]/50 mb-3 relative overflow-hidden rounded-xl border border-[#444748]/30">
        {spriteSrc ? (
          <img
            alt={pokemon.name}
            className="w-20 h-20 pokemon-sprite object-contain"
            src={spriteSrc}
            onError={e => {
              e.currentTarget.src = getNextPokemonSpriteUrl(pokemon.name, e.currentTarget.src);
            }}
          />
        ) : (
          <div className="w-20 h-20 flex items-center justify-center text-white/40 font-bold text-2xl">?</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#031427]/40 to-transparent pointer-events-none"></div>
      </div>

      {/* Identity & Gear */}
      <div className="mb-3">
        <h3 className="text-lg font-bold text-white tracking-tight">{pokemon.name}</h3>
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

      {/* Moveset Type Pills */}
      <div className="flex flex-wrap gap-1 mb-4 mt-auto">
        {moves.slice(0, 4).map((move, idx) => {
          const style = getMoveTypeColor(move);
          return (
            <span
              key={idx}
              className="type-pill"
              style={{ backgroundColor: style.bg, color: style.text }}
            >
              {move}
            </span>
          );
        })}
      </div>

      {/* Copy Paste Button */}
      <button
        type="button"
        onClick={handleCopyShowdown}
        className={`mt-auto w-full py-2 border transition-all text-[11px] font-bold uppercase tracking-wider rounded-lg ${
          copied
            ? 'bg-white text-[#031427] border-white'
            : 'border-[#8e9192]/30 text-white hover:border-white hover:bg-white hover:text-[#031427]'
        }`}
      >
        {copied ? (locale === 'pt-BR' ? 'COPIADO!' : 'COPIED!') : (locale === 'pt-BR' ? 'COPIAR SET (SHOWDOWN)' : 'PASTE SET')}
      </button>
    </div>
  );
}
