import { normalizePokemonType } from './pokemonTypeColors';

/**
 * Tabela de tipos defensiva completa (Gen 6+).
 *
 * Para cada tipo ATACANTE, quais tipos defensores recebem 2x, 0.5x e 0x.
 * Escrita nessa direção porque é como a tabela é consultada aqui: dado um
 * tipo de ataque, quanto ele machuca cada membro do time.
 */
const TYPE_CHART: Record<string, { x2: string[]; x05: string[]; x0: string[] }> = {
  normal: { x2: [], x05: ['rock', 'steel'], x0: ['ghost'] },
  fire: { x2: ['grass', 'ice', 'bug', 'steel'], x05: ['fire', 'water', 'rock', 'dragon'], x0: [] },
  water: { x2: ['fire', 'ground', 'rock'], x05: ['water', 'grass', 'dragon'], x0: [] },
  electric: { x2: ['water', 'flying'], x05: ['electric', 'grass', 'dragon'], x0: ['ground'] },
  grass: { x2: ['water', 'ground', 'rock'], x05: ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel'], x0: [] },
  ice: { x2: ['grass', 'ground', 'flying', 'dragon'], x05: ['fire', 'water', 'ice', 'steel'], x0: [] },
  fighting: { x2: ['normal', 'ice', 'rock', 'dark', 'steel'], x05: ['poison', 'flying', 'psychic', 'bug', 'fairy'], x0: ['ghost'] },
  poison: { x2: ['grass', 'fairy'], x05: ['poison', 'ground', 'rock', 'ghost'], x0: ['steel'] },
  ground: { x2: ['fire', 'electric', 'poison', 'rock', 'steel'], x05: ['grass', 'bug'], x0: ['flying'] },
  flying: { x2: ['grass', 'fighting', 'bug'], x05: ['electric', 'rock', 'steel'], x0: [] },
  psychic: { x2: ['fighting', 'poison'], x05: ['psychic', 'steel'], x0: ['dark'] },
  bug: { x2: ['grass', 'psychic', 'dark'], x05: ['fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy'], x0: [] },
  rock: { x2: ['fire', 'ice', 'flying', 'bug'], x05: ['fighting', 'ground', 'steel'], x0: [] },
  ghost: { x2: ['psychic', 'ghost'], x05: ['dark'], x0: ['normal'] },
  dragon: { x2: ['dragon'], x05: ['steel'], x0: ['fairy'] },
  dark: { x2: ['psychic', 'ghost'], x05: ['fighting', 'dark', 'fairy'], x0: [] },
  steel: { x2: ['ice', 'rock', 'fairy'], x05: ['fire', 'water', 'electric', 'steel'], x0: [] },
  fairy: { x2: ['fighting', 'dragon', 'dark'], x05: ['fire', 'poison', 'steel'], x0: [] },
};

export const ALL_POKEMON_TYPES = Object.keys(TYPE_CHART);

/**
 * Habilidades que anulam um tipo inteiro.
 *
 * Sem isto o gráfico mente: um time com Hydreigon (Levitate) apareceria como
 * tendo uma fraqueza a Terra que ele simplesmente não tem.
 */
const ABILITY_TYPE_IMMUNITY: Record<string, string[]> = {
  levitate: ['ground'],
  'earth eater': ['ground'],
  'flash fire': ['fire'],
  'well-baked body': ['fire'],
  'water absorb': ['water'],
  'storm drain': ['water'],
  'dry skin': ['water'],
  'volt absorb': ['electric'],
  'lightning rod': ['electric'],
  'motor drive': ['electric'],
  'sap sipper': ['grass'],
};

export interface TypeMatchupMember {
  name: string;
  types: string[];
  ability?: string;
}

export interface MemberEffectiveness {
  member: TypeMatchupMember;
  multiplier: number;
}

export interface TypeMatchupRow {
  type: string;
  weak: MemberEffectiveness[];
  resists: MemberEffectiveness[];
  immune: MemberEffectiveness[];
  neutral: MemberEffectiveness[];
  /** Soma dos multiplicadores dos membros fracos — usada para ordenar por severidade. */
  pressure: number;
}

/** Multiplicador de um tipo de ataque contra um membro, considerando a habilidade. */
export function getTypeEffectiveness(attackingType: string, member: TypeMatchupMember): number {
  const attacking = normalizePokemonType(attackingType);
  if (!attacking) return 1;

  const immunities = ABILITY_TYPE_IMMUNITY[(member.ability ?? '').trim().toLowerCase()] ?? [];
  if (immunities.includes(attacking)) return 0;

  const row = TYPE_CHART[attacking];
  let multiplier = 1;

  for (const rawType of member.types) {
    const defending = normalizePokemonType(rawType);
    if (!defending) continue;
    if (row.x0.includes(defending)) return 0;
    if (row.x2.includes(defending)) multiplier *= 2;
    else if (row.x05.includes(defending)) multiplier *= 0.5;
  }

  return multiplier;
}

/**
 * Cruza os 18 tipos de ataque contra o time inteiro.
 *
 * O retorno vem ordenado por severidade (quem mais machuca primeiro) em vez de
 * alfabeticamente: a ordem passa a carregar informação, que é o ponto de existir
 * um gráfico em vez de uma lista.
 */
export function getTeamTypeMatchup(members: TypeMatchupMember[]): TypeMatchupRow[] {
  const usable = members.filter(member => member.types.some(type => normalizePokemonType(type)));

  const rows = ALL_POKEMON_TYPES.map<TypeMatchupRow>(type => {
    const weak: MemberEffectiveness[] = [];
    const resists: MemberEffectiveness[] = [];
    const immune: MemberEffectiveness[] = [];
    const neutral: MemberEffectiveness[] = [];

    for (const member of usable) {
      const multiplier = getTypeEffectiveness(type, member);
      const entry = { member, multiplier };
      if (multiplier === 0) immune.push(entry);
      else if (multiplier > 1) weak.push(entry);
      else if (multiplier < 1) resists.push(entry);
      else neutral.push(entry);
    }

    weak.sort((a, b) => b.multiplier - a.multiplier);

    return {
      type,
      weak,
      resists,
      immune,
      neutral,
      pressure: weak.reduce((total, entry) => total + entry.multiplier, 0),
    };
  });

  return rows.sort((a, b) => b.pressure - a.pressure || b.weak.length - a.weak.length || a.type.localeCompare(b.type));
}

/** Rótulo curto do multiplicador, no formato que jogador de VGC lê. */
export function formatMultiplier(multiplier: number): string {
  if (multiplier === 0) return '×0';
  if (multiplier === 0.25) return '×¼';
  if (multiplier === 0.5) return '×½';
  if (multiplier === 1) return '×1';
  return `×${multiplier}`;
}
