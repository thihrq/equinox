// src/equinox/vgc/FullTeamEvaluator.ts
// Avaliador de times completos para o pipeline Build-Around-Lead.
// Analisa legalidade, cobertura de roles, balanço ofensivo/defensivo,
// controle de velocidade e flexibilidade de matchup.

import type {
  FullTeamEvaluation,
  TeamWeakness,
  LeadStrategyCandidate,
} from './LeadBuildTypes';
import { PokemonData } from '../core/AnalysisContext';
import { getPokemonTypes, getVariant, getSpeciesClauseKey } from '../utils/PokemonUtils';
import { getDamageMultiplier } from '../utils/DamageMultiplier';
import { isMegaOption } from '../utils/VgcSetOptimizer';
import { FormatSolverRegistry } from '../format-solvers/FormatSolverRegistry';
import { validateCompetitiveTeam } from '../competitive/CompetitiveTeamLegalityValidator';

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Todos os 18 tipos do sistema Pokémon */
const ALL_TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
  'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
];

/** Pesos para a média ponderada do overallScore */
const WEIGHTS = {
  roleCoverage: 0.30,
  offensiveBalance: 0.20,
  defensiveCoverage: 0.25,
  speedControl: 0.15,
  matchupFlexibility: 0.10,
};

// ─── Funções Helper ──────────────────────────────────────────────────────────

const normalize = (value?: string): string =>
  String(value ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

/** Instância compartilhada do registro de solvers */
const solverRegistry = new FormatSolverRegistry();

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
 * Verifica se o Pokémon possui uma habilidade específica.
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
 * Verifica se o Pokémon possui qualquer uma das habilidades listadas.
 */
function hasAnyAbility(p: PokemonData, format: string, abilities: string[]): boolean {
  return abilities.some(ability => hasAbility(p, format, ability));
}

// ─── Verificações de Legalidade ──────────────────────────────────────────────

interface LegalityResult {
  legal: boolean;
  warnings: string[];
}

/**
 * Verifica legalidade do time: Species Clause, Item Clause e limite de Mega.
 */
function checkLegality(team: PokemonData[]): LegalityResult {
  const warnings: string[] = [];

  // Species Clause: nenhuma espécie duplicada
  const speciesKeys = team.map(p => getSpeciesClauseKey(p.name));
  const speciesSet = new Set(speciesKeys);
  if (speciesSet.size < speciesKeys.length) {
    const duplicates = speciesKeys.filter((key, i) => speciesKeys.indexOf(key) !== i);
    warnings.push(`Species Clause violada: espécies duplicadas [${[...new Set(duplicates)].join(', ')}]`);
  }

  // Item Clause: nenhum item duplicado
  const items = team.map(p => p.item).filter(Boolean) as string[];
  const itemSet = new Set(items.map(normalize));
  if (itemSet.size < items.length) {
    const itemCounts = new Map<string, number>();
    for (const item of items) {
      const key = normalize(item);
      itemCounts.set(key, (itemCounts.get(key) ?? 0) + 1);
    }
    const duplicateItems = [...itemCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([key]) => key);
    warnings.push(`Item Clause violada: itens duplicados [${duplicateItems.join(', ')}]`);
  }

  // Máximo de 1 Mega Evolution
  const megaCount = team.filter(p => isMegaOption(p)).length;
  if (megaCount > 1) {
    warnings.push(`Máximo de 1 Mega Evolution excedido: ${megaCount} encontradas`);
  }

  const legal = warnings.length === 0;
  return { legal, warnings };
}

// ─── Role Coverage Score ─────────────────────────────────────────────────────

/**
 * Mapeamento simplificado de roles para detectores.
 * Reutiliza a mesma lógica do LeadStrategyCandidateScore.
 */
function pokemonFulfillsRole(p: PokemonData, role: string, format: string): boolean {
  const variant = getVariant(p, format);
  const spa = Number(variant?.baseStats?.spa ?? 0);
  const atk = Number(variant?.baseStats?.atk ?? 0);
  const spe = Number(variant?.baseStats?.spe ?? 80);
  const hp = Number(variant?.baseStats?.hp ?? 0);
  const def = Number(variant?.baseStats?.def ?? 0);
  const spd = Number(variant?.baseStats?.spd ?? 0);
  const roleText = `${p.role ?? ''} ${(p.competitive?.roles ?? []).join(' ')} ${(p.competitive?.offensiveTags ?? []).join(' ')} ${(p.competitive?.utilityTags ?? []).join(' ')}`.toLowerCase();
  const types = getPokemonTypes(p, format);
  const hasType = (type: string) => types.some(t => normalize(t) === normalize(type));

  switch (role) {
    case 'swift-swim-attacker': return hasAbility(p, format, 'Swift Swim');
    case 'chlorophyll-attacker': return hasAbility(p, format, 'Chlorophyll');
    case 'sand-rush-attacker': return hasAbility(p, format, 'Sand Rush');
    case 'slush-rush-attacker': return hasAbility(p, format, 'Slush Rush');
    case 'trick-room-setter': return hasMove(p, 'Trick Room');
    case 'secondary-trick-room': return hasMove(p, 'Trick Room');
    case 'fake-out': return hasMove(p, 'Fake Out');
    case 'fake-out-support': return hasMove(p, 'Fake Out');
    case 'redirection': return hasAnyMove(p, ['Follow Me', 'Rage Powder']);
    case 'secondary-redirector': return hasAnyMove(p, ['Follow Me', 'Rage Powder']);
    case 'special-attacker': return spa >= 100;
    case 'physical-attacker': return atk >= 100;
    case 'slow-physical-attacker': return spe <= 65 && atk >= 100;
    case 'slow-special-attacker': return spe <= 65 && spa >= 90;
    case 'fast-sweeper': return spe >= 90 && Math.max(atk, spa) >= 95;
    case 'special-breaker': return spa >= 100 || /special|breaker/.test(roleText);
    case 'offensive-breaker': return Math.max(atk, spa) >= 105 || /breaker|sweeper|damage|attacker/.test(roleText);
    case 'setup-sweeper': return hasAnyMove(p, ['Swords Dance', 'Nasty Plot', 'Dragon Dance', 'Calm Mind', 'Iron Defense']) || /sweeper|setup|win condition/.test(roleText);
    case 'win-condition': return Math.max(atk, spa) >= 110 || /win condition|cleaner|sweeper/.test(roleText);
    case 'offensive-coverage': return (p.moves ?? []).length >= 4;
    case 'water-breaker': return hasType('Water') && Math.max(atk, spa) >= 90;
    case 'fire-breaker': return hasType('Fire') && Math.max(atk, spa) >= 90;
    case 'ice-breaker': return hasType('Ice') && Math.max(atk, spa) >= 90;
    case 'ground-or-rock-breaker': return (hasType('Ground') || hasType('Rock')) && Math.max(atk, spa) >= 90;
    case 'fighting-answer': {
      return getDamageMultiplier(types, 'Fighting') <= 0.5;
    }
    case 'water-answer': return getDamageMultiplier(types, 'Water') <= 0.5 || hasType('Grass') || hasType('Electric');
    case 'grass-answer': return getDamageMultiplier(types, 'Grass') <= 0.5 || hasType('Fire') || hasType('Flying') || hasType('Poison');
    case 'rock-answer': return getDamageMultiplier(types, 'Rock') <= 0.5 || hasType('Fighting') || hasType('Ground') || hasType('Steel');
    case 'steel-answer': return getDamageMultiplier(types, 'Steel') <= 0.5 || hasType('Fire') || hasType('Ground') || hasType('Fighting');
    case 'fire-answer': return getDamageMultiplier(types, 'Fire') <= 0.5 || hasType('Water') || hasType('Rock') || hasType('Dragon');
    case 'electric-answer': {
      return getDamageMultiplier(types, 'Electric') <= 0.5;
    }
    case 'ground-immunity': {
      return getDamageMultiplier(types, 'Ground') === 0;
    }
    case 'weather-control':
      return hasAnyAbility(p, format, ['Drizzle', 'Drought', 'Sand Stream', 'Snow Warning']);
    case 'tailwind-setter': return hasMove(p, 'Tailwind');
    case 'speed-control': return hasAnyMove(p, ['Tailwind', 'Trick Room', 'Icy Wind', 'Electroweb', 'Thunder Wave']) ||
      hasAnyAbility(p, format, ['Swift Swim', 'Chlorophyll', 'Sand Rush', 'Slush Rush']);
    case 'priority-user':
      return hasAnyMove(p, [
        'Aqua Jet', 'Sucker Punch', 'Extreme Speed', 'Bullet Punch',
        'Grassy Glide', 'Mach Punch', 'Ice Shard', 'Shadow Sneak',
      ]);
    case 'defensive-shield': return (hp + def + spd) >= 200;
    case 'defensive-pivot': return hasAnyMove(p, ['Parting Shot', 'U-turn', 'Volt Switch', 'Flip Turn']) ||
      hasAnyAbility(p, format, ['Intimidate', 'Regenerator']) ||
      (hp + def + spd) >= 230;
    case 'pivot': return hasAnyMove(p, ['Parting Shot', 'U-turn', 'Volt Switch', 'Flip Turn']) ||
      hasAnyAbility(p, format, ['Intimidate', 'Regenerator']);
    case 'utility-support': return hasAnyMove(p, ['Helping Hand', 'Taunt', 'Encore', 'Will-O-Wisp', 'Spore', 'Rage Powder', 'Follow Me']);
    case 'cleric': return hasAnyMove(p, ['Heal Pulse', 'Life Dew', 'Pollen Puff', 'Aromatherapy', 'Heal Bell']);
    case 'hazard-control': return hasAnyMove(p, ['Rapid Spin', 'Defog', 'Court Change']);
    case 'type-coverage-breaker': return true;
    default: return false;
  }
}

/**
 * Calcula o score de cobertura de roles (0–100).
 * Mede quanto das roles required/preferred da estratégia estão preenchidas.
 */
function calculateRoleCoverageScore(
  team: PokemonData[],
  strategy: LeadStrategyCandidate,
  format: string,
): number {
  let fulfilled = 0;
  let totalWeight = 0;

  // Roles requeridas (peso total: 70%)
  for (const role of strategy.requiredRoles) {
    totalWeight += role.weight;
    const isFulfilled = team.some(p => pokemonFulfillsRole(p, role.role, format));
    if (isFulfilled) {
      fulfilled += role.weight;
    }
  }

  // Roles opcionais (peso total: 30%)
  for (const role of strategy.optionalRoles) {
    totalWeight += role.weight * 0.5; // Opcionais valem metade
    const isFulfilled = team.some(p => pokemonFulfillsRole(p, role.role, format));
    if (isFulfilled) {
      fulfilled += role.weight * 0.5;
    }
  }

  if (totalWeight === 0) return 50; // Valor neutro se não há roles definidas
  return Math.min(100, Math.round((fulfilled / totalWeight) * 100));
}

// ─── Offensive Balance Score ─────────────────────────────────────────────────

/**
 * Calcula o score de balanço ofensivo (0–100).
 * Avalia cobertura de tipos ofensivos e equilíbrio físico/especial.
 */
function calculateRoleCoverageDetails(
  team: PokemonData[],
  strategy: LeadStrategyCandidate,
  format: string,
): FullTeamEvaluation['roleCoverage'] {
  const fulfilled: string[] = [];
  const missing: string[] = [];
  const redundant: string[] = [];

  for (const role of [...strategy.requiredRoles, ...strategy.optionalRoles]) {
    const providers = team.filter(pokemon => pokemonFulfillsRole(pokemon, role.role, format));
    if (providers.length > 0) fulfilled.push(role.role);
    else if (role.priority !== 'optional') missing.push(role.role);
    if (providers.length >= 3) redundant.push(`${role.role}: ${providers.length} usuarios`);
  }

  const redirectionUsers = team.filter(pokemon => hasAnyMove(pokemon, ['Follow Me', 'Rage Powder']));
  if (redirectionUsers.length >= 3) {
    redundant.push(`redirection: ${redirectionUsers.length} usuarios`);
  }

  return {
    fulfilled: [...new Set(fulfilled)],
    missing: [...new Set(missing)],
    redundant: [...new Set(redundant)],
  };
}

function calculateOffensiveBalanceScore(
  team: PokemonData[],
  format: string,
): number {
  // Cobertura de tipos ofensivos
  const offensiveTypes = new Set<string>();
  for (const pokemon of team) {
    const types = getPokemonTypes(pokemon, format);
    for (const type of types) {
      offensiveTypes.add(type);
    }
    // Adicionar tipos dos golpes se possível (simplificação: usar STAB types)
    for (const move of pokemon.moves ?? []) {
      // Simplificação: contamos os tipos STAB do Pokémon como cobertura ofensiva
      for (const type of types) {
        offensiveTypes.add(type);
      }
    }
  }

  // Fração de tipos cobertos (dos 18)
  const coverageRatio = offensiveTypes.size / ALL_TYPES.length;

  // Equilíbrio físico/especial
  let physicalAttackers = 0;
  let specialAttackers = 0;

  for (const pokemon of team) {
    const variant = getVariant(pokemon, format);
    const atk = Number(variant?.baseStats?.atk ?? 0);
    const spa = Number(variant?.baseStats?.spa ?? 0);

    if (atk >= 100) physicalAttackers++;
    if (spa >= 100) specialAttackers++;
  }

  // Penalidade por desequilíbrio
  let balancePenalty = 0;
  if (physicalAttackers === 0 || specialAttackers === 0) {
    balancePenalty = 25; // Penalidade severa por ausência total
  } else {
    const ratio = Math.min(physicalAttackers, specialAttackers) /
      Math.max(physicalAttackers, specialAttackers);
    balancePenalty = Math.round((1 - ratio) * 15); // Penalidade leve por desproporção
  }

  const rawScore = coverageRatio * 100 - balancePenalty;
  return Math.max(0, Math.min(100, Math.round(rawScore)));
}

// ─── Defensive Coverage Score ────────────────────────────────────────────────

/**
 * Calcula o score de cobertura defensiva (0–100).
 * Avalia quantos tipos o time resiste/é imune, e quais fraquezas estão expostas.
 */
function calculateDefensiveCoverageScore(
  team: PokemonData[],
  format: string,
): { score: number; weaknesses: TeamWeakness[] } {
  const weaknesses: TeamWeakness[] = [];
  let resistedTypes = 0;
  let immuneTypes = 0;

  for (const attackType of ALL_TYPES) {
    const multipliers = team.map(p => ({
      pokemon: p,
      multiplier: getDamageMultiplier(getPokemonTypes(p, format), attackType),
    }));

    const hasResist = multipliers.some(m => m.multiplier <= 0.5);
    const hasImmunity = multipliers.some(m => m.multiplier === 0);
    const weakPokemon = multipliers.filter(m => m.multiplier >= 2);
    const superWeakPokemon = multipliers.filter(m => m.multiplier >= 4);

    if (hasImmunity) {
      immuneTypes++;
    } else if (hasResist) {
      resistedTypes++;
    }

    // Identificar fraquezas problemáticas
    if (weakPokemon.length >= 3) {
      const mitigator = multipliers.find(m => m.multiplier <= 0.5);
      weaknesses.push({
        type: attackType,
        severity: superWeakPokemon.length >= 2 ? 'critical' : 'moderate',
        exposedPokemon: weakPokemon.map(m => m.pokemon.name),
        mitigatedBy: mitigator ? mitigator.pokemon.name : undefined,
      });
    } else if (!hasResist && !hasImmunity && weakPokemon.length >= 2) {
      weaknesses.push({
        type: attackType,
        severity: 'minor',
        exposedPokemon: weakPokemon.map(m => m.pokemon.name),
      });
    }
  }

  // Score baseado na cobertura defensiva
  const totalCovered = resistedTypes + immuneTypes;
  const coverageRatio = totalCovered / ALL_TYPES.length;
  const weaknessPenalty = weaknesses.reduce((penalty, w) => {
    switch (w.severity) {
      case 'critical': return penalty + 15;
      case 'moderate': return penalty + 8;
      case 'minor': return penalty + 3;
      default: return penalty;
    }
  }, 0);

  const rawScore = coverageRatio * 100 - weaknessPenalty;
  return {
    score: Math.max(0, Math.min(100, Math.round(rawScore))),
    weaknesses,
  };
}

// ─── Speed Control Score ─────────────────────────────────────────────────────

/**
 * Calcula o score de controle de velocidade (0–100).
 * Avalia presença de Tailwind, Trick Room, priority moves e habilidades de velocidade.
 */
function calculateSpeedControlScore(
  team: PokemonData[],
  format: string,
): number {
  let score = 0;

  // Tailwind
  const hasTailwind = team.some(p => hasMove(p, 'Tailwind'));
  if (hasTailwind) score += 30;

  // Trick Room
  const hasTrickRoom = team.some(p => hasMove(p, 'Trick Room'));
  if (hasTrickRoom) score += 25;

  // Priority moves
  const priorityMoves = ['Aqua Jet', 'Sucker Punch', 'Extreme Speed', 'Bullet Punch',
    'Grassy Glide', 'Mach Punch', 'Ice Shard', 'Shadow Sneak', 'Fake Out'];
  const hasPriority = team.some(p => hasAnyMove(p, priorityMoves));
  if (hasPriority) score += 15;

  // Habilidades de velocidade em clima
  const speedAbilities = ['Swift Swim', 'Chlorophyll', 'Sand Rush', 'Slush Rush'];
  const hasWeatherSpeed = team.some(p => hasAnyAbility(p, format, speedAbilities));
  if (hasWeatherSpeed) score += 20;

  // Pokémon naturalmente rápidos (base speed >= 100)
  const fastPokemon = team.filter(p => {
    const variant = getVariant(p, format);
    return Number(variant?.baseStats?.spe ?? 0) >= 100;
  }).length;
  if (fastPokemon >= 2) score += 10;
  else if (fastPokemon === 0 && !hasTailwind && !hasTrickRoom && !hasWeatherSpeed) score -= 10;

  return Math.max(0, Math.min(100, score));
}

// ─── Matchup Flexibility Score ───────────────────────────────────────────────

/**
 * Calcula o score de flexibilidade de matchup (0–100).
 * Avalia a capacidade do time de trocar estratégia se a lead falhar.
 */
function calculateMatchupFlexibilityScore(
  team: PokemonData[],
  strategy: LeadStrategyCandidate,
  format: string,
): number {
  let score = 50; // Base neutra

  // Pokémon com Protect/Detect (podem ganhar turno para pivotar)
  const hasProtect = team.some(p => hasAnyMove(p, ['Protect', 'Detect', 'King\'s Shield', 'Baneful Bunker', 'Spiky Shield', 'Silk Trap']));
  if (hasProtect) score += 10;

  // Pokémon com U-turn/Volt Switch/Parting Shot (pivots)
  const pivotCount = team.filter(p => hasAnyMove(p, ['U-turn', 'Volt Switch', 'Flip Turn', 'Parting Shot'])).length;
  score += Math.min(pivotCount * 8, 20);

  // Intimidate/suporte defensivo que funciona em qualquer matchup
  const hasIntimidate = team.some(p => hasAbility(p, format, 'Intimidate'));
  if (hasIntimidate) score += 8;

  // Capacidade de lidar com Trick Room (se a lead é rápida)
  if (strategy.speedAxis === 'fast' || strategy.speedAxis === 'hybrid') {
    const hasTrickRoomCounter = team.some(p =>
      hasMove(p, 'Taunt') || hasMove(p, 'Imprison') || hasMove(p, 'Trick Room'),
    );
    if (hasTrickRoomCounter) score += 8;
    else score -= 10;
  }

  // Diversidade de tipos de atacantes (backline não fica limitada)
  const backlinePokemon = team.filter(p =>
    !strategy.lead.some(leadName => normalize(leadName) === normalize(p.name)),
  );
  const backlineTypes = new Set(backlinePokemon.flatMap(p => getPokemonTypes(p, format)));
  score += Math.min(backlineTypes.size * 3, 15);

  return Math.max(0, Math.min(100, score));
}

// ─── Identificação de Pontos Fortes ──────────────────────────────────────────

/**
 * Identifica pontos fortes do time.
 */
function identifyStrengths(
  team: PokemonData[],
  strategy: LeadStrategyCandidate,
  format: string,
  scores: {
    roleCoverage: number;
    offensiveBalance: number;
    defensiveCoverage: number;
    speedControl: number;
    matchupFlexibility: number;
  },
): string[] {
  const strengths: string[] = [];

  if (scores.roleCoverage >= 80) {
    strengths.push('Excelente cobertura de roles estratégicas');
  }

  if (scores.offensiveBalance >= 80) {
    strengths.push('Balanço ofensivo sólido com boa cobertura de tipos');
  }

  if (scores.defensiveCoverage >= 80) {
    strengths.push('Cobertura defensiva robusta com poucas fraquezas expostas');
  }

  if (scores.speedControl >= 70) {
    strengths.push('Múltiplas opções de controle de velocidade');
  }

  if (scores.matchupFlexibility >= 70) {
    strengths.push('Alta flexibilidade para adaptar a diferentes matchups');
  }

  // Sinergia de clima
  const hasWeatherSetter = team.some(p =>
    hasAnyAbility(p, format, ['Drizzle', 'Drought', 'Sand Stream', 'Snow Warning']),
  );
  const hasWeatherAbuser = team.some(p =>
    hasAnyAbility(p, format, ['Swift Swim', 'Chlorophyll', 'Sand Rush', 'Slush Rush']),
  );
  if (hasWeatherSetter && hasWeatherAbuser) {
    strengths.push('Sinergia de clima setter + abuser presente');
  }

  // Fake Out + redirection para proteção do turno 1
  const hasFakeOut = team.some(p => hasMove(p, 'Fake Out'));
  const hasRedirection = team.some(p => hasAnyMove(p, ['Follow Me', 'Rage Powder']));
  if (hasFakeOut && hasRedirection) {
    strengths.push('Fake Out + redirecionamento para controle de turno 1');
  }

  return strengths;
}

// ─── Identificação de Alertas ────────────────────────────────────────────────

/**
 * Identifica problemas que não invalidam o time mas merecem atenção.
 */
function identifyWarnings(
  team: PokemonData[],
  format: string,
  legality: LegalityResult,
  weaknesses: TeamWeakness[],
): string[] {
  const warnings = [...legality.warnings];

  // Fraquezas críticas
  const criticalWeaknesses = weaknesses.filter(w => w.severity === 'critical');
  for (const weakness of criticalWeaknesses) {
    warnings.push(`Fraqueza crítica a ${weakness.type}: ${weakness.exposedPokemon.join(', ')}`);
  }

  // Verificar se há suporte suficiente
  const supportMoves = ['Helping Hand', 'Follow Me', 'Rage Powder', 'Fake Out', 'Tailwind', 'Trick Room'];
  const supportCount = team.filter(p => hasAnyMove(p, supportMoves)).length;
  if (supportCount < 2) {
    warnings.push('Poucos Pokémon com moves de suporte (considere mais Helping Hand, Fake Out, etc.)');
  }

  // Verificar redundância excessiva de tipos
  const typeCount = new Map<string, number>();
  for (const pokemon of team) {
    for (const type of getPokemonTypes(pokemon, format)) {
      const key = normalize(type);
      typeCount.set(key, (typeCount.get(key) ?? 0) + 1);
    }
  }
  for (const [type, count] of typeCount) {
    if (count >= 4) {
      warnings.push(`Excesso de Pokémon do tipo ${type} (${count} membros)`);
    }
  }

  return warnings;
}

// ─── Avaliação Principal ─────────────────────────────────────────────────────

/**
 * Avalia um time completo de 6 Pokémon no contexto de uma estratégia de lead.
 *
 * Produz scores individuais para:
 * - Cobertura de roles (30%)
 * - Balanço ofensivo (20%)
 * - Cobertura defensiva (25%)
 * - Controle de velocidade (15%)
 * - Flexibilidade de matchup (10%)
 *
 * Além de identificar fraquezas, alertas e pontos fortes.
 *
 * @param team - Time completo de 6 Pokémon
 * @param strategy - Estratégia de lead utilizada
 * @param format - Formato do jogo
 * @returns Avaliação completa do time
 */
export function evaluateFullTeam(
  team: PokemonData[],
  strategy: LeadStrategyCandidate,
  format: string,
): FullTeamEvaluation {
  // Verificar legalidade
  const teamLegality = validateCompetitiveTeam(team, format);
  const legality: LegalityResult = {
    legal: teamLegality.legal,
    warnings: teamLegality.issues.map(issue => issue.message),
  };

  // Calcular scores individuais
  const roleCoverageScore = calculateRoleCoverageScore(team, strategy, format);
  const roleCoverage = calculateRoleCoverageDetails(team, strategy, format);
  const offensiveBalanceScore = calculateOffensiveBalanceScore(team, format);
  const { score: defensiveCoverageScore, weaknesses } = calculateDefensiveCoverageScore(team, format);
  const speedControlScore = calculateSpeedControlScore(team, format);
  const matchupFlexibilityScore = calculateMatchupFlexibilityScore(team, strategy, format);

  // Calcular score geral (média ponderada)
  const overallScore = Math.round(
    roleCoverageScore * WEIGHTS.roleCoverage +
    offensiveBalanceScore * WEIGHTS.offensiveBalance +
    defensiveCoverageScore * WEIGHTS.defensiveCoverage +
    speedControlScore * WEIGHTS.speedControl +
    matchupFlexibilityScore * WEIGHTS.matchupFlexibility,
  );

  // Verificar se a estratégia está completa (todas as roles requeridas preenchidas)
  const strategyComplete = strategy.requiredRoles.every(role =>
    team.some(p => pokemonFulfillsRole(p, role.role, format)),
  );

  // Identificar alertas e pontos fortes
  const warnings = identifyWarnings(team, format, legality, weaknesses);
  const strengths = identifyStrengths(team, strategy, format, {
    roleCoverage: roleCoverageScore,
    offensiveBalance: offensiveBalanceScore,
    defensiveCoverage: defensiveCoverageScore,
    speedControl: speedControlScore,
    matchupFlexibility: matchupFlexibilityScore,
  });

  return {
    legal: legality.legal,
    strategyComplete,
    teamLegality,
    roleCoverage,
    roleCoverageScore,
    offensiveBalanceScore,
    defensiveCoverageScore,
    speedControlScore,
    matchupFlexibilityScore,
    overallScore,
    weaknesses,
    warnings,
    strengths,
  };
}
