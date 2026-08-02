# Experimento de Penalidade de Empilhamento de Fraquezas — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um parâmetro opcional e reversível (`applyWeaknessPenalty`, default `false`) ao `FirstCompleteTeamBuilder` que, quando ativado, penaliza candidatos que aumentam o empilhamento de fraqueza elemental sem resposta do time parcial — e escrever um script de comparação standalone que mede o efeito antes de decidir se vira padrão.

**Architecture:** `FirstCompleteTeamBuilder.ts` já ordena o pool de candidatos por score a cada iteração do loop de montagem (`pool.sort` dentro de `while (chosen.length < 6 ...)`). O experimento reaproveita `evaluatePartialTeamDefensiveQuality()` (`PartialTeamDefensiveEvaluator.ts`, já existente e testado) para calcular, a cada comparação `a` vs `b`, quanto cada candidato pioraria o empilhamento de fraqueza do time parcial (`chosen`), e subtrai esse valor (`totalPenalty`) do score usado no comparador — só quando `applyWeaknessPenalty === true`. Sem o parâmetro (ou com `false`), o comportamento é bit-a-bit idêntico ao atual.

**Tech Stack:** TypeScript, `ts-node` (scripts standalone, sem framework de teste — padrão `assert()` custom + `if (require.main === module)`, já usado em `FirstCompleteTeamBuilder.test.ts`).

## Global Constraints

- O parâmetro `applyWeaknessPenalty` deve ter default `false` — nenhum comportamento de produção muda com este plano sozinho.
- Só a penalidade suave (`totalPenalty`) é usada. Não ligar `pruned`/`valid` de `evaluatePartialTeamDefensiveQuality` neste plano.
- Não modificar `evaluateDefensiveQuality.ts`, `TeamDefensiveProfile.ts`, `CombinationSearchEngine.ts` ou qualquer código do fluxo geral de Team Builder (fora do Build-Around-Lead).
- Não plumbing do parâmetro através de `AnytimeSearchCoordinator.ts`/`LeadStrategyRecommendationService.ts` neste plano — o script de comparação chama `FirstCompleteTeamBuilder.build()` diretamente (unit-level), não o pipeline HTTP completo. Isso mantém a superfície de mudança em produção restrita a um único arquivo.
- Rodar `npx tsc --noEmit` após cada task antes de commitar.

---

## Task 1: Adicionar `applyWeaknessPenalty` ao `FirstCompleteTeamBuilder`

**Files:**
- Modify: `src/equinox/lead-build/FirstCompleteTeamBuilder.ts`
- Test: `src/equinox/lead-build/FirstCompleteTeamBuilder.test.ts`

**Interfaces:**
- Consumes: `evaluatePartialTeamDefensiveQuality(team: readonly any[], remainingSlots: number, remainingCandidates: readonly any[]): PartialTeamDefensiveResult` de `./PartialTeamDefensiveEvaluator` (já existe, assinatura confirmada em `PartialTeamDefensiveEvaluator.ts:47`). `PartialTeamDefensiveResult.totalPenalty: number`.
- Produces: `FirstCompleteTeamBuilderInput.applyWeaknessPenalty?: boolean` — usado pela Task 2 (teste) e Task 3 (script).

- [ ] **Step 1: Ler o arquivo atual para confirmar contexto antes de editar**

Já lido nesta sessão — conteúdo atual de `FirstCompleteTeamBuilder.ts` (linhas 1-74):

```ts
import type { PokemonData } from '../core/AnalysisContext';
import type { CompleteTeamCandidate } from './AnytimeSearchResult';
import type { TeamCompositionPlan } from './TeamCompositionPlan';
import type { CandidateCapabilityIndex } from './CandidateCapabilityIndex';
import type { LeadBuildRequestContext } from './LeadBuildRequestContext';
import { scoreCandidateForStrategy } from '../scoring/LeadStrategyCandidateScore';

export interface FirstCompleteTeamBuilderInput {
  lead: readonly PokemonData[];
  candidates: readonly PokemonData[];
  strategy?: any;
  compositionPlan?: TeamCompositionPlan;
  candidateCapabilityIndex?: CandidateCapabilityIndex;
  requestContext?: LeadBuildRequestContext;
  format?: string;
}

export class FirstCompleteTeamBuilder {
  public build(input: FirstCompleteTeamBuilderInput): CompleteTeamCandidate | null {
    const { lead, candidates, strategy, compositionPlan, candidateCapabilityIndex, requestContext, format = 'champions_reg_m_b_doubles' } = input;
    if (lead.length !== 2) return null;

    if (requestContext?.invocationCounters) {
      requestContext.invocationCounters.firstCompleteTeamBuilderInvocationCount += 1;
    }

    const chosen: PokemonData[] = [...lead];
    const speciesClauseKeys = new Set<string>();
    const itemKeys = new Set<string>();

    for (const member of lead) {
      speciesClauseKeys.add(member.name.toLowerCase());
      if (member.item) itemKeys.add(member.item.toLowerCase());
    }

    const pool = [...candidates];

    while (chosen.length < 6 && pool.length > 0) {
      // Ordenar dinamicamente o pool restante pelo score de estrategia relativo ao time parcial `chosen`
      pool.sort((a, b) => {
        const scoreA = strategy ? scoreCandidateForStrategy(a, strategy, chosen, format) : 0;
        const scoreB = strategy ? scoreCandidateForStrategy(b, strategy, chosen, format) : 0;
        const hasSetA = a.competitiveSet ? 1 : 0;
        const hasSetB = b.competitiveSet ? 1 : 0;
        return (scoreB + hasSetB * 200) - (scoreA + hasSetA * 200) ||
          ((b as any).usageScore ?? 0) - ((a as any).usageScore ?? 0);
      });

      const next = pool.shift();
      if (!next) break;

      const specKey = next.name.toLowerCase();
      const itemKey = next.item ? next.item.toLowerCase() : undefined;

      if (speciesClauseKeys.has(specKey)) continue;
      if (itemKey && itemKeys.has(itemKey)) continue;

      chosen.push(next);
      speciesClauseKeys.add(specKey);
      if (itemKey) itemKeys.add(itemKey);
    }

    if (chosen.length < 6) return null;

    return {
      members: chosen,
      legalityPrecheckPassed: true,
      structuralCompletenessPassed: true,
      compositionCoverageScore: 100,
      speciesIds: Array.from(speciesClauseKeys),
      itemIds: Array.from(itemKeys),
    };
  }
}
```

- [ ] **Step 2: Escrever o teste que falha primeiro (TDD)**

Adicionar ao final de `src/equinox/lead-build/FirstCompleteTeamBuilder.test.ts` (antes do bloco `if (require.main === module)`):

```ts
/**
 * Reproduz o empilhamento de fraqueza reportado pelo usuário (ex.: 5-6/6
 * membros fracos a um mesmo tipo sem nenhuma resposta defensiva). Lead e
 * 4 dos 5 candidatos do pool são Grass (fracos a Fire, 2.0x); só um
 * candidato (FireResistMon, tipo Fire) resiste a Fire (0.5x). Sem
 * strategy (scoreCandidateForStrategy nunca é chamado), o desempate cai
 * inteiramente em `usageScore` — os 4 candidatos Grass têm usageScore
 * estritamente maior que o candidato que resiste, então SEM a penalidade
 * o builder greedy escolhe os 4 Grass e deixa o resistente de fora.
 */
export function runWeaknessPenaltyExperimentTest() {
  const builder = new FirstCompleteTeamBuilder();

  const lead: PokemonData[] = [
    { name: 'GrassLead1', types: ['Grass'] } as PokemonData,
    { name: 'GrassLead2', types: ['Grass'] } as PokemonData,
  ];

  const candidates: PokemonData[] = [
    { name: 'FireWeakMon1', types: ['Grass'], usageScore: 54 } as PokemonData,
    { name: 'FireWeakMon2', types: ['Grass'], usageScore: 53 } as PokemonData,
    { name: 'FireWeakMon3', types: ['Grass'], usageScore: 52 } as PokemonData,
    { name: 'FireWeakMon4', types: ['Grass'], usageScore: 51 } as PokemonData,
    { name: 'FireResistMon', types: ['Fire'], usageScore: 50 } as PokemonData,
  ];

  const baseline = builder.build({ lead, candidates });
  assert(baseline !== null, 'Baseline deve retornar um time completo.');
  const baselineNames = baseline!.members.map(m => m.name);
  assert(
    !baselineNames.includes('FireResistMon'),
    `Baseline (sem penalidade) deveria excluir FireResistMon por ter usageScore mais baixo, mas o time foi: ${baselineNames.join(', ')}`,
  );

  const withPenalty = builder.build({ lead, candidates, applyWeaknessPenalty: true });
  assert(withPenalty !== null, 'Com penalidade deve retornar um time completo.');
  const withPenaltyNames = withPenalty!.members.map(m => m.name);
  assert(
    withPenaltyNames.includes('FireResistMon'),
    `Com applyWeaknessPenalty=true, FireResistMon deveria ser incluído para reduzir o empilhamento de Fire, mas o time foi: ${withPenaltyNames.join(', ')}`,
  );

  console.log('✅ FirstCompleteTeamBuilder weakness-penalty experiment test PASS');
}
```

Atualizar o bloco final do arquivo para rodar os dois testes:

```ts
if (require.main === module) {
  runFirstCompleteTeamBuilderTest();
  runWeaknessPenaltyExperimentTest();
}
```

- [ ] **Step 3: Rodar o teste para confirmar que falha**

Run: `npx ts-node src/equinox/lead-build/FirstCompleteTeamBuilder.test.ts`

Expected: A primeira asserção (`baseline` sem `FireResistMon`) deve passar (comportamento atual já é esse). A segunda parte falha com `TypeError: Object literal may only specify known properties, and 'applyWeaknessPenalty' does not exist in type 'FirstCompleteTeamBuilderInput'` na compilação do `ts-node`, ou — se o TS não barrar por causa de excesso de campos em objeto inline — falha em runtime na asserção `withPenaltyNames.includes('FireResistMon')` porque o parâmetro ainda não existe e o comportamento é idêntico ao baseline.

- [ ] **Step 4: Implementar a mudança mínima em `FirstCompleteTeamBuilder.ts`**

Substituir o conteúdo do arquivo por:

```ts
import type { PokemonData } from '../core/AnalysisContext';
import type { CompleteTeamCandidate } from './AnytimeSearchResult';
import type { TeamCompositionPlan } from './TeamCompositionPlan';
import type { CandidateCapabilityIndex } from './CandidateCapabilityIndex';
import type { LeadBuildRequestContext } from './LeadBuildRequestContext';
import { scoreCandidateForStrategy } from '../scoring/LeadStrategyCandidateScore';
import { evaluatePartialTeamDefensiveQuality } from './PartialTeamDefensiveEvaluator';

export interface FirstCompleteTeamBuilderInput {
  lead: readonly PokemonData[];
  candidates: readonly PokemonData[];
  strategy?: any;
  compositionPlan?: TeamCompositionPlan;
  candidateCapabilityIndex?: CandidateCapabilityIndex;
  requestContext?: LeadBuildRequestContext;
  format?: string;
  /**
   * Experimental (default false, sem efeito em produção hoje): quando
   * true, subtrai do score de cada candidato a penalidade de
   * `evaluatePartialTeamDefensiveQuality` para o time parcial resultante
   * de escolhê-lo, fazendo o builder preferir candidatos que reduzam o
   * empilhamento de fraqueza elemental sem resposta. Ver
   * docs/superpowers/specs/2026-08-02-weakness-stacking-penalty-experiment-design.md.
   */
  applyWeaknessPenalty?: boolean;
}

export class FirstCompleteTeamBuilder {
  public build(input: FirstCompleteTeamBuilderInput): CompleteTeamCandidate | null {
    const { lead, candidates, strategy, compositionPlan, candidateCapabilityIndex, requestContext, format = 'champions_reg_m_b_doubles', applyWeaknessPenalty = false } = input;
    if (lead.length !== 2) return null;

    if (requestContext?.invocationCounters) {
      requestContext.invocationCounters.firstCompleteTeamBuilderInvocationCount += 1;
    }

    const chosen: PokemonData[] = [...lead];
    const speciesClauseKeys = new Set<string>();
    const itemKeys = new Set<string>();

    for (const member of lead) {
      speciesClauseKeys.add(member.name.toLowerCase());
      if (member.item) itemKeys.add(member.item.toLowerCase());
    }

    const pool = [...candidates];

    while (chosen.length < 6 && pool.length > 0) {
      // Ordenar dinamicamente o pool restante pelo score de estrategia relativo ao time parcial `chosen`
      pool.sort((a, b) => {
        const scoreA = strategy ? scoreCandidateForStrategy(a, strategy, chosen, format) : 0;
        const scoreB = strategy ? scoreCandidateForStrategy(b, strategy, chosen, format) : 0;
        const hasSetA = a.competitiveSet ? 1 : 0;
        const hasSetB = b.competitiveSet ? 1 : 0;

        const remainingSlots = 6 - chosen.length - 1;
        const penaltyA = applyWeaknessPenalty
          ? evaluatePartialTeamDefensiveQuality([...chosen, a], remainingSlots, pool).totalPenalty
          : 0;
        const penaltyB = applyWeaknessPenalty
          ? evaluatePartialTeamDefensiveQuality([...chosen, b], remainingSlots, pool).totalPenalty
          : 0;

        return (scoreB + hasSetB * 200 - penaltyB) - (scoreA + hasSetA * 200 - penaltyA) ||
          ((b as any).usageScore ?? 0) - ((a as any).usageScore ?? 0);
      });

      const next = pool.shift();
      if (!next) break;

      const specKey = next.name.toLowerCase();
      const itemKey = next.item ? next.item.toLowerCase() : undefined;

      if (speciesClauseKeys.has(specKey)) continue;
      if (itemKey && itemKeys.has(itemKey)) continue;

      chosen.push(next);
      speciesClauseKeys.add(specKey);
      if (itemKey) itemKeys.add(itemKey);
    }

    if (chosen.length < 6) return null;

    return {
      members: chosen,
      legalityPrecheckPassed: true,
      structuralCompletenessPassed: true,
      compositionCoverageScore: 100,
      speciesIds: Array.from(speciesClauseKeys),
      itemIds: Array.from(itemKeys),
    };
  }
}
```

- [ ] **Step 5: Rodar o teste para confirmar que passa**

Run: `npx ts-node src/equinox/lead-build/FirstCompleteTeamBuilder.test.ts`

Expected:
```
✅ FirstCompleteTeamBuilder.test PASS
✅ FirstCompleteTeamBuilder weakness-penalty experiment test PASS
```

- [ ] **Step 6: Rodar `tsc` para confirmar que nada mais quebrou**

Run: `npx tsc --noEmit`

Expected: sem output (exit 0).

- [ ] **Step 6.5: Confirmar que o default `false` não muda nenhum resultado já validado nesta sessão**

Como nenhum call site (`AnytimeSearchCoordinator.ts`) foi alterado e o parâmetro é opcional com default `false`, o comportamento de produção é inalterado por construção — mas confirme rodando o E2E que já cobre o caminho real de `fetchAndScoreCandidates` + montagem de time (criado em sessão anterior, sem relação com este parâmetro):

Run: `npx ts-node src/equinox/lead-build/PrimaryPoolSetCoherenceFilter.e2e.test.ts`

Expected (saída idêntica à que já era produzida antes desta task, sem menção a `applyWeaknessPenalty`):
```
🧪 Teste E2E: filtro de coerência interna no pool primário de candidatos...
  - Estratégias aceitas: 2
  - Sandslash-Alola (set incoerente) corretamente excluído de todos os times aceitos (OK)

✅ Teste E2E de filtro de coerência no pool primário passou.
```

- [ ] **Step 7: Commit**

```bash
git add src/equinox/lead-build/FirstCompleteTeamBuilder.ts src/equinox/lead-build/FirstCompleteTeamBuilder.test.ts
git commit -m "feat: adicionar applyWeaknessPenalty experimental ao FirstCompleteTeamBuilder

Parametro opcional (default false, sem efeito em producao hoje) que
reaproveita evaluatePartialTeamDefensiveQuality (ja existente e testado,
so usado ate agora no builder legado LeadCompletionSearch) para penalizar
candidatos que aumentam o empilhamento de fraqueza elemental sem resposta
do time parcial durante a montagem. Ver docs/superpowers/specs/2026-08-02-weakness-stacking-penalty-experiment-design.md."
```

---

## Task 2: Script de comparação `experimentWeaknessPenalty.ts`

**Files:**
- Create: `src/scripts/experimentWeaknessPenalty.ts`
- Modify: `package.json` (novo script `"experiment:weakness-penalty"`)

**Interfaces:**
- Consumes: `FirstCompleteTeamBuilder.build(input: FirstCompleteTeamBuilderInput)` (Task 1, com `applyWeaknessPenalty`); `calculateTeamDefensiveProfile(team) => TeamDefensiveProfile` de `../equinox/lead-build/TeamDefensiveProfile`; `PokemonData` de `../equinox/core/AnalysisContext`.
- Produces: nada consumido por outra task — é o artefato final do experimento (saída de console).

- [ ] **Step 1: Escrever o script completo**

Criar `src/scripts/experimentWeaknessPenalty.ts`:

```ts
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
```

- [ ] **Step 2: Rodar o script e confirmar que executa sem erro**

Run: `npx ts-node src/scripts/experimentWeaknessPenalty.ts`

Expected: imprime os dois cenários, cada um com linha "Baseline" e "Experimento" e um "Δ pior caso sem resposta" negativo ou zero (nunca positivo — o experimento não pode piorar o pior caso nos cenários construídos). Para o Cenário B, o baseline deve mostrar `FireResistB1` ausente do time e o experimento deve mostrar `FireResistB1` presente (mesmo padrão validado no teste unitário da Task 1).

- [ ] **Step 3: Adicionar o script ao `package.json`**

Abrir `package.json`, localizar o bloco `"scripts"` (mesma área onde estão `"lead:pipeline:check"` e `"regression:check"`, por volta da linha 54-55) e adicionar uma nova entrada:

```json
    "experiment:weakness-penalty": "ts-node src/scripts/experimentWeaknessPenalty.ts",
```

Não adicionar este script ao `preflight` — é um experimento manual, não um gate de CI.

- [ ] **Step 4: Rodar via npm script para confirmar que o wiring funciona**

Run: `npm run experiment:weakness-penalty`

Expected: mesma saída do Step 2.

- [ ] **Step 5: Rodar `tsc` para confirmar que nada quebrou**

Run: `npx tsc --noEmit`

Expected: sem output (exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/scripts/experimentWeaknessPenalty.ts package.json
git commit -m "feat: script de comparacao para o experimento de penalidade de fraqueza

Roda o FirstCompleteTeamBuilder duas vezes por cenario (baseline vs
applyWeaknessPenalty=true) e compara o empilhamento de fraqueza elemental
do time final via calculateTeamDefensiveProfile. Nao entra no preflight —
uso manual via 'npm run experiment:weakness-penalty' para decidir, com o
usuario, se o comportamento vira padrao."
```

---

## Task 3: Revisar resultados com o usuário e decidir próximos passos

**Files:** nenhum arquivo novo — esta task é de revisão, não de código.

- [ ] **Step 1: Rodar o experimento uma última vez e capturar a saída completa**

Run: `npm run experiment:weakness-penalty`

- [ ] **Step 2: Apresentar a saída ao usuário**

Mostrar a tabela comparativa completa (os dois cenários) e destacar:
- Se `typesWithCriticalStacking` caiu para 0 no experimento em ambos os cenários.
- Se `Δ pior caso sem resposta` foi negativo (melhora) em ambos.
- Que nenhum arquivo de produção fora de `FirstCompleteTeamBuilder.ts` foi tocado, e que `applyWeaknessPenalty` continua `false` por padrão — nada mudou no comportamento real ainda.

- [ ] **Step 3: Perguntar ao usuário a decisão de próximo passo**

Opções a apresentar (não decidir sozinho):
1. Ligar `applyWeaknessPenalty: true` como padrão de produção (exige plumbing através de `AnytimeSearchCoordinator.ts` → `LeadStrategyRecommendationService.ts` — fora do escopo deste plano, precisa de um novo ciclo brainstorm → spec → plano).
2. Ajustar a fórmula de penalidade (`calculatePartialExposurePenalty` em `PartialTeamDefensiveEvaluator.ts`) antes de ligar em produção.
3. Rodar mais cenários no script antes de decidir (adicionar novos `Scenario` ao array de cenários em `experimentWeaknessPenalty.ts`, seguindo o mesmo padrão dos Cenários A/B).
4. Descartar o experimento e manter o comportamento atual.

Esta task não tem "Expected output" de comando — é um checkpoint de decisão humana antes de qualquer trabalho adicional.
