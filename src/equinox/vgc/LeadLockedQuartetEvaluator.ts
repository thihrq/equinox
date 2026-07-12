// src/equinox/vgc/LeadLockedQuartetEvaluator.ts
// Avalia combinações de quartetos com lead travada e gera C(4,2)=6 backlines

import type { PokemonData } from '../core/AnalysisContext';
import type {
  LeadLockedQuartet,
  LeadStrategyCandidate,
  PlannedTurn,
  StrategyRoleRequirement,
} from './LeadBuildTypes';
import { validateModeContract, type VgcModeContract } from './VgcModeContractValidator';
import { resolveTurnPlanLines } from './VgcTurnPlanResolver';
import { getPokemonTypes, getSpeciesClauseKey, getVariant } from '../utils/PokemonUtils';
import { getDamageMultiplier } from '../utils/DamageMultiplier';
import { isMegaOption } from '../utils/VgcSetOptimizer';

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
  return (p.moves ?? []).map(m => normalize(m));
}

function hasMove(p: PokemonData, move: string): boolean {
  return getMoves(p).includes(normalize(move));
}

function hasAnyMove(p: PokemonData, moves: string[]): boolean {
  const normalizedMoves = getMoves(p);
  return moves.some(m => normalizedMoves.includes(normalize(m)));
}

function getBaseSpeed(p: PokemonData, format: string): number {
  return Number(getVariant(p, format)?.baseStats?.spe ?? 80);
}

function getBaseStats(p: PokemonData, format: string) {
  return getVariant(p, format)?.baseStats ?? {};
}

// ─── Gerador de Plano de Abertura ──────────────────────────────────────────────

function generateOpeningPlan(
  lead: [PokemonData, PokemonData],
  strategy: LeadStrategyCandidate,
  format: string,
): PlannedTurn[] {
  const [first, second] = lead;
  const plans: PlannedTurn[] = [];

  // Usa as ações do turno 1 da estratégia como guia
  for (const option of strategy.turnOneOptions) {
    const pokemon = option.pokemonName === first.name ? first : second;
    // Confirma que o Pokémon realmente tem o golpe/ação
    const actionNormalized = normalize(option.action);
    const canExecute = getMoves(pokemon).includes(actionNormalized)
      || actionNormalized === 'protect'
      || getAbility(pokemon, format) === actionNormalized;

    if (canExecute) {
      plans.push({
        turn: 1,
        pokemon: pokemon.name,
        action: option.action,
        reasoning: option.reasoning,
      });
    }
  }

  // Se nenhuma ação foi confirmada, gerar fallback
  if (plans.length === 0) {
    plans.push({
      turn: 1,
      pokemon: first.name,
      action: 'Protect',
      reasoning: 'Abertura segura para avaliar o posicionamento adversário.',
    });
    plans.push({
      turn: 1,
      pokemon: second.name,
      action: 'Protect',
      reasoning: 'Abertura segura para avaliar o posicionamento adversário.',
    });
  }

  return plans;
}

// ─── Gerador de Plano de Transição ─────────────────────────────────────────────

function generateTransitionPlan(
  selectedFour: PokemonData[],
  lead: [PokemonData, PokemonData],
  backline: [PokemonData, PokemonData],
  strategy: LeadStrategyCandidate,
  format: string,
): PlannedTurn[] {
  const plans: PlannedTurn[] = [];
  const [leadA, leadB] = lead;
  const [backA, backB] = backline;

  // Pivot: Se um dos Pokémon do banco tem Fake Out, sugerir entrada para controle
  for (const benchPokemon of backline) {
    if (hasMove(benchPokemon, 'Fake Out')) {
      plans.push({
        turn: 2,
        pokemon: benchPokemon.name,
        action: 'Fake Out',
        target: 'ameaça principal',
        reasoning: `Trazer ${benchPokemon.name} do banco para usar Fake Out e travar uma ameaça.`,
      });
    }
  }

  // Trick Room: Se o setter está na lead e TR ativo, trocar para atacantes lentos
  if (strategy.speedAxis === 'slow') {
    const slowAttackers = selectedFour
      .filter(p => getBaseSpeed(p, format) <= 50 && !lead.some(l => l.name === p.name))
      .sort((a, b) => getBaseSpeed(a, format) - getBaseSpeed(b, format));

    for (const slow of slowAttackers.slice(0, 1)) {
      plans.push({
        turn: 3,
        pokemon: slow.name,
        action: 'Entrada sob Trick Room',
        reasoning: `${slow.name} (Speed ${getBaseSpeed(slow, format)}) se beneficia do Trick Room para atacar primeiro.`,
      });
    }
  }

  // Fallback: sugerir troca defensiva se lead fraquejar
  if (plans.length === 0) {
    const bestDefensiveSwitch = backline
      .sort((a, b) => {
        const statsA = getBaseStats(a, format);
        const statsB = getBaseStats(b, format);
        const defA = Number(statsA.def ?? 80) + Number(statsA.spd ?? 80);
        const defB = Number(statsB.def ?? 80) + Number(statsB.spd ?? 80);
        return defB - defA;
      })[0];

    if (bestDefensiveSwitch) {
      plans.push({
        turn: 2,
        pokemon: bestDefensiveSwitch.name,
        action: 'Entrada defensiva',
        reasoning: `Troca segura para ${bestDefensiveSwitch.name} para absorver pressão adversária.`,
      });
    }
  }

  return plans;
}

// ─── Identificação de Condições de Vitória ──────────────────────────────────────

function identifyWinConditions(
  selectedFour: PokemonData[],
  strategy: LeadStrategyCandidate,
  format: string,
): string[] {
  const conditions: string[] = [];

  // Clima + Abuser = Win condition principal
  if (strategy.id.includes('rain')) {
    const swiftSwimmers = selectedFour.filter(p => normalize(getAbility(p, format)) === 'swiftswim');
    if (swiftSwimmers.length > 0) {
      conditions.push(`Pressão ofensiva sob Chuva com ${swiftSwimmers.map(p => p.name).join(' e ')} dobrando velocidade via Swift Swim.`);
    }
  }
  if (strategy.id.includes('sun')) {
    const chlorophyllers = selectedFour.filter(p => normalize(getAbility(p, format)) === 'chlorophyll');
    if (chlorophyllers.length > 0) {
      conditions.push(`Velocidade dobrada sob Sol com ${chlorophyllers.map(p => p.name).join(' e ')} via Chlorophyll.`);
    }
  }

  // Trick Room + Atacantes Lentos
  if (strategy.speedAxis === 'slow') {
    const slowHitters = selectedFour.filter(p => {
      const stats = getBaseStats(p, format);
      return getBaseSpeed(p, format) <= 50 && Math.max(Number(stats.atk ?? 0), Number(stats.spa ?? 0)) >= 100;
    });
    if (slowHitters.length > 0) {
      conditions.push(`Domínio sob Trick Room com ${slowHitters.map(p => p.name).join(' e ')} atacando primeiro.`);
    }
  }

  // Tailwind + Atacantes Rápidos
  if (strategy.speedAxis === 'fast') {
    const fastHitters = selectedFour.filter(p => getBaseSpeed(p, format) >= 80);
    if (fastHitters.length > 0) {
      conditions.push(`Controle de velocidade via Tailwind para ${fastHitters.map(p => p.name).join(', ')}.`);
    }
  }

  // Fallback genérico
  if (conditions.length === 0) {
    conditions.push('Pressão ofensiva gradual com cobertura de tipos e trocas posicionais.');
  }

  return conditions;
}

// ─── Identificação de Riscos ────────────────────────────────────────────────────

export function generateAssessment(
  selectedFour: PokemonData[],
  lead: [PokemonData, PokemonData],
  backline: [PokemonData, PokemonData],
  strategy: LeadStrategyCandidate,
  validationErrors: string[],
  validationWarnings: string[],
  format: string
): { contractErrors: any[]; warnings: any[]; matchupRisks: any[] } {
  const contractErrors: any[] = validationErrors.map((msg, idx) => ({
    code: `CONTRACT_ERR_${idx}`,
    message: msg,
    severity: 'error'
  }));

  const warnings: any[] = [];

  // Alerta: somente um setter de Trick Room no modo TR
  const trSetters = selectedFour.filter(p => hasMove(p, 'Trick Room')).length;
  if (strategy.id.includes('trick_room') && trSetters === 1) {
    warnings.push({
      code: 'WARN_SINGLE_TR_SETTER',
      message: 'Apenas um Pokémon possui Trick Room: facilidade para o oponente focar o setter.',
      severity: 'warning'
    });
  }

  // Alerta: falta de atacante especial
  const hasSpecialAttacker = selectedFour.some(p => {
    const variant = getVariant(p, format);
    const spa = variant?.baseStats?.spa ?? 80;
    return spa >= 90;
  });
  if (!hasSpecialAttacker) {
    warnings.push({
      code: 'WARN_NO_SPECIAL_ATTACKER',
      message: 'Falta de atacante especial no quarteto: vulnerabilidade a oponentes com alta defesa física ou Intimidate.',
      severity: 'warning'
    });
  }

  // Alerta: excesso de suporte
  const supportCount = selectedFour.filter(p => {
    const role = normalize(p.role || p.competitive?.roles?.[0] || '');
    return role.includes('support') || role.includes('utility');
  }).length;
  if (supportCount >= 3) {
    warnings.push({
      code: 'WARN_EXCESSIVE_SUPPORT',
      message: 'Excesso de Pokémon de suporte (3 ou mais): falta de pressão ofensiva imediata para finalizar alvos.',
      severity: 'warning'
    });
  }

  // Alerta: pouca pressão ofensiva
  const offensiveCount = selectedFour.filter(p => {
    const role = normalize(p.role || p.competitive?.roles?.[0] || '');
    return role.includes('breaker') || role.includes('sweeper') || role.includes('attacker');
  }).length;
  if (offensiveCount <= 1) {
    warnings.push({
      code: 'WARN_LOW_OFFENSIVE_PRESSURE',
      message: 'Pouca pressão ofensiva no quarteto (1 ou menos atacantes dedicados): dificuldade para forçar nocautes.',
      severity: 'warning'
    });
  }

  const matchupRisks: any[] = [];
  const allTypes = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];

  // Risco: fraquezas compartilhadas
  for (const atkType of allTypes) {
    const weakCount = selectedFour.filter(p => {
      const types = getPokemonTypes(p, format);
      return getDamageMultiplier(types, atkType) >= 2.0;
    }).length;
    if (weakCount >= 3) {
      matchupRisks.push({
        code: `RISK_WEAKNESS_${atkType.toUpperCase()}`,
        message: `Fraqueza compartilhada a ${atkType}: ${weakCount} dos 4 Pokémon são vulneráveis.`,
        severity: 'risk'
      });
    }
  }

  // Risco: ambos da lead fracos ao mesmo tipo
  const leadWeaknesses = allTypes.filter(atkType =>
    lead.every(p => getDamageMultiplier(getPokemonTypes(p, format), atkType) >= 2.0)
  );
  for (const weakness of leadWeaknesses) {
    matchupRisks.push({
      code: `RISK_LEAD_WEAKNESS_${weakness.toUpperCase()}`,
      message: `Ambos os Pokémon da lead são fracos a ${weakness}: pressão imediata do adversário no turno 1.`,
      severity: 'risk'
    });
  }

  // Risco: vulnerabilidade a Taunt
  const hasTauntTarget = selectedFour.some(p => hasAnyMove(p, ['Trick Room', 'Rage Powder', 'Follow Me', 'Spore', 'Sleep Powder']));
  const hasTauntProtection = selectedFour.some(p => {
    const item = normalize(p.item ?? '');
    const ability = getAbility(p, format);
    return item.includes('mentalherb') || ability.includes('oblivious') || ability.includes('aromaveil');
  });
  if (hasTauntTarget && !hasTauntProtection) {
    matchupRisks.push({
      code: 'RISK_TAUNT_VULNERABILITY',
      message: 'Alta vulnerabilidade a Taunt: oponentes rápidos com Taunt podem paralisar o setup da lead.',
      severity: 'risk'
    });
  }

  // Risco: dependência de clima
  const weatherSetters = selectedFour.filter(p => {
    const ability = getAbility(p, format);
    return ability.includes('drizzle') || ability.includes('drought') || ability.includes('sandstream') || ability.includes('snowwarning');
  }).length;
  if (strategy.id.includes('rain') && weatherSetters === 1) {
    matchupRisks.push({
      code: 'RISK_WEATHER_DEPENDENCY',
      message: 'Dependência de clima: se o oponente alterar o clima, você perderá os bônus de velocidade/dano.',
      severity: 'risk'
    });
  }

  // Risco: Wide Guard block
  const hasAreaMoveOnly = selectedFour.some(p => hasAnyMove(p, ['Muddy Water', 'Rock Slide', 'Earthquake', 'Expanding Force', 'Dazzling Gleam', 'Hyper Voice']));
  if (hasAreaMoveOnly) {
    matchupRisks.push({
      code: 'RISK_WIDE_GUARD_BLOCK',
      message: 'Sensibilidade a Wide Guard: parte dos seus danos principais são golpes em área que podem ser paralisados por Wide Guard adversário.',
      severity: 'risk'
    });
  }

  // Risco: Intimidate threat
  const physicalAttackers = selectedFour.filter(p => {
    const variant = getVariant(p, format);
    const atk = variant?.baseStats?.atk ?? 80;
    const spa = variant?.baseStats?.spa ?? 80;
    return atk > spa + 10;
  }).length;
  if (physicalAttackers >= 3) {
    matchupRisks.push({
      code: 'RISK_INTIMIDATE_THREAT',
      message: 'Vulnerabilidade a Intimidate: 3 ou mais Pokémon atacantes físicos no quarteto.',
      severity: 'risk'
    });
  }

  return { contractErrors, warnings, matchupRisks };
}

function identifyRisks(
  selectedFour: PokemonData[],
  lead: [PokemonData, PokemonData],
  format: string,
): string[] {
  // Mantemos compatibilidade com o retorno string[] legado da identifyRisks
  const allTypes = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];
  const risks: string[] = [];
  for (const atkType of allTypes) {
    const weakCount = selectedFour.filter(p => getDamageMultiplier(getPokemonTypes(p, format), atkType) >= 2.0).length;
    if (weakCount >= 3) {
      risks.push(`Fraqueza compartilhada a ${atkType}: ${weakCount} dos 4 Pokémon são vulneráveis.`);
    }
  }
  const leadWeaknesses = allTypes.filter(atkType => lead.every(p => getDamageMultiplier(getPokemonTypes(p, format), atkType) >= 2.0));
  for (const weakness of leadWeaknesses) {
    risks.push(`Ambos os Pokémon da lead são fracos a ${weakness}: pressão imediata do adversário.`);
  }
  return risks;
}

// ─── Scoring do Quarteto ────────────────────────────────────────────────────────

function scoreQuartet(
  selectedFour: PokemonData[],
  lead: [PokemonData, PokemonData],
  backline: [PokemonData, PokemonData],
  strategy: LeadStrategyCandidate,
  format: string,
): number {
  let score = 50; // Base

  // Bônus: Lead tem clima + abuser no quarteto
  if (strategy.id.includes('rain') || strategy.id.includes('sun') || strategy.id.includes('sand') || strategy.id.includes('snow')) {
    const climateAbusers = selectedFour.filter(p => {
      const ability = normalize(getAbility(p, format));
      return ['swiftswim', 'chlorophyll', 'sandrush', 'slushrush'].includes(ability);
    });
    score += climateAbusers.length * 12;
  }

  // Bônus: Fake Out presente no quarteto
  if (selectedFour.some(p => hasMove(p, 'Fake Out'))) {
    score += 8;
  }

  // Bônus: Redirecionamento presente
  if (selectedFour.some(p => hasAnyMove(p, ['Follow Me', 'Rage Powder']))) {
    score += 10;
  }

  // Bônus: Diversidade de tipos ofensivos na lead
  const leadSTABTypes = new Set(lead.flatMap(p => getPokemonTypes(p, format)));
  score += Math.min(leadSTABTypes.size * 4, 16);

  // Penalidade: Backline com tipagem redundante
  const backlineTypes = backline.flatMap(p => getPokemonTypes(p, format).map(normalize));
  const uniqueBacklineTypes = new Set(backlineTypes);
  if (uniqueBacklineTypes.size < backlineTypes.length) {
    score -= 5;
  }

  // Bônus: Cobertura de fraquezas da lead pelo banco
  for (const backPokemon of backline) {
    const backTypes = getPokemonTypes(backPokemon, format);
    for (const leadPokemon of lead) {
      const leadPokemonTypes = getPokemonTypes(leadPokemon, format);
      const allTypeNames = ['Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Ground', 'Flying', 'Psychic', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];
      for (const atkType of allTypeNames) {
        if (getDamageMultiplier(leadPokemonTypes, atkType) >= 2.0 && getDamageMultiplier(backTypes, atkType) <= 0.5) {
          score += 3;
        }
      }
    }
  }

  return Math.min(100, Math.max(0, score));
}

// ─── Função Principal ───────────────────────────────────────────────────────────

export interface EvaluateQuartetsInput {
  fullTeam: PokemonData[];   // 6 Pokémon
  lead: [PokemonData, PokemonData];
  strategy: LeadStrategyCandidate;
  format: string;
}

export function evaluateLeadLockedQuartets(input: EvaluateQuartetsInput): LeadLockedQuartet[] {
  const { fullTeam, lead, strategy, format } = input;

  // Os 4 complementos são os Pokémon que NÃO estão na lead
  const leadNames = new Set(lead.map(p => p.name));
  const complements = fullTeam.filter(p => !leadNames.has(p.name));

  if (complements.length !== 4) {
    console.warn(`[LeadLockedQuartetEvaluator] Esperado 4 complementos, recebido ${complements.length}`);
    return [];
  }

  // Gerar C(4,2) = 6 combinações de backline
  const quartets: LeadLockedQuartet[] = [];

  for (let i = 0; i < complements.length; i++) {
    for (let j = i + 1; j < complements.length; j++) {
      const backline: [PokemonData, PokemonData] = [complements[i], complements[j]];
      const selectedFour: PokemonData[] = [...lead, ...backline];

      // Validar com VgcModeContractValidator
      const contract: VgcModeContract = {
        selectedFour: selectedFour.map(p => p.name),
        lead: lead.map(p => p.name),
        backline: backline.map(p => p.name),
      };

      const validation = validateModeContract(contract, fullTeam);

      // Gerar planos e avaliações estratégicas estruturadas
      const openingPlan = generateOpeningPlan(lead, strategy, format);
      const transitionPlan = generateTransitionPlan(selectedFour, lead, backline, strategy, format);
      const winConditions = identifyWinConditions(selectedFour, strategy, format);
      const assessment = generateAssessment(selectedFour, lead, backline, strategy, validation.errors, validation.warnings, format);
      const turnPlanLines = resolveTurnPlanLines(lead, strategy, format);
      
      const risks = [
        ...assessment.warnings.map(w => w.message),
        ...assessment.matchupRisks.map(r => r.message)
      ];

      let score = scoreQuartet(selectedFour, lead, backline, strategy, format);
      score = Math.min(100, Math.max(10, score - (assessment.warnings.length * 3) - (assessment.matchupRisks.length * 2)));

      quartets.push({
        selectedFour: selectedFour.map(p => p.name) as [string, string, string, string],
        lead: lead.map(p => p.name) as [string, string],
        backline: backline.map(p => p.name) as [string, string],
        strategyId: strategy.id,
        contractValid: validation.valid,
        score,
        openingPlan,
        transitionPlan,
        winConditions,
        risks,
        assessment,
        turnPlanLines,
      });
    }
  }

  // Ordenar por score decrescente, priorizando contratos válidos
  return quartets.sort((a, b) => {
    if (a.contractValid !== b.contractValid) return a.contractValid ? -1 : 1;
    return b.score - a.score;
  });
}
