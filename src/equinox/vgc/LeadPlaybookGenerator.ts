// src/equinox/vgc/LeadPlaybookGenerator.ts
// Gera o playbook estruturado a partir de um quarteto validado e sua estratégia

import type { PokemonData } from '../core/AnalysisContext';
import type {
  LeadLockedQuartet,
  LeadPlaybook,
  LeadStrategyCandidate,
  PlaybookAction,
  PlaybookTransition,
} from './LeadBuildTypes';
import { getVariant, getPokemonTypes } from '../utils/PokemonUtils';
import { getDamageMultiplier } from '../utils/DamageMultiplier';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const normalize = (v?: string): string => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function getAbility(p: PokemonData, format: string): string {
  if (p.ability) return normalize(p.ability);
  const variant = getVariant(p, format);
  const abilities = variant?.abilities ?? p.abilities;
  if (!abilities) return '';
  return normalize(String(Object.values(abilities)[0] ?? ''));
}

function getMoves(p: PokemonData): string[] {
  return (p.moves ?? []).map(m => m.trim());
}

function getMovesNormalized(p: PokemonData): string[] {
  return getMoves(p).map(normalize);
}

function hasMove(p: PokemonData, move: string): boolean {
  return getMovesNormalized(p).includes(normalize(move));
}

function hasAnyMove(p: PokemonData, moves: string[]): boolean {
  const normalized = getMovesNormalized(p);
  return moves.some(m => normalized.includes(normalize(m)));
}

function getBaseSpeed(p: PokemonData, format: string): number {
  return Number(getVariant(p, format)?.baseStats?.spe ?? 80);
}

// ─── Geração de Ações do Turno 1 ──────────────────────────────────────────────

function generateTurnOneActions(
  quartet: LeadLockedQuartet,
  strategy: LeadStrategyCandidate,
  fullTeam: PokemonData[],
  format: string,
): PlaybookAction[] {
  const actions: PlaybookAction[] = [];
  const leadPokemon = quartet.lead.map(name =>
    fullTeam.find(p => p.name === name)!,
  ).filter(Boolean);

  for (const pokemon of leadPokemon) {
    // Prioridade 1: Ações da estratégia que o Pokémon pode executar
    for (const turnOption of strategy.turnOneOptions) {
      if (turnOption.pokemonName === pokemon.name) {
        const moveExists = getMoves(pokemon).some(m => normalize(m) === normalize(turnOption.action))
          || normalize(turnOption.action) === 'protect';

        if (moveExists) {
          actions.push({
            pokemon: pokemon.name,
            action: turnOption.action,
            reasoning: turnOption.reasoning,
          });
          break; // Um Pokémon só faz uma ação no turno 1
        }
      }
    }

    // Se nenhuma ação foi atribuída da estratégia, gerar ação baseada em capacidades
    const alreadyAssigned = actions.some(a => a.pokemon === pokemon.name);
    if (!alreadyAssigned) {
      // Clima setter → golpe de suporte ou ataque STAB
      if (['drizzle', 'drought', 'sandstream', 'snowwarning'].includes(getAbility(pokemon, format))) {
        if (hasMove(pokemon, 'Tailwind')) {
          actions.push({
            pokemon: pokemon.name,
            action: 'Tailwind',
            reasoning: `${pokemon.name} ativa Tailwind enquanto o clima é ativado automaticamente pela habilidade.`,
          });
        } else if (hasMove(pokemon, 'Protect')) {
          actions.push({
            pokemon: pokemon.name,
            action: 'Protect',
            reasoning: `${pokemon.name} ativa o clima e se protege no turno 1 para posicionamento.`,
          });
        } else {
          // Usar primeiro golpe ofensivo disponível
          const firstOffensiveMove = getMoves(pokemon).find(m =>
            !['protect', 'detect', 'endure'].includes(normalize(m))
          );
          if (firstOffensiveMove) {
            actions.push({
              pokemon: pokemon.name,
              action: firstOffensiveMove,
              reasoning: `${pokemon.name} pressiona ofensivamente enquanto o clima é ativado.`,
            });
          }
        }
      }
      // Fake Out lead → prioridade máxima
      else if (hasMove(pokemon, 'Fake Out')) {
        actions.push({
          pokemon: pokemon.name,
          action: 'Fake Out',
          target: 'ameaça mais perigosa',
          reasoning: `${pokemon.name} usa Fake Out para travar a ameaça principal adversária no turno 1.`,
        });
      }
      // Trick Room setter
      else if (hasMove(pokemon, 'Trick Room')) {
        actions.push({
          pokemon: pokemon.name,
          action: 'Trick Room',
          reasoning: `${pokemon.name} ativa Trick Room para inverter a ordem de velocidade.`,
        });
      }
      // Protect como fallback
      else if (hasMove(pokemon, 'Protect')) {
        actions.push({
          pokemon: pokemon.name,
          action: 'Protect',
          reasoning: `${pokemon.name} se protege para avaliar o posicionamento adversário.`,
        });
      }
    }
  }

  return actions;
}

// ─── Geração de Transições ────────────────────────────────────────────────────

function generateTransitions(
  quartet: LeadLockedQuartet,
  strategy: LeadStrategyCandidate,
  fullTeam: PokemonData[],
  format: string,
): PlaybookTransition[] {
  const transitions: PlaybookTransition[] = [];
  const backlinePokemon = quartet.backline
    .map(name => fullTeam.find(p => p.name === name)!)
    .filter(Boolean);

  const leadPokemon = quartet.lead
    .map(name => fullTeam.find(p => p.name === name)!)
    .filter(Boolean);

  // Transição 1: Se Pokémon da lead cair, quem entra?
  for (let i = 0; i < leadPokemon.length; i++) {
    const leadMember = leadPokemon[i];
    const bestReplacement = backlinePokemon
      .sort((a, b) => {
        // Prioridade: Quem complementa melhor o parceiro restante da lead
        const partner = leadPokemon[1 - i];
        if (!partner) return 0;
        const partnerWeaknesses = ['Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Ground', 'Flying', 'Psychic', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy']
          .filter(t => getDamageMultiplier(getPokemonTypes(partner, format), t) >= 2.0);

        const aCoverage = partnerWeaknesses.filter(t =>
          getDamageMultiplier(getPokemonTypes(a, format), t) <= 0.5
        ).length;
        const bCoverage = partnerWeaknesses.filter(t =>
          getDamageMultiplier(getPokemonTypes(b, format), t) <= 0.5
        ).length;

        return bCoverage - aCoverage;
      })[0];

    if (bestReplacement) {
      transitions.push({
        trigger: `${leadMember.name} é derrotado`,
        switchIn: bestReplacement.name,
        switchOut: leadMember.name,
        reasoning: `${bestReplacement.name} entra para manter cobertura defensiva ao lado de ${leadPokemon[1 - i]?.name ?? 'parceiro'}.`,
      });
    }
  }

  // Transição 2: Trick Room expira
  if (strategy.speedAxis === 'slow') {
    const fastestBench = backlinePokemon
      .sort((a, b) => getBaseSpeed(b, format) - getBaseSpeed(a, format))[0];

    if (fastestBench && getBaseSpeed(fastestBench, format) >= 80) {
      transitions.push({
        trigger: 'Trick Room expira',
        switchIn: fastestBench.name,
        reasoning: `Quando Trick Room expira, ${fastestBench.name} (Speed ${getBaseSpeed(fastestBench, format)}) pode manter pressão em velocidade normal.`,
      });
    }
  }

  // Transição 3: Clima adversário
  if (strategy.id.includes('rain') || strategy.id.includes('sun')) {
    const weatherCounters = backlinePokemon.filter(p =>
      hasAnyMove(p, ['Rain Dance', 'Sunny Day', 'Sandstorm', 'Snowscape'])
    );
    for (const counter of weatherCounters) {
      transitions.push({
        trigger: 'Adversário substitui o clima',
        switchIn: counter.name,
        reasoning: `${counter.name} pode restaurar o clima favorável com golpe manual.`,
      });
    }
  }

  return transitions;
}

// ─── Identificação de Ameaças ──────────────────────────────────────────────────

function identifyThreats(
  quartet: LeadLockedQuartet,
  fullTeam: PokemonData[],
  format: string,
): string[] {
  const threats: string[] = [];
  const activePokemon = quartet.selectedFour
    .map(name => fullTeam.find(p => p.name === name)!)
    .filter(Boolean);

  const allTypes = ['Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Ground', 'Flying', 'Psychic', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];

  // Tipos que ameaçam 3+ Pokémon do quarteto
  for (const atkType of allTypes) {
    const weakCount = activePokemon.filter(p =>
      getDamageMultiplier(getPokemonTypes(p, format), atkType) >= 2.0
    ).length;
    if (weakCount >= 3) {
      threats.push(`Ataques ${atkType} ameaçam ${weakCount}/4 Pokémon ativos.`);
    }
  }

  // Intimidate
  const hasIntimidateAnswer = activePokemon.some(p => {
    const ability = getAbility(p, format);
    return ['innerfocus', 'clearbody', 'whitesmoke', 'hypercutter', 'defiant', 'competitive'].includes(ability);
  });
  if (!hasIntimidateAnswer) {
    threats.push('O quarteto nao possui resposta direta a Intimidate, como Clear Amulet, Defiant, Competitive ou Clear Body.');
  }

  // Fake Out adversário
  const hasFakeOutImmunity = activePokemon.some(p => {
    const types = getPokemonTypes(p, format).map(normalize);
    return types.includes('ghost') || getAbility(p, format) === 'innerfocus';
  });
  if (!hasFakeOutImmunity) {
    threats.push('Nenhuma imunidade a Fake Out adversário: lead vulnerável a pressão de turno 1.');
  }

  return threats;
}

// ─── Condições de Evitar ──────────────────────────────────────────────────────

function identifyAvoidConditions(
  quartet: LeadLockedQuartet,
  strategy: LeadStrategyCandidate,
  fullTeam: PokemonData[],
  format: string,
): string[] {
  const conditions: string[] = [];

  // Se é Rain team, evitar matchups contra adversários com Drought
  if (strategy.id.includes('rain')) {
    conditions.push('Evitar usar esta lead contra times com Drought (Torkoal, Groudon): o clima será substituído imediatamente.');
  }
  if (strategy.id.includes('sun')) {
    conditions.push('Evitar usar esta lead contra times com Drizzle (Pelipper, Kyogre): o clima será substituído imediatamente.');
  }

  // Se Trick Room, evitar contra Taunt leads
  if (strategy.speedAxis === 'slow') {
    conditions.push('Evitar Trick Room contra leads com Taunt rápido (Prankster): bloqueio total do setup.');
  }

  // Se depende de redirecionamento, evitar contra Stalwart/Propeller Tail
  if (strategy.requiredRoles.some(r => r.role === 'redirection')) {
    conditions.push('Evitar confiar em redirecionamento contra Duraludon (Stalwart) ou Barraskewda (Propeller Tail).');
  }

  return conditions;
}

// ─── Cálculo do Índice de Execução ─────────────────────────────────────────────

function calculateExecutionIndex(
  quartet: LeadLockedQuartet,
  turnOneActions: PlaybookAction[],
  transitions: PlaybookTransition[],
): number {
  let index = 60; // Base

  // Ações do turno 1 claras e confirmadas
  if (turnOneActions.length >= 2) index += 10;
  if (turnOneActions.every(a => a.action !== 'Protect')) index += 5; // Ações proativas

  // Transições bem definidas
  if (transitions.length >= 2) index += 10;

  // Contrato válido
  if (quartet.contractValid) index += 10;

  // Score do quarteto alto
  if (quartet.score >= 70) index += 5;

  if (!quartet.contractValid) return 0;
  if (quartet.score < 60) index = Math.min(index, 60);
  if (quartet.risks.length >= 4) index = Math.min(index, 75);

  return Math.min(100, Math.max(0, index));
}

// ─── Função Principal ───────────────────────────────────────────────────────────

export interface GeneratePlaybookInput {
  quartet: LeadLockedQuartet;
  strategy: LeadStrategyCandidate;
  fullTeam: PokemonData[];
  format: string;
}

export function generateLeadPlaybook(input: GeneratePlaybookInput): LeadPlaybook {
  const { quartet, strategy, fullTeam, format } = input;

  const turnOneOptions = generateTurnOneActions(quartet, strategy, fullTeam, format);
  const transitionOptions = generateTransitions(quartet, strategy, fullTeam, format);
  const threats = identifyThreats(quartet, fullTeam, format);
  const avoidWhen = identifyAvoidConditions(quartet, strategy, fullTeam, format);
  const executionIndex = calculateExecutionIndex(quartet, turnOneOptions, transitionOptions);

  return {
    strategyName: strategy.name,
    selectedFour: quartet.selectedFour,
    lead: quartet.lead,
    backline: quartet.backline,
    turnOneOptions,
    transitionOptions,
    winConditions: quartet.winConditions,
    avoidWhen,
    threats,
    executionIndex,
    contractValid: quartet.contractValid,
  };
}
