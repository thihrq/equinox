import { Dex } from '@pkmn/dex';
import { PokemonData } from '../core/AnalysisContext';
import { getPokemonTypes, getVariant } from '../utils/PokemonUtils';

export interface CompetitiveStatSpread {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface CompetitiveSetValidation {
  legal: boolean;
  errors: string[];
  warnings: string[];
}

export type CompetitiveSetSource = 'user' | 'curated' | 'database' | 'generated' | 'v2-draft' | 'v2-reviewed' | 'v2-verified' | 'legacy' | 'unknown';

export interface CompetitivePokemonSet {
  name: string;
  types: string[];
  item: string;
  ability: string;
  nature: string;
  evs: CompetitiveStatSpread;
  ivs: CompetitiveStatSpread;
  moves: [string, string, string, string];
  role?: string;
  level?: number;
  teraType?: string;
  setId?: string;
  confidence?: number;
  status?: string;
  sourceType?: string;
  setSource: CompetitiveSetSource;
  validation: CompetitiveSetValidation;
}

const DEFAULT_IVS: CompetitiveStatSpread = {
  hp: 31,
  atk: 31,
  def: 31,
  spa: 31,
  spd: 31,
  spe: 31,
};

const normalize = (value?: string): string =>
  String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function clampStat(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function isPhysicalMove(moveName: string): boolean {
  const move = Dex.moves.get(moveName);
  return move.exists && move.category === 'Physical' && Number(move.basePower ?? 0) > 0;
}

function isSpecialMove(moveName: string): boolean {
  const move = Dex.moves.get(moveName);
  return move.exists && move.category === 'Special' && Number(move.basePower ?? 0) > 0;
}

function hasMove(pokemon: PokemonData, moveName: string): boolean {
  const target = normalize(moveName);
  return (pokemon.moves ?? []).some(move => normalize(move) === target);
}

function isTrickRoomPlan(pokemon: PokemonData): boolean {
  return hasMove(pokemon, 'Trick Room') ||
    /trick room|slow|semiroom/i.test(`${pokemon.role ?? ''} ${(pokemon.competitive?.teamStyles ?? []).join(' ')}`);
}

function getOffenseProfile(pokemon: PokemonData, format: string): 'physical' | 'special' | 'mixed' | 'support' {
  const moves = pokemon.moves ?? [];
  const physicalMoves = moves.filter(isPhysicalMove).length;
  const specialMoves = moves.filter(isSpecialMove).length;
  if (physicalMoves > 0 && specialMoves > 0) return 'mixed';
  if (physicalMoves > 0) return 'physical';
  if (specialMoves > 0) return 'special';

  const stats = getVariant(pokemon, format)?.baseStats;
  const atk = Number(stats?.atk ?? 80);
  const spa = Number(stats?.spa ?? 80);
  if (Math.max(atk, spa) < 95) return 'support';
  return atk >= spa ? 'physical' : 'special';
}

function chooseNature(pokemon: PokemonData, format: string): string {
  const existing = String(pokemon.nature ?? '').split('/')[0]?.trim();
  if (existing) return existing;

  const profile = getOffenseProfile(pokemon, format);
  const trickRoom = isTrickRoomPlan(pokemon);
  const roleText = `${pokemon.role ?? ''}`.toLowerCase();

  if (hasMove(pokemon, 'Body Press')) return trickRoom ? 'Relaxed' : 'Impish';
  if (profile === 'physical') return trickRoom ? 'Brave' : 'Adamant';
  if (profile === 'special') return trickRoom ? 'Quiet' : 'Modest';
  if (profile === 'mixed') return trickRoom ? 'Brave' : 'Naive';
  if (/special|sp\.?d|calm/i.test(roleText)) return 'Calm';
  return trickRoom ? 'Sassy' : 'Bold';
}

function chooseEvs(pokemon: PokemonData, format: string): CompetitiveStatSpread {
  const profile = getOffenseProfile(pokemon, format);
  const trickRoom = isTrickRoomPlan(pokemon);
  const support = /support|utility|redirection|setter|pivot|glue/i.test(pokemon.role ?? '');

  if (support && profile !== 'physical' && profile !== 'special') {
    return { hp: 252, atk: 0, def: 156, spa: 0, spd: 100, spe: 0 };
  }

  if (profile === 'special') {
    return trickRoom
      ? { hp: 252, atk: 0, def: 4, spa: 252, spd: 0, spe: 0 }
      : { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 };
  }

  if (profile === 'mixed') {
    return trickRoom
      ? { hp: 252, atk: 124, def: 0, spa: 124, spd: 8, spe: 0 }
      : { hp: 0, atk: 124, def: 0, spa: 124, spd: 8, spe: 252 };
  }

  return trickRoom
    ? { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 }
    : { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 };
}

function chooseIvs(pokemon: PokemonData, format: string): CompetitiveStatSpread {
  const profile = getOffenseProfile(pokemon, format);
  return {
    ...DEFAULT_IVS,
    atk: profile === 'special' ? 0 : 31,
    spe: isTrickRoomPlan(pokemon) ? 0 : 31,
  };
}

function normalizeMoves(moves?: string[]): [string, string, string, string] {
  const resolved = [...new Set((moves ?? []).filter(Boolean))];
  for (const fallback of ['Protect', 'Helping Hand', 'Substitute', 'Tera Blast']) {
    if (resolved.length >= 4) break;
    if (!resolved.some(move => normalize(move) === normalize(fallback))) resolved.push(fallback);
  }
  return resolved.slice(0, 4) as [string, string, string, string];
}

export function validateCompetitivePokemonSet(set: CompetitivePokemonSet): CompetitiveSetValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const evValues = Object.values(set.evs);
  const ivValues = Object.values(set.ivs);

  if (!set.item) errors.push('Item ausente.');
  if (!set.ability) errors.push('Habilidade ausente.');
  if (!set.nature) errors.push('Natureza ausente.');
  if (set.nature.includes('/')) errors.push('Natureza ambigua.');
  if (set.moves.length !== 4 || set.moves.some(move => !move)) errors.push('Set precisa conter exatamente quatro golpes.');
  if (evValues.reduce((sum, value) => sum + value, 0) > 510) errors.push('EVs excedem 510 pontos.');
  if (evValues.some(value => value < 0 || value > 252)) errors.push('Cada EV deve estar entre 0 e 252.');
  if (ivValues.some(value => value < 0 || value > 31)) errors.push('Cada IV deve estar entre 0 e 31.');

  const species = Dex.species.get(set.name);
  if (!species.exists) warnings.push('Especie nao encontrada no Dex para validacao profunda.');

  return {
    legal: errors.length === 0,
    errors,
    warnings,
  };
}

export function resolveCompetitivePokemonSet(
  pokemon: PokemonData,
  format: string,
  setSource: CompetitiveSetSource = 'generated',
): CompetitivePokemonSet {
  const moves = normalizeMoves(pokemon.moves);
  const set: CompetitivePokemonSet = {
    name: pokemon.name,
    types: pokemon.types?.length ? pokemon.types : getPokemonTypes(pokemon, format),
    item: pokemon.item ?? 'Sitrus Berry',
    ability: pokemon.ability ?? 'Nenhum',
    nature: chooseNature({ ...pokemon, moves }, format),
    evs: chooseEvs({ ...pokemon, moves }, format),
    ivs: chooseIvs({ ...pokemon, moves }, format),
    moves,
    role: pokemon.role,
    level: 50,
    setSource,
    validation: { legal: true, errors: [], warnings: [] },
  };

  set.evs = {
    hp: clampStat(set.evs.hp, 0, 252),
    atk: clampStat(set.evs.atk, 0, 252),
    def: clampStat(set.evs.def, 0, 252),
    spa: clampStat(set.evs.spa, 0, 252),
    spd: clampStat(set.evs.spd, 0, 252),
    spe: clampStat(set.evs.spe, 0, 252),
  };
  set.ivs = {
    hp: clampStat(set.ivs.hp, 0, 31),
    atk: clampStat(set.ivs.atk, 0, 31),
    def: clampStat(set.ivs.def, 0, 31),
    spa: clampStat(set.ivs.spa, 0, 31),
    spd: clampStat(set.ivs.spd, 0, 31),
    spe: clampStat(set.ivs.spe, 0, 31),
  };
  set.validation = validateCompetitivePokemonSet(set);

  return set;
}

export function withCompetitiveSet(
  pokemon: PokemonData,
  format: string,
  setSource: CompetitiveSetSource = pokemon.competitiveSet?.setSource ?? 'generated',
): PokemonData {
  const competitiveSet = resolveCompetitivePokemonSet(pokemon, format, setSource);
  return {
    ...pokemon,
    item: competitiveSet.item,
    ability: competitiveSet.ability,
    nature: competitiveSet.nature,
    moves: competitiveSet.moves,
    types: competitiveSet.types,
    role: competitiveSet.role ?? pokemon.role,
    competitiveSet,
  };
}
