/**
 * Efeito de cada natureza, no formato curto que jogador de VGC lê.
 *
 * Mostrar só "Modest" obriga quem lê a lembrar de cor qual stat sobe e qual
 * desce. "Modest +SpA / −Atk" resolve isso sem ocupar mais que uma linha.
 */
const NATURE_EFFECT: Record<string, { up: string; down: string }> = {
  lonely: { up: 'Atk', down: 'Def' },
  brave: { up: 'Atk', down: 'Spe' },
  adamant: { up: 'Atk', down: 'SpA' },
  naughty: { up: 'Atk', down: 'SpD' },
  bold: { up: 'Def', down: 'Atk' },
  relaxed: { up: 'Def', down: 'Spe' },
  impish: { up: 'Def', down: 'SpA' },
  lax: { up: 'Def', down: 'SpD' },
  timid: { up: 'Spe', down: 'Atk' },
  hasty: { up: 'Spe', down: 'Def' },
  jolly: { up: 'Spe', down: 'SpA' },
  naive: { up: 'Spe', down: 'SpD' },
  modest: { up: 'SpA', down: 'Atk' },
  mild: { up: 'SpA', down: 'Def' },
  quiet: { up: 'SpA', down: 'Spe' },
  rash: { up: 'SpA', down: 'SpD' },
  calm: { up: 'SpD', down: 'Atk' },
  gentle: { up: 'SpD', down: 'Def' },
  sassy: { up: 'SpD', down: 'Spe' },
  careful: { up: 'SpD', down: 'SpA' },
};

/** Naturezas neutras: sobem e descem o mesmo stat, logo não alteram nada. */
const NEUTRAL_NATURES = new Set(['hardy', 'docile', 'serious', 'bashful', 'quirky']);

/**
 * Retorna "+SpA / −Atk" para uma natureza, ou null quando ela é neutra ou
 * desconhecida — nesse caso o chamador simplesmente não mostra nada, em vez de
 * inventar um efeito.
 */
export function getNatureEffect(nature: string | undefined | null): string | null {
  if (!nature) return null;
  const key = nature.trim().toLowerCase();
  if (NEUTRAL_NATURES.has(key)) return null;
  const effect = NATURE_EFFECT[key];
  return effect ? `+${effect.up} / −${effect.down}` : null;
}
