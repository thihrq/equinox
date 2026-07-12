// src/equinox/vgc/VgcTurnPlanResolver.ts
// Resolve e gera as linhas táticas de turno (TurnPlanLine) validadas e mutuamente exclusivas

import type { PokemonData } from '../core/AnalysisContext';
import type { PlannedTurn } from './LeadBuildTypes';
import { getVariant } from '../utils/PokemonUtils';

export interface PlannedAction {
  pokemon: string;
  action: string;
  reasoning: string;
}

export interface TurnPlanLine {
  id: string;
  actions: [PlannedAction, PlannedAction];
  objective: string;
  risks: string[];
}

const normalize = (v?: string): string => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function getMoves(p: PokemonData): string[] {
  return (p.moves ?? []).map(m => m.trim());
}

function hasMove(p: PokemonData, move: string): boolean {
  return getMoves(p).map(normalize).includes(normalize(move));
}

function getBestAttackingMove(p: PokemonData): string {
  const supportMoves = ['protect', 'detect', 'trickroom', 'trick-room', 'tailwind', 'ragepowder', 'rage-powder', 'followme', 'follow-me', 'spore', 'sleeppowder', 'yawn', 'fakeout', 'fake-out', 'substitute', 'helpinghand', 'helping-hand'];
  const attack = getMoves(p).find(m => !supportMoves.includes(normalize(m)));
  return attack || 'Ataque Neutro';
}

export function resolveTurnPlanLines(
  lead: [PokemonData, PokemonData],
  strategy: { id: string; name: string; objective: string },
  format: string
): TurnPlanLine[] {
  const [first, second] = lead;
  const lines: TurnPlanLine[] = [];

  // 1. Linha A: Setup / Controle de Velocidade ou Clima (se aplicável)
  const isTrStrategy = strategy.id.includes('trick_room');

  if (isTrStrategy) {
    const setter = hasMove(first, 'Trick Room') ? first : (hasMove(second, 'Trick Room') ? second : undefined);
    const partner = setter === first ? second : first;

    if (setter) {
      const partnerAction = hasMove(partner, 'Protect') ? 'Protect' : (hasMove(partner, 'Rage Powder') ? 'Rage Powder' : (hasMove(partner, 'Follow Me') ? 'Follow Me' : getBestAttackingMove(partner)));
      const partnerReason = partnerAction === 'Protect' ? 'Proteger para garantir sobrevivência no turno do setup' : `Suportar ${setter.name} durante a ativação do Trick Room`;
      
      lines.push({
        id: 'line_setup_tr',
        actions: [
          { pokemon: setter.name, action: 'Trick Room', reasoning: 'Ativar a inversão de velocidade no Turno 1.' },
          { pokemon: partner.name, action: partnerAction, reasoning: partnerReason }
        ],
        objective: 'Configurar o controle de velocidade do Trick Room com suporte/proteção.',
        risks: ['Vulnerabilidade a Taunt direcionado no setter.', 'Pressão de dano em área do oponente.']
      });
    }
  } else if (hasMove(first, 'Tailwind') || hasMove(second, 'Tailwind')) {
    const setter = hasMove(first, 'Tailwind') ? first : second;
    const partner = setter === first ? second : first;
    const partnerAction = hasMove(partner, 'Protect') ? 'Protect' : getBestAttackingMove(partner);

    lines.push({
      id: 'line_setup_tailwind',
      actions: [
        { pokemon: setter.name, action: 'Tailwind', reasoning: 'Dobrar a velocidade dos Pokémon aliados pelos próximos turnos.' },
        { pokemon: partner.name, action: partnerAction, reasoning: partnerAction === 'Protect' ? 'Proteger para segurar a pressão inicial' : 'Atacar para pressionar alvos frágeis' }
      ],
      objective: 'Ativar vento favorável para garantir a iniciativa ofensiva no early game.',
      risks: ['Oponente usar Trick Room para reverter a vantagem.', 'Oponente ativar Tailwind próprio.']
    });
  }

  // 2. Linha B: Pressão Ofensiva Pura (Ambos Atacam)
  const firstAttack = getBestAttackingMove(first);
  const secondAttack = getBestAttackingMove(second);
  lines.push({
    id: 'line_offensive_pressure',
    actions: [
      { pokemon: first.name, action: firstAttack, reasoning: `Desferir dano imediato com ${firstAttack}.` },
      { pokemon: second.name, action: secondAttack, reasoning: `Desferir dano imediato com ${secondAttack}.` }
    ],
    objective: 'Dobrar o foco ofensivo para forçar um nocaute rápido ou remover um alvo de ameaça.',
    risks: ['Oponente usar Protect em um dos lados, desperdiçando o dano.', 'Tomar dano massivo de volta de alvos mais rápidos.']
  });

  // 3. Linha C: Abertura Defensiva / Controle de Entrada (Protect duplo ou Switch)
  if (hasMove(first, 'Protect') && hasMove(second, 'Protect')) {
    lines.push({
      id: 'line_double_protect',
      actions: [
        { pokemon: first.name, action: 'Protect', reasoning: 'Proteger para observar o posicionamento e golpes adversários.' },
        { pokemon: second.name, action: 'Protect', reasoning: 'Proteger para observar o posicionamento e golpes adversários.' }
      ],
      objective: 'Garantir sobrevivência total no turno 1 e gastar recursos de Fake Out do adversário.',
      risks: ['Oponente aproveitar o turno livre para configurar um plano próprio de setup ou reposicionamento.']
    });
  } else {
    // Linha de troca tática (Switch)
    lines.push({
      id: 'line_tactical_switch',
      actions: [
        { pokemon: first.name, action: 'Protect', reasoning: 'Segurar a posição de forma segura.' },
        { pokemon: second.name, action: 'Switch', reasoning: 'Trocar para um membro do banco resistente a ameaças.' }
      ],
      objective: 'Reposicionar o time de forma defensiva sob pressão inicial desfavorável.',
      risks: ['Predição de switch por parte do adversário.', 'Tomar dano na entrada do substituto.']
    });
  }

  return lines;
}
