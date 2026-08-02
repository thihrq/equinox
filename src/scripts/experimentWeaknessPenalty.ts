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

interface Scenario {
  name: string;
  lead: PokemonData[];
  candidates: PokemonData[];
}

function mon(name: string, types: string[], usageScore: number): PokemonData {
  return { name, types, usageScore } as PokemonData;
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

function summarizeStacking(team: readonly PokemonData[]): {
  worstUnansweredType: string;
  worstUnansweredCount: number;
  typesWithCriticalStacking: number;
  totalScore: number;
} {
  const profile = calculateTeamDefensiveProfile(team as any);
  let worstUnansweredType = '';
  let worstUnansweredCount = -1;
  let typesWithCriticalStacking = 0;

  for (const type of ALL_POKEMON_TYPES) {
    const t = profile.byType[type];
    const unanswered = Math.max(0, t.weakTargets - t.defensiveAnswers);
    if (unanswered > worstUnansweredCount) {
      worstUnansweredCount = unanswered;
      worstUnansweredType = type;
    }
    if (t.weakTargets >= 4 && t.defensiveAnswers === 0) {
      typesWithCriticalStacking += 1;
    }
  }

  return { worstUnansweredType, worstUnansweredCount, typesWithCriticalStacking, totalScore: profile.totalScore };
}

function runScenario(scenario: Scenario): void {
  const builder = new FirstCompleteTeamBuilder();

  const baseInput: Omit<FirstCompleteTeamBuilderInput, 'applyWeaknessPenalty'> = {
    lead: scenario.lead,
    candidates: scenario.candidates,
  };

  const baseline = builder.build({ ...baseInput, applyWeaknessPenalty: false });
  const experiment = builder.build({ ...baseInput, applyWeaknessPenalty: true });

  console.log(`\n=== ${scenario.name} ===`);

  if (!baseline || !experiment) {
    console.log('  ⚠️  Um dos dois builds retornou null (pool insuficiente) — pulei a comparação.');
    return;
  }

  const baselineSummary = summarizeStacking(baseline.members);
  const experimentSummary = summarizeStacking(experiment.members);

  console.log(`  Baseline   (applyWeaknessPenalty=false): time=[${baseline.members.map(m => m.name).join(', ')}]`);
  console.log(`             pior tipo sem resposta: ${baselineSummary.worstUnansweredType} (${baselineSummary.worstUnansweredCount} sem resposta), ` +
    `tipos com empilhamento crítico (4+/0 resp.): ${baselineSummary.typesWithCriticalStacking}, totalScore=${baselineSummary.totalScore}`);

  console.log(`  Experimento (applyWeaknessPenalty=true): time=[${experiment.members.map(m => m.name).join(', ')}]`);
  console.log(`             pior tipo sem resposta: ${experimentSummary.worstUnansweredType} (${experimentSummary.worstUnansweredCount} sem resposta), ` +
    `tipos com empilhamento crítico (4+/0 resp.): ${experimentSummary.typesWithCriticalStacking}, totalScore=${experimentSummary.totalScore}`);

  const delta = experimentSummary.worstUnansweredCount - baselineSummary.worstUnansweredCount;
  console.log(`  Δ pior caso sem resposta: ${delta > 0 ? '+' : ''}${delta} (negativo = melhora)`);
}

function main(): void {
  console.log('🧪 Experimento: penalidade de empilhamento de fraquezas no FirstCompleteTeamBuilder');
  runScenario(scenarioA);
  runScenario(scenarioB);
}

main();
