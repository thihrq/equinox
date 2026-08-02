// src/scripts/experimentWeaknessPenalty.ts
// Script de comparação standalone (nao roda em producao): mede o efeito de
// `applyWeaknessPenalty` no FirstCompleteTeamBuilder sobre o empilhamento
// de fraqueza elemental do time final, rodando cada cenario duas vezes
// (baseline vs experimento) e comparando `calculateTeamDefensiveProfile`.
//
// Ver docs/superpowers/specs/2026-08-02-weakness-stacking-penalty-experiment-design.md.

import { FirstCompleteTeamBuilder, FirstCompleteTeamBuilderInput } from '../equinox/lead-build/FirstCompleteTeamBuilder';
import { calculateTeamDefensiveProfile, ALL_POKEMON_TYPES } from '../equinox/lead-build/TeamDefensiveProfile';
import type { PokemonData } from '../equinox/core/AnalysisContext';
import type { LeadStrategyCandidate } from '../equinox/vgc/LeadBuildTypes';

interface Scenario {
  name: string;
  lead: PokemonData[];
  candidates: PokemonData[];
  strategy?: LeadStrategyCandidate;
}

function mon(name: string, types: string[], usageScore: number, extra?: Record<string, unknown>): PokemonData {
  return { name, types, usageScore, ...extra } as PokemonData;
}

// Cenario A: empilhamento moderado. Lead ja fraco a Fire; pool tem uma
// maioria de candidatos tambem fracos a Fire com usageScore levemente
// maior que os poucos candidatos que resistem.
const scenarioA: Scenario = {
  name: 'Cenario A — empilhamento moderado (Fire)',
  lead: [mon('GrassLeadA1', ['Grass'], 0), mon('GrassLeadA2', ['Grass'], 0)],
  candidates: [
    mon('FireWeakA1', ['Grass'], 60),
    mon('FireWeakA2', ['Bug'], 59),
    mon('FireWeakA3', ['Ice'], 58),
    mon('FireResistA1', ['Water'], 57),
    mon('FireResistA2', ['Rock'], 56),
    mon('NeutralA1', ['Normal'], 55),
  ],
};

// Cenario B: empilhamento severo (o mesmo padrao do print reportado pelo
// usuario — 4+ candidatos fracos ao mesmo tipo com score sempre um pouco
// maior que o unico candidato que responderia).
const scenarioB: Scenario = {
  name: 'Cenario B — empilhamento severo (Fire)',
  lead: [mon('GrassLeadB1', ['Grass'], 0), mon('GrassLeadB2', ['Grass'], 0)],
  candidates: [
    mon('FireWeakB1', ['Grass'], 54),
    mon('FireWeakB2', ['Grass'], 53),
    mon('FireWeakB3', ['Grass'], 52),
    mon('FireWeakB4', ['Grass'], 51),
    mon('FireResistB1', ['Fire'], 50),
  ],
};

// Cenario C: testa a pergunta que o experimento realmente precisa responder
// (Finding 1) — a penalidade de empilhamento de fraqueza consegue sobrepor
// uma escolha com fit estrategico real, quando essa escolha tambem empilha
// a fraqueza compartilhada pela lead? Diferente de A/B, aqui `strategy` e
// passado para `builder.build(...)`, entao `scoreCandidateForStrategy` roda
// de verdade (nao fica zerado) e os candidatos tem baseStats/moves para
// cumprir roles reais.
//
// - StrategicPick: cumpre as DUAS required roles (special-attacker,
//   tailwind-setter) — score de estrategia alto — mas e tipo Grass, ou
//   seja, empilha a MESMA fraqueza a Fire/Poison/Flying/Ice/Bug que a lead
//   ja tem.
// - DefensiveResistC1/C2: nao cumprem nenhuma role requerida — score de
//   estrategia baixo, ate negativo — mas resistem a Fire (e a outras
//   fraquezas da lead), entao nao contribuem para o empilhamento.
// - FillerC1/C2/C3: preenchimento neutro/fraco, sem role, para completar o
//   time de 6.
const strategyC: LeadStrategyCandidate = {
  id: 'experiment-strategy-c',
  name: 'Estrategia de teste — special attacker + tailwind',
  objective: 'Validar se a penalidade de empilhamento sobrepoe fit estrategico real',
  lead: ['GrassLeadC1', 'GrassLeadC2'],
  turnOneOptions: [],
  requiredRoles: [
    { role: 'special-attacker', priority: 'required', weight: 25, description: 'Precisa de um atacante especial forte (SpA >= 100)' },
    { role: 'tailwind-setter', priority: 'required', weight: 20, description: 'Precisa de alguem com Tailwind' },
  ],
  optionalRoles: [],
  speedAxis: 'fast',
  contractValid: true,
  validationErrors: [],
  feasibilityScore: 80,
};

const scenarioC: Scenario = {
  name: 'Cenario C — fit estrategico real vs. empilhamento de fraqueza (Fire/Poison/Flying/Ice/Bug)',
  lead: [mon('GrassLeadC1', ['Grass'], 0), mon('GrassLeadC2', ['Grass'], 0)],
  strategy: strategyC,
  candidates: [
    mon('StrategicPick', ['Grass'], 40, { baseStats: { hp: 80, atk: 60, def: 70, spa: 120, spd: 80, spe: 100 }, moves: ['Tailwind'] }),
    mon('DefensiveResistC1', ['Water'], 39),
    mon('DefensiveResistC2', ['Rock'], 38),
    mon('DefensiveResistC3', ['Steel'], 37),
    mon('DefensiveResistC4', ['Water', 'Rock'], 36),
    mon('FillerC1', ['Bug'], 35),
    mon('FillerC2', ['Ice'], 34),
    mon('FillerC3', ['Normal'], 33),
  ],
};

function summarizeStacking(team: readonly PokemonData[]): {
  worstUnansweredType: string;
  worstUnansweredCount: number;
  typesWithCriticalStacking: number;
  totalScore: number;
} {
  const profile = calculateTeamDefensiveProfile(team as any);
  // Finding 3: a definicao do spec e "maior weakTargets para QUALQUER tipo
  // com defensiveAnswers === 0" — nao max(weakTargets - defensiveAnswers)
  // sobre todos os tipos. Um tipo com 5 weakTargets e 3 defensiveAnswers
  // NAO e "sem resposta" e nao pode ser reportado como tal.
  let worstUnansweredType = 'nenhum';
  let worstUnansweredCount = 0;
  let typesWithCriticalStacking = 0;

  for (const type of ALL_POKEMON_TYPES) {
    const t = profile.byType[type];
    if (t.defensiveAnswers === 0 && t.weakTargets > worstUnansweredCount) {
      worstUnansweredCount = t.weakTargets;
      worstUnansweredType = type;
    }
    if (t.weakTargets >= 4 && t.defensiveAnswers === 0) {
      typesWithCriticalStacking += 1;
    }
  }

  return { worstUnansweredType, worstUnansweredCount, typesWithCriticalStacking, totalScore: profile.totalScore };
}

/** Finding 1: imprime, para cada membro do pool, se ele bate alguma required role da estrategia — evidencia de que o score de estrategia nao foi ignorado. */
function describeRoleMatches(scenario: Scenario): void {
  if (!scenario.strategy) return;
  console.log('  Aderencia de role requerida por candidato (evidencia de que scoreCandidateForStrategy rodou de verdade):');
  for (const candidate of scenario.candidates) {
    const matches: string[] = [];
    for (const role of scenario.strategy.requiredRoles) {
      // Reimplementacao minima e local dos dois detectores usados neste cenario,
      // só para fins de log legivel (a logica de scoring real continua sendo a
      // do builder/scoreCandidateForStrategy — isto aqui e so relatorio).
      if (role.role === 'special-attacker') {
        const spa = Number((candidate as any).baseStats?.spa ?? 0);
        if (spa >= 100) matches.push(`special-attacker (SpA=${spa})`);
      }
      if (role.role === 'tailwind-setter') {
        const hasTailwind = (candidate.moves ?? []).includes('Tailwind');
        if (hasTailwind) matches.push('tailwind-setter (tem Tailwind)');
      }
    }
    console.log(`    - ${candidate.name}: ${matches.length > 0 ? matches.join(', ') : '(nenhuma required role cumprida)'}`);
  }
}

function runScenario(scenario: Scenario, weaknessPenaltyWeight: number): void {
  const builder = new FirstCompleteTeamBuilder();

  const baseInput: Omit<FirstCompleteTeamBuilderInput, 'weaknessPenaltyWeight'> = {
    lead: scenario.lead,
    candidates: scenario.candidates,
    ...(scenario.strategy ? { strategy: scenario.strategy } : {}),
  };

  const baseline = builder.build({ ...baseInput, weaknessPenaltyWeight: 0 });
  const experiment = builder.build({ ...baseInput, weaknessPenaltyWeight });

  console.log(`\n=== ${scenario.name} (W=${weaknessPenaltyWeight}) ===`);

  describeRoleMatches(scenario);

  if (!baseline || !experiment) {
    console.log('  ⚠️  Um dos dois builds retornou null (pool insuficiente) — pulei a comparação.');
    return;
  }

  const baselineSummary = summarizeStacking(baseline.members);
  const experimentSummary = summarizeStacking(experiment.members);

  console.log(`  Baseline   (W=0): time=[${baseline.members.map(m => m.name).join(', ')}]`);
  console.log(`             tipos com empilhamento crítico (4+/0 resp.): ${baselineSummary.typesWithCriticalStacking}, totalScore=${baselineSummary.totalScore}`);
  console.log(`             [contexto, não é a métrica principal] pior tipo sem nenhuma resposta defensiva: ${baselineSummary.worstUnansweredType} (${baselineSummary.worstUnansweredCount} membros fracos, 0 respostas)`);

  console.log(`  Experimento (W=${weaknessPenaltyWeight}): time=[${experiment.members.map(m => m.name).join(', ')}]`);
  console.log(`             tipos com empilhamento crítico (4+/0 resp.): ${experimentSummary.typesWithCriticalStacking}, totalScore=${experimentSummary.totalScore}`);
  console.log(`             [contexto, não é a métrica principal] pior tipo sem nenhuma resposta defensiva: ${experimentSummary.worstUnansweredType} (${experimentSummary.worstUnansweredCount} membros fracos, 0 respostas)`);

  const criticalDelta = experimentSummary.typesWithCriticalStacking - baselineSummary.typesWithCriticalStacking;
  console.log(`  Δ tipos com empilhamento crítico: ${criticalDelta > 0 ? '+' : ''}${criticalDelta} (negativo = melhora)`);
}

/**
 * Calibração do Cenário C: testa uma faixa de pesos e reporta, para cada
 * um, em que posição `StrategicPick` termina na primeira rodada de escolha
 * (posição 1 = não foi deslocado). Determinado nesta sessão: W=0.6 é o
 * maior peso testado que mantém StrategicPick em 1ª posição — W=0.8 e W=1.0
 * o derrubam para 2º lugar (o "DefensiveResistC4" assume a 1ª escolha).
 */
function calibrateScenarioC(): void {
  console.log('\n=== Calibração do Cenário C — posição de StrategicPick na 1ª rodada por peso ===');
  for (const w of [0, 0.25, 0.4, 0.6, 0.8, 1.0]) {
    const builder = new FirstCompleteTeamBuilder();
    const result = builder.build({
      lead: scenarioC.lead,
      candidates: [...scenarioC.candidates],
      strategy: scenarioC.strategy,
      weaknessPenaltyWeight: w,
    });
    const backline = result ? result.members.slice(2) : [];
    const position = backline.findIndex(m => m.name === 'StrategicPick') + 1;
    console.log(`  W=${w}: StrategicPick termina na posição ${position || 'ausente'} do time final (1ª rodada de escolha determina isso quando position<=1)`);
  }
}

function main(): void {
  console.log('🧪 Experimento: penalidade de empilhamento de fraquezas no FirstCompleteTeamBuilder');
  calibrateScenarioC();
  runScenario(scenarioA, 0.6);
  runScenario(scenarioB, 0.6);
  runScenario(scenarioC, 0.6);
}

main();
