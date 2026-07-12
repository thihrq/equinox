// src/equinox/scoring/LeadStrategyCandidateScore.ts
// Módulo de scoring de candidatos para o pipeline Build-Around-Lead.
// Avalia a adequação de um Pokémon como complemento de uma estratégia de lead.

import { PokemonData } from '../core/AnalysisContext';
import type { LeadStrategyCandidate, StrategyRoleRequirement } from '../vgc/LeadBuildTypes';
import { getPokemonTypes, getVariant } from '../utils/PokemonUtils';
import { getDamageMultiplier } from '../utils/DamageMultiplier';

// ─── Funções Helper ──────────────────────────────────────────────────────────

/** Normaliza um nome/string para comparação case-insensitive */
const normalize = (value?: string): string =>
  String(value ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

/**
 * Verifica se o Pokémon possui uma habilidade específica (considerando variant e abilities diretas).
 */
function hasAbility(p: PokemonData, format: string, ability: string): boolean {
  const variant = getVariant(p, format);
  const allAbilities = [
    p.ability,
    ...Object.values(variant?.abilities ?? {}),
    ...Object.values(p.abilities ?? {}),
  ].filter(Boolean) as string[];

  const target = normalize(ability);
  return allAbilities.some(a => normalize(a) === target);
}

/**
 * Verifica se o Pokémon possui um golpe específico.
 */
function hasMove(p: PokemonData, move: string): boolean {
  const target = normalize(move);
  return (p.moves ?? []).some(m => normalize(m) === target);
}

/**
 * Verifica se o Pokémon possui qualquer um dos golpes listados.
 */
function hasAnyMove(p: PokemonData, moves: string[]): boolean {
  return moves.some(move => hasMove(p, move));
}

/**
 * Verifica se o Pokémon possui qualquer uma das habilidades listadas.
 */
function hasAnyAbility(p: PokemonData, format: string, abilities: string[]): boolean {
  return abilities.some(ability => hasAbility(p, format, ability));
}

/**
 * Verifica se o Pokémon resiste (multiplicador <= 0.5) a um tipo de ataque.
 */
function resistsType(p: PokemonData, format: string, type: string): boolean {
  const types = getPokemonTypes(p, format);
  const multiplier = getDamageMultiplier(types, type);
  return multiplier <= 0.5;
}

/**
 * Verifica se o Pokémon resiste ou é imune a um tipo de ataque.
 */
function resistsOrImmuneType(p: PokemonData, format: string, type: string): boolean {
  const types = getPokemonTypes(p, format);
  const multiplier = getDamageMultiplier(types, type);
  return multiplier <= 0.5;
}

/**
 * Verifica se o Pokémon é imune (multiplicador === 0) a um tipo de ataque.
 */
function isImmuneToType(p: PokemonData, format: string, type: string): boolean {
  const types = getPokemonTypes(p, format);
  const multiplier = getDamageMultiplier(types, type);
  return multiplier === 0;
}

/**
 * Retorna o stat de Special Attack do Pokémon.
 */
function getSpecialAttack(p: PokemonData, format: string): number {
  const variant = getVariant(p, format);
  return Number(variant?.baseStats?.spa ?? 0);
}

/**
 * Retorna o stat de Physical Attack do Pokémon.
 */
function getPhysicalAttack(p: PokemonData, format: string): number {
  const variant = getVariant(p, format);
  return Number(variant?.baseStats?.atk ?? 0);
}

/**
 * Retorna o total defensivo (HP + Def + SpD) do Pokémon.
 */
function getDefensiveTotal(p: PokemonData, format: string): number {
  const variant = getVariant(p, format);
  const hp = Number(variant?.baseStats?.hp ?? 0);
  const def = Number(variant?.baseStats?.def ?? 0);
  const spd = Number(variant?.baseStats?.spd ?? 0);
  return hp + def + spd;
}

// ─── Detectores de Role ──────────────────────────────────────────────────────

/**
 * Mapeamento de roles para funções detectoras.
 * Cada detector retorna true se o Pokémon cumpre aquela role.
 */
const ROLE_DETECTORS: Record<string, (pokemon: PokemonData, format: string) => boolean> = {
  'swift-swim-attacker': (p, f) => hasAbility(p, f, 'Swift Swim'),
  'chlorophyll-attacker': (p, f) => hasAbility(p, f, 'Chlorophyll'),
  'sand-rush-attacker': (p, f) => hasAbility(p, f, 'Sand Rush'),
  'slush-rush-attacker': (p, f) => hasAbility(p, f, 'Slush Rush'),
  'trick-room-setter': (p, _f) => hasMove(p, 'Trick Room'),
  'fake-out': (p, _f) => hasMove(p, 'Fake Out'),
  'redirection': (p, _f) => hasAnyMove(p, ['Follow Me', 'Rage Powder']),
  'special-attacker': (p, f) => getSpecialAttack(p, f) >= 100,
  'physical-attacker': (p, f) => getPhysicalAttack(p, f) >= 100,
  'fighting-answer': (p, f) => resistsType(p, f, 'Fighting'),
  'electric-answer': (p, f) => resistsOrImmuneType(p, f, 'Electric'),
  'ground-immunity': (p, f) => isImmuneToType(p, f, 'Ground'),
  'weather-control': (p, f) => hasAnyAbility(p, f, ['Drizzle', 'Drought', 'Sand Stream', 'Snow Warning']),
  'tailwind-setter': (p, _f) => hasMove(p, 'Tailwind'),
  'priority-user': (p, _f) => hasAnyMove(p, [
    'Aqua Jet', 'Sucker Punch', 'Extreme Speed', 'Bullet Punch',
    'Grassy Glide', 'Mach Punch', 'Ice Shard', 'Shadow Sneak',
  ]),
  'defensive-shield': (p, f) => getDefensiveTotal(p, f) >= 200,
  'type-coverage-breaker': (_p, _f) => true, // Sempre aplicável como fallback
};

// ─── Scoring de Candidato ────────────────────────────────────────────────────

/**
 * Verifica se uma role específica já está presente no time parcial.
 */
function roleAlreadyInTeam(
  role: string,
  partialTeam: PokemonData[],
  format: string,
): boolean {
  const detector = ROLE_DETECTORS[role];
  if (!detector) return false;
  return partialTeam.some(pokemon => detector(pokemon, format));
}

/**
 * Calcula bônus de cobertura defensiva contra fraquezas da lead.
 * Retorna pontos positivos para cada fraqueza da lead que o candidato resiste.
 */
function calculateDefensiveCoverageBonus(
  candidate: PokemonData,
  strategy: LeadStrategyCandidate,
  partialTeam: PokemonData[],
  format: string,
): number {
  let bonus = 0;
  const leadPokemon = partialTeam.filter(p =>
    strategy.lead.some(leadName => normalize(leadName) === normalize(p.name)),
  );

  // Tipos dos Pokémon da lead
  const leadTypes = leadPokemon.flatMap(p => getPokemonTypes(p, format));
  const candidateTypes = getPokemonTypes(candidate, format);

  // Conjunto de 18 tipos de ataque a verificar
  const ALL_TYPES = [
    'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
    'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
    'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
  ];

  for (const attackType of ALL_TYPES) {
    // Verifica se a lead é fraca a esse tipo
    const leadMultiplier = getDamageMultiplier(leadTypes.length > 0 ? leadTypes : ['Normal'], attackType);
    if (leadMultiplier >= 2) {
      // O candidato resiste a essa fraqueza?
      const candidateMultiplier = getDamageMultiplier(candidateTypes, attackType);
      if (candidateMultiplier === 0) {
        bonus += 12; // Imunidade contra fraqueza da lead
      } else if (candidateMultiplier <= 0.5) {
        bonus += 8; // Resistência contra fraqueza da lead
      }
    }
  }

  return bonus;
}

/**
 * Calcula penalidade por tipos repetidos no time parcial.
 */
function calculateTypeRepetitionPenalty(
  candidate: PokemonData,
  partialTeam: PokemonData[],
  format: string,
): number {
  const candidateTypes = getPokemonTypes(candidate, format);
  const teamTypes = partialTeam.flatMap(p => getPokemonTypes(p, format));
  const teamTypeSet = new Set(teamTypes.map(normalize));

  let penalty = 0;
  for (const type of candidateTypes) {
    if (teamTypeSet.has(normalize(type))) {
      penalty -= 5; // Penalidade por tipo já presente no time
    }
  }

  return penalty;
}

/**
 * Avalia e pontua um candidato como complemento para uma estratégia de lead.
 *
 * O score leva em conta:
 * - Roles requeridas e opcionais cumpridas
 * - Penalidade por roles requeridas não cumpridas
 * - Duplicação de roles no time parcial
 * - Cobertura defensiva contra fraquezas da lead
 * - Tipos repetidos no time parcial
 *
 * @param candidate - Pokémon candidato a avaliar
 * @param strategy - Estratégia de lead ativa
 * @param partialTeam - Time parcial já construído
 * @param format - Formato do jogo (ex: 'champions_doubles')
 * @returns Score numérico (quanto maior, melhor o encaixe)
 */
export function scoreCandidateForStrategy(
  candidate: PokemonData,
  strategy: LeadStrategyCandidate,
  partialTeam: PokemonData[],
  format: string,
): number {
  let score = 0;

  // Avalia roles requeridas
  for (const role of strategy.requiredRoles) {
    const detector = ROLE_DETECTORS[role.role];
    if (!detector) continue;

    const fulfills = detector(candidate, format);

    if (fulfills) {
      // Bônus por cumprir a role
      score += role.weight;

      // Penalidade reduzida se a role já está coberta no time parcial
      if (roleAlreadyInTeam(role.role, partialTeam, format)) {
        score -= role.weight * 0.3; // Redundância parcial
      }
    } else {
      // Penalidade por NÃO cumprir role requerida
      score -= role.weight * 0.5;
    }
  }

  // Avalia roles opcionais
  for (const role of strategy.optionalRoles) {
    const detector = ROLE_DETECTORS[role.role];
    if (!detector) continue;

    const fulfills = detector(candidate, format);

    if (fulfills) {
      score += role.weight;

      // Penalidade menor por redundância em roles opcionais
      if (roleAlreadyInTeam(role.role, partialTeam, format)) {
        score -= role.weight * 0.2;
      }
    }
    // Roles opcionais NÃO penalizam por ausência
  }

  // Bônus de cobertura defensiva contra fraquezas da lead
  score += calculateDefensiveCoverageBonus(candidate, strategy, partialTeam, format);

  // Penalidade por tipos repetidos
  score += calculateTypeRepetitionPenalty(candidate, partialTeam, format);

  return score;
}
