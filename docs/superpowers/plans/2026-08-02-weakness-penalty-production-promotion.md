# Promoção a Produção da Penalidade de Empilhamento de Fraquezas — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ligar a penalidade de empilhamento de fraqueza elemental em produção com segurança: peso calibrado (não a força total, dado o risco já confirmado), atrás de um flag de config com rollback sem redeploy de código, e só depois de confirmar que os 5 arquétipos já validados do Build-Around-Lead continuam aceitando pelo menos 1 estratégia cada.

**Architecture:** `FirstCompleteTeamBuilder` troca seu parâmetro `applyWeaknessPenalty: boolean` por `weaknessPenaltyWeight: number` (multiplicador da penalidade). O peso é lido de uma env var via `LeadBuildRuntimeFlags.ts` (o módulo que já centraliza flags de runtime lidas de `process.env` para este mesmo pipeline) e passado por injeção de dependência através de `PrimaryStrategySearch.ts` → `AnytimeSearchCoordinator.executeSearch()` → `FirstCompleteTeamBuilder.build()`. Um teste E2E local confirma que os 5 arquétipos do Build-Around-Lead (`sun_offense`, `tailwind_rush`, `defensive_core`, `trick_room`, `rain_offense`) continuam aceitando pelo menos 1 estratégia com o peso calibrado ligado.

**Tech Stack:** TypeScript, `ts-node` (scripts/testes standalone, padrão `assert()` custom já usado no repo), Mongo via `IsolatedTestDatabase` para o teste E2E.

## Global Constraints

- `weaknessPenaltyWeight` deve ter default `0` em toda a cadeia — nenhum comportamento de produção muda até a env var ser setada manualmente.
- Só a penalidade suave (`totalPenalty * weaknessPenaltyWeight`) é usada — não ligar `pruned`/`valid` de `evaluatePartialTeamDefensiveQuality`.
- Não modificar `evaluateDefensiveQuality.ts`, `TeamDefensiveProfile.ts`, `CombinationSearchEngine.ts`, ou qualquer arquivo do fluxo geral de Team Builder (fora do Build-Around-Lead) — `hard_trick_room` (`VgcArchetypeBlueprints.ts`) pertence a esse outro fluxo e **não** é um dos 5 arquétipos deste plano; o correspondente no Build-Around-Lead é `trick_room` (`LeadStrategyGenerator.ts`).
- O peso de produção calibrado é **0.6** (ver Task 2 — já calibrado nesta sessão: mantém `StrategicPick` em 1º lugar na primeira rodada do Cenário C e resolve totalmente o Cenário A; W=0.8 e W=1.0 derrubam o pick estratégico para 2º lugar).
- Este plano **não** inclui o deploy real (setar a env var em produção + Manual Deploy + curl) — isso é feito manualmente depois, com aprovação explícita do usuário a cada etapa.
- Rodar `npx tsc --noEmit` após cada task antes de commitar.

---

## Task 1: Trocar `applyWeaknessPenalty: boolean` por `weaknessPenaltyWeight: number`

**Files:**
- Modify: `src/equinox/lead-build/FirstCompleteTeamBuilder.ts`
- Modify: `src/equinox/lead-build/FirstCompleteTeamBuilder.test.ts`

**Interfaces:**
- Produces: `FirstCompleteTeamBuilderInput.weaknessPenaltyWeight?: number` (default `0`) — consumido pela Task 3 (wiring de produção) e Task 2 (script de calibração).

- [ ] **Step 1: Ler o estado atual do arquivo (já lido nesta sessão)**

`FirstCompleteTeamBuilder.ts` hoje (linhas 9-30, resto inalterado):

```ts
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
```

- [ ] **Step 2: Atualizar o teste existente primeiro (a chamada com `applyWeaknessPenalty: true` deixa de compilar)**

Em `src/equinox/lead-build/FirstCompleteTeamBuilder.test.ts`, trocar (linha 70):

```ts
  const withPenalty = builder.build({ lead, candidates, applyWeaknessPenalty: true });
```

por:

```ts
  const withPenalty = builder.build({ lead, candidates, weaknessPenaltyWeight: 1 });
```

(Matematicamente idêntico ao comportamento já testado e aprovado no PR #51 — `weaknessPenaltyWeight: 1` multiplica a penalidade por 1, igual a `applyWeaknessPenalty: true`.)

- [ ] **Step 3: Rodar o teste para confirmar que falha (o parâmetro ainda não existe)**

Run: `npx ts-node src/equinox/lead-build/FirstCompleteTeamBuilder.test.ts`

Expected: erro de compilação do `ts-node` — `Object literal may only specify known properties, and 'weaknessPenaltyWeight' does not exist in type 'FirstCompleteTeamBuilderInput'`.

- [ ] **Step 4: Implementar a mudança em `FirstCompleteTeamBuilder.ts`**

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
   * Peso da penalidade de empilhamento de fraqueza elemental (default 0,
   * sem efeito). Multiplica `evaluatePartialTeamDefensiveQuality(...).totalPenalty`
   * antes de subtrair do score de cada candidato durante a montagem do
   * time — 0 desliga completamente, 1 aplica a penalidade em força total.
   * Peso de produção calibrado: 0.6 (ver
   * docs/superpowers/specs/2026-08-02-weakness-penalty-production-promotion-design.md).
   */
  weaknessPenaltyWeight?: number;
}

export class FirstCompleteTeamBuilder {
  public build(input: FirstCompleteTeamBuilderInput): CompleteTeamCandidate | null {
    const { lead, candidates, strategy, compositionPlan, candidateCapabilityIndex, requestContext, format = 'champions_reg_m_b_doubles', weaknessPenaltyWeight = 0 } = input;
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
        const penaltyA = weaknessPenaltyWeight > 0
          ? evaluatePartialTeamDefensiveQuality([...chosen, a], remainingSlots, pool).totalPenalty * weaknessPenaltyWeight
          : 0;
        const penaltyB = weaknessPenaltyWeight > 0
          ? evaluatePartialTeamDefensiveQuality([...chosen, b], remainingSlots, pool).totalPenalty * weaknessPenaltyWeight
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

- [ ] **Step 6: `tsc` e commit**

Run: `npx tsc --noEmit` — esperado: sem output.

```bash
git add src/equinox/lead-build/FirstCompleteTeamBuilder.ts src/equinox/lead-build/FirstCompleteTeamBuilder.test.ts
git commit -m "refactor: trocar applyWeaknessPenalty (boolean) por weaknessPenaltyWeight (numero)

Prepara o parametro para receber um peso calibrado em vez de forca total,
dado o risco confirmado na revisao final do experimento anterior (PR #51):
com forca total (W=1), a penalidade pode cancelar por completo um score de
estrategia real. Default continua 0 (desligado) -- comportamento de
producao inalterado. weaknessPenaltyWeight: 1 e matematicamente identico
ao antigo applyWeaknessPenalty: true, entao o teste existente so troca de
nome/tipo, nao de comportamento esperado."
```

---

## Task 2: Estender o script de experimento para calibrar e confirmar W=0.6

**Files:**
- Modify: `src/scripts/experimentWeaknessPenalty.ts`

**Interfaces:**
- Consumes: `FirstCompleteTeamBuilder.build(input: FirstCompleteTeamBuilderInput)` com `weaknessPenaltyWeight` (Task 1).
- Produces: nada consumido por outra task — confirma, com evidência impressa, que W=0.6 é o valor certo antes das tasks seguintes usarem esse número.

- [ ] **Step 1: Ler o estado atual do arquivo (já lido nesta sessão) e localizar `runScenario`/`main`**

O arquivo hoje usa `applyWeaknessPenalty: false`/`true` nas linhas 167-168 (dentro de `runScenario`) e chama só `scenarioA`, `scenarioB`, `scenarioC` em `main()` (linhas 199-204). `scenarioC` já existe com `StrategicPick`/`DefensiveResistC1-4`/`FillerC1-3` e a `strategyC` com as roles `special-attacker`/`tailwind-setter` — não precisa recriar esses dados, só trocar a forma como `runScenario` é chamado para o Cenário C.

- [ ] **Step 2: Trocar `runScenario` para aceitar um peso, e adicionar uma função de calibração específica para o Cenário C**

Em `src/scripts/experimentWeaknessPenalty.ts`, trocar a assinatura e corpo de `runScenario`:

```ts
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
```

- [ ] **Step 3: Atualizar `main()` para chamar a calibração e rodar os 3 cenários com W=0.6**

```ts
function main(): void {
  console.log('🧪 Experimento: penalidade de empilhamento de fraquezas no FirstCompleteTeamBuilder');
  calibrateScenarioC();
  runScenario(scenarioA, 0.6);
  runScenario(scenarioB, 0.6);
  runScenario(scenarioC, 0.6);
}

main();
```

- [ ] **Step 4: Rodar o script e confirmar que a calibração reproduz o achado desta sessão**

Run: `npx ts-node src/scripts/experimentWeaknessPenalty.ts`

Expected (a calibração deve mostrar StrategicPick na posição 1 para W ≤ 0.6 e não-1 para W ≥ 0.8 — os números exatos de `totalScore` podem variar ligeiramente da sessão anterior por causa de ordem de iteração determinística do `Array.sort`, mas a posição de `StrategicPick` na calibração e a ausência de empilhamento crítico nos Cenários A/B com W=0.6 devem se confirmar):

```
=== Calibração do Cenário C — posição de StrategicPick na 1ª rodada por peso ===
  W=0: StrategicPick termina na posição 1 do time final ...
  W=0.25: StrategicPick termina na posição 1 do time final ...
  W=0.4: StrategicPick termina na posição 1 do time final ...
  W=0.6: StrategicPick termina na posição 1 do time final ...
  W=0.8: StrategicPick termina na posição 2 do time final ...
  W=1: StrategicPick termina na posição 2 do time final ...
```

Se a saída real divergir desta previsão (ex.: W=0.6 também derrubar `StrategicPick`), **pare** — não prossiga para a Task 3 com W=0.6 sem reportar a divergência real, já que o valor de produção depende diretamente desta confirmação.

- [ ] **Step 5: `tsc` e commit**

Run: `npx tsc --noEmit` — esperado: sem output.

```bash
git add src/scripts/experimentWeaknessPenalty.ts
git commit -m "feat(experiment): calibrar peso W do experimento de penalidade de fraqueza

Estende o script para testar uma faixa de pesos (0 a 1) no Cenario C e
confirmar que W=0.6 e o maior valor que mantem o pick estrategico em 1a
posicao na primeira rodada de escolha, enquanto ainda resolve
completamente o empilhamento critico do Cenario A. Cenarios A/B/C agora
rodam com W=0.6 (nao mais forca total) como o valor candidato a producao."
```

---

## Task 3: Flag de config + wiring até `FirstCompleteTeamBuilder`

**Files:**
- Modify: `src/equinox/lead-build/LeadBuildRuntimeFlags.ts`
- Modify: `src/equinox/lead-build/AnytimeSearchCoordinator.ts`
- Modify: `src/equinox/lead-build/PrimaryStrategySearch.ts`
- Test: `src/equinox/lead-build/LeadBuildRuntimeFlags.test.ts` (novo)

**Interfaces:**
- Consumes: `FirstCompleteTeamBuilderInput.weaknessPenaltyWeight?: number` (Task 1).
- Produces: `LeadBuildRuntimeFlags.weaknessPenaltyWeight: number`; `AnytimeSearchCoordinatorInput.weaknessPenaltyWeight?: number` — consumido pela Task 4 (regressão E2E, via a env var lida por `getLeadBuildRuntimeFlags()`).

- [ ] **Step 1: Ler o estado atual (já lido nesta sessão)**

`LeadBuildRuntimeFlags.ts` hoje:

```ts
export interface LeadBuildRuntimeFlags {
  anytimeCompositionSearchEnabled: boolean;
  legacySearchFallbackEnabled: boolean;
}

export function getLeadBuildRuntimeFlags(env: Record<string, string | undefined> = process.env): LeadBuildRuntimeFlags {
  const anytimeDisabled = env.EQUINOX_ANYTIME_SEARCH_ENABLED === 'false';
  const legacyEnabled = env.EQUINOX_LEGACY_SEARCH_FALLBACK === 'true';

  return {
    anytimeCompositionSearchEnabled: !anytimeDisabled,
    legacySearchFallbackEnabled: legacyEnabled,
  };
}
```

`AnytimeSearchCoordinator.ts` hoje declara `AnytimeSearchCoordinatorInput` (linhas 12-22) sem `weaknessPenaltyWeight`, e chama `this.teamBuilder.build({...})` (linhas 106-113) sem passar esse campo.

`PrimaryStrategySearch.ts` hoje (linhas 44-68) já chama `const flags = getLeadBuildRuntimeFlags();` (linha 45) e usa `flags.anytimeCompositionSearchEnabled` (linha 57) antes de montar o objeto passado para `anytimeCoordinator.executeSearch({...})` (linhas 58-68) — **este é o call site real de produção**, não `LeadStrategyRecommendationService.ts` (correção em relação ao spec original: `LeadStrategyRecommendationService.ts` nunca chama `AnytimeSearchCoordinator` diretamente, quem chama é `PrimaryStrategySearch.ts`).

- [ ] **Step 2: Escrever o teste (TDD) para `LeadBuildRuntimeFlags`**

Criar `src/equinox/lead-build/LeadBuildRuntimeFlags.test.ts`:

```ts
import { getLeadBuildRuntimeFlags } from './LeadBuildRuntimeFlags';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

function main(): void {
  // Default: sem env var nenhuma, weaknessPenaltyWeight deve ser 0.
  const noEnv = getLeadBuildRuntimeFlags({});
  assert(noEnv.weaknessPenaltyWeight === 0, `Sem env var, weaknessPenaltyWeight deveria ser 0, mas foi ${noEnv.weaknessPenaltyWeight}`);

  // Valor valido e propagado corretamente.
  const withValue = getLeadBuildRuntimeFlags({ EQUINOX_WEAKNESS_PENALTY_WEIGHT: '0.6' });
  assert(withValue.weaknessPenaltyWeight === 0.6, `Com EQUINOX_WEAKNESS_PENALTY_WEIGHT=0.6, esperado 0.6, mas foi ${withValue.weaknessPenaltyWeight}`);

  // Fail-safe: valor invalido (NaN) cai para 0, nao liga a penalidade por acidente.
  const invalidValue = getLeadBuildRuntimeFlags({ EQUINOX_WEAKNESS_PENALTY_WEIGHT: 'not-a-number' });
  assert(invalidValue.weaknessPenaltyWeight === 0, `Com valor invalido, esperado fallback para 0, mas foi ${invalidValue.weaknessPenaltyWeight}`);

  // Fail-safe: valor negativo tambem cai para 0.
  const negativeValue = getLeadBuildRuntimeFlags({ EQUINOX_WEAKNESS_PENALTY_WEIGHT: '-0.5' });
  assert(negativeValue.weaknessPenaltyWeight === 0, `Com valor negativo, esperado fallback para 0, mas foi ${negativeValue.weaknessPenaltyWeight}`);

  console.log('✅ LeadBuildRuntimeFlags.test PASS');
}

main();
```

- [ ] **Step 3: Rodar o teste para confirmar que falha**

Run: `npx ts-node src/equinox/lead-build/LeadBuildRuntimeFlags.test.ts`

Expected: `TypeError: Cannot read properties of undefined (reading 'weaknessPenaltyWeight')` ou falha de asserção — o campo ainda não existe no retorno de `getLeadBuildRuntimeFlags`.

- [ ] **Step 4: Implementar em `LeadBuildRuntimeFlags.ts`**

```ts
export interface LeadBuildRuntimeFlags {
  anytimeCompositionSearchEnabled: boolean;
  legacySearchFallbackEnabled: boolean;
  weaknessPenaltyWeight: number;
}

function parseWeaknessPenaltyWeight(value: string | undefined): number {
  if (value === undefined) return 0;
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return parsed;
}

export function getLeadBuildRuntimeFlags(env: Record<string, string | undefined> = process.env): LeadBuildRuntimeFlags {
  const anytimeDisabled = env.EQUINOX_ANYTIME_SEARCH_ENABLED === 'false';
  const legacyEnabled = env.EQUINOX_LEGACY_SEARCH_FALLBACK === 'true';

  return {
    anytimeCompositionSearchEnabled: !anytimeDisabled,
    legacySearchFallbackEnabled: legacyEnabled,
    weaknessPenaltyWeight: parseWeaknessPenaltyWeight(env.EQUINOX_WEAKNESS_PENALTY_WEIGHT),
  };
}
```

- [ ] **Step 5: Rodar o teste para confirmar que passa**

Run: `npx ts-node src/equinox/lead-build/LeadBuildRuntimeFlags.test.ts`

Expected: `✅ LeadBuildRuntimeFlags.test PASS`

- [ ] **Step 6: Wiring em `AnytimeSearchCoordinator.ts`**

Em `src/equinox/lead-build/AnytimeSearchCoordinator.ts`, adicionar o campo à interface (depois de `nowMs: () => number;`, linha 21):

```ts
export interface AnytimeSearchCoordinatorInput {
  lead: readonly PokemonData[];
  strategies: readonly LeadStrategyCandidate[];
  candidates: readonly PokemonData[];
  format: string;
  requestContext: LeadBuildRequestContext;
  resolveCompetitiveTeam?: (team: PokemonData[], format: string) => PokemonData[];
  startedAtMs: number;
  globalDeadlineMs: number;
  nowMs: () => number;
  weaknessPenaltyWeight?: number;
}
```

E extrair o campo na desestruturação (linha 35) e passá-lo para `this.teamBuilder.build(...)` (linhas 106-113):

```ts
    const { lead, strategies, candidates, format, requestContext, resolveCompetitiveTeam, globalDeadlineMs, nowMs, weaknessPenaltyWeight } = input;
```

```ts
        const candidateStruct = this.teamBuilder.build({
          lead,
          strategy: strategyObj,
          compositionPlan,
          candidateCapabilityIndex: capabilityIndex,
          candidates: availableForAttempt,
          requestContext,
          weaknessPenaltyWeight,
        });
```

- [ ] **Step 7: Wiring em `PrimaryStrategySearch.ts`**

Em `src/equinox/lead-build/PrimaryStrategySearch.ts`, dentro de `executePrimaryStrategySearch`, adicionar `weaknessPenaltyWeight: flags.weaknessPenaltyWeight` à chamada de `anytimeCoordinator.executeSearch({...})` (linhas 58-68):

```ts
    const searchResult = await anytimeCoordinator.executeSearch({
      lead: input.lead,
      strategies: [strategy],
      candidates: input.candidates,
      format: input.format,
      requestContext: context,
      resolveCompetitiveTeam,
      startedAtMs: context.startedAtMs,
      globalDeadlineMs: context.phaseBudget ? context.phaseBudget.recoveryMustStartByMs : Date.now() + 6000,
      nowMs: () => systemMonotonicClock.now(),
      weaknessPenaltyWeight: flags.weaknessPenaltyWeight,
    });
```

(`flags` já existe na linha 45 — `const flags = getLeadBuildRuntimeFlags();` — nenhuma mudança de import necessária, `getLeadBuildRuntimeFlags` já é importado na linha 10.)

- [ ] **Step 8: `tsc` para confirmar que os 3 arquivos compilam juntos**

Run: `npx tsc --noEmit` — esperado: sem output.

- [ ] **Step 9: Rodar o teste E2E existente para confirmar que o wiring não muda nada com a env var ausente**

Run: `npx ts-node src/equinox/lead-build/PrimaryPoolSetCoherenceFilter.e2e.test.ts`

Expected (saída idêntica à de sempre — `weaknessPenaltyWeight` chega como `0` via `flags.weaknessPenaltyWeight` quando `EQUINOX_WEAKNESS_PENALTY_WEIGHT` não está setada):
```
🧪 Teste E2E: filtro de coerência interna no pool primário de candidatos...
  - Estratégias aceitas: 2
  - Sandslash-Alola (set incoerente) corretamente excluído de todos os times aceitos (OK)

✅ Teste E2E de filtro de coerência no pool primário passou.
```

- [ ] **Step 10: Commit**

```bash
git add src/equinox/lead-build/LeadBuildRuntimeFlags.ts src/equinox/lead-build/LeadBuildRuntimeFlags.test.ts src/equinox/lead-build/AnytimeSearchCoordinator.ts src/equinox/lead-build/PrimaryStrategySearch.ts
git commit -m "feat: conectar weaknessPenaltyWeight via flag de runtime (EQUINOX_WEAKNESS_PENALTY_WEIGHT)

Segue o padrao ja existente de LeadBuildRuntimeFlags.ts (mesmo modulo que
ja controla EQUINOX_ANYTIME_SEARCH_ENABLED/EQUINOX_LEGACY_SEARCH_FALLBACK
para este pipeline) em vez de appConfig -- e o modulo que o call site real
(PrimaryStrategySearch.ts, nao LeadStrategyRecommendationService.ts) ja
consome. Default 0 (comportamento de producao inalterado); fail-safe para
valores invalidos/negativos. Injecao de dependencia ate
FirstCompleteTeamBuilder.build(), sem nenhum import de config dentro de
AnytimeSearchCoordinator.ts."
```

---

## Task 4: Teste E2E de regressão dos 5 arquétipos com W=0.6

**Files:**
- Create: `src/equinox/lead-build/WeaknessPenaltyArchetypeRegression.e2e.test.ts`

**Interfaces:**
- Consumes: `LeadStrategyRecommendationService.execute(...)` (contrato já usado por todos os outros testes E2E desta sessão); `IsolatedTestDatabase`/`connectIsolatedTestDatabase` de `./testing/IsolatedTestDatabase`; `Pokemon`/`PokemonSet` models.
- Produces: nada consumido por outra task — é o gate final antes do deploy manual.

- [ ] **Step 1: Escrever o teste completo**

Criar `src/equinox/lead-build/WeaknessPenaltyArchetypeRegression.e2e.test.ts`:

```ts
process.env.EQUINOX_DATA_MODE = 'mongo';
process.env.EQUINOX_WEAKNESS_PENALTY_WEIGHT = '0.6';

import dotenv from 'dotenv';
dotenv.config();

import { connectIsolatedTestDatabase, IsolatedTestDatabase } from './testing/IsolatedTestDatabase';
import { LeadStrategyRecommendationService } from '../../services/LeadStrategyRecommendationService';
import { Pokemon } from '../../models/Pokemon';
import { PokemonSet } from '../../models/PokemonSet';

const FORMAT = 'champions_reg_m_b_doubles';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

function mon(dexNumber: number, name: string, types: string[], baseStats: any) {
  return {
    dexNumber, name, formatId: FORMAT, types,
    variants: [{ formatId: FORMAT, baseStats, types, abilities: { 0: 'Pressure' } }],
    isLegendary: false, usageScore: 90, formatLegality: { [FORMAT]: true },
  };
}

function set(pokemonName: string, item: string, ability: string, nature: string, evs: any, moves: string[], role = 'attacker') {
  return {
    pokemonName, formatId: FORMAT, setName: `${pokemonName} test`, item, ability, nature, evs,
    moves, role, synergyTags: [], legal: true, status: 'active', active: true, confidence: 80,
  };
}

/**
 * Reproduz os 5 arquétipos do Build-Around-Lead já validados nesta sessão
 * (sun_offense, tailwind_rush, defensive_core, trick_room, rain_offense —
 * gerados por LeadStrategyGenerator.ts, não confundir com o arquétipo
 * `hard_trick_room` do fluxo geral de Team Builder, que é outro sistema).
 * Com EQUINOX_WEAKNESS_PENALTY_WEIGHT=0.6 ligado, cada lead precisa
 * continuar aceitando pelo menos 1 estratégia.
 */
async function testSunTailwindDefensiveCore(db: IsolatedTestDatabase): Promise<void> {
  await Pokemon.create([
    mon(6, 'Charizard-Mega-Y', ['Fire', 'Flying'], { hp: 78, atk: 104, def: 78, spa: 159, spd: 115, spe: 100 }),
    mon(547, 'Whimsicott', ['Grass', 'Fairy'], { hp: 60, atk: 67, def: 85, spa: 77, spd: 75, spe: 116 }),
    mon(28, 'Sandslash-Alola', ['Ice', 'Steel'], { hp: 75, atk: 110, def: 120, spa: 30, spd: 65, spe: 75 }),
    mon(59, 'Arcanine-Hisui', ['Fire', 'Rock'], { hp: 95, atk: 115, def: 80, spa: 95, spd: 80, spe: 90 }),
    mon(31, 'Nidoqueen', ['Poison', 'Ground'], { hp: 90, atk: 92, def: 87, spa: 75, spd: 85, spe: 76 }),
    mon(73, 'Tentacruel', ['Water', 'Poison'], { hp: 80, atk: 70, def: 65, spa: 80, spd: 120, spe: 100 }),
    mon(812, 'Rillaboom', ['Grass'], { hp: 100, atk: 125, def: 90, spa: 60, spd: 70, spe: 85 }),
    mon(445, 'Garchomp', ['Dragon', 'Ground'], { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 }),
    mon(485, 'Heatran', ['Fire', 'Steel'], { hp: 91, atk: 90, def: 106, spa: 130, spd: 106, spe: 77 }),
    mon(149, 'Dragonite', ['Dragon', 'Flying'], { hp: 91, atk: 134, def: 95, spa: 100, spd: 100, spe: 80 }),
  ] as any);

  await PokemonSet.create([
    set('Sandslash-Alola', 'Muscle Band', 'Slush Rush', 'Naive', { hp: 0, atk: 124, def: 0, spa: 124, spd: 8, spe: 252 }, ['Ice Spinner', 'Iron Head', 'Protect', 'Rapid Spin']),
    set('Arcanine-Hisui', 'Covert Cloak', 'Intimidate', 'Adamant', { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 }, ['Flare Blitz', 'Rock Slide', 'Protect', 'High Horsepower']),
    set('Nidoqueen', 'Iapapa Berry', 'Poison Point', 'Sassy', { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 }, ['Poison Jab', 'High Horsepower', 'Protect', 'Rock Slide']),
    set('Tentacruel', 'Black Sludge', 'Clear Body', 'Timid', { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 }, ['Muddy Water', 'Sludge Bomb', 'Icy Wind', 'Protect']),
    set('Rillaboom', 'Assault Vest', 'Grassy Surge', 'Adamant', { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 }, ['Wood Hammer', 'Grassy Glide', 'U-turn', 'Fake Out']),
    set('Garchomp', 'Rocky Helmet', 'Rough Skin', 'Jolly', { hp: 252, atk: 4, def: 0, spa: 0, spd: 0, spe: 252 }, ['Dragon Claw', 'Earthquake', 'Rock Slide', 'Protect']),
    set('Heatran', 'Safety Goggles', 'Flash Fire', 'Calm', { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 }, ['Heat Wave', 'Earth Power', 'Protect', 'Taunt']),
    set('Dragonite', 'Loaded Dice', 'Multiscale', 'Adamant', { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 }, ['Scale Shot', 'Extreme Speed', 'Low Kick', 'Protect']),
  ] as any);

  const service = new LeadStrategyRecommendationService();
  const result: any = await service.execute({
    lead: [{ name: 'Charizard-Mega-Y' }, { name: 'Whimsicott' }],
    format: FORMAT, leadMode: 'fixed-lead', allowLegendaries: false, teamIdentity: 'archetype-regression-sun',
  });

  const strategyIds = (result.strategies ?? []).map((s: any) => s.strategy.id);
  for (const expected of ['sun_offense', 'tailwind_rush', 'defensive_core']) {
    assert(
      strategyIds.includes(expected),
      `Com weaknessPenaltyWeight=0.6, esperava ${expected} entre as estratégias aceitas, mas foram: ${strategyIds.join(', ') || '(nenhuma)'}`,
    );
  }
  console.log(`  ✅ sun_offense/tailwind_rush/defensive_core: aceitas (${strategyIds.join(', ')})`);
}

async function testTrickRoom(db: IsolatedTestDatabase): Promise<void> {
  await Pokemon.create([
    mon(3212, 'Farigiraf', ['Normal', 'Psychic'], { hp: 120, atk: 90, def: 70, spa: 110, spd: 70, spe: 60 }),
    mon(992, 'Iron Hands', ['Fighting', 'Electric'], { hp: 154, atk: 140, def: 108, spa: 50, spd: 68, spe: 50 }),
    mon(901, 'Ursaluna', ['Ground', 'Normal'], { hp: 130, atk: 140, def: 105, spa: 45, spd: 80, spe: 50 }),
    mon(876, 'Indeedee-F', ['Psychic', 'Normal'], { hp: 70, atk: 55, def: 65, spa: 95, spd: 105, spe: 95 }),
    mon(324, 'Torkoal', ['Fire'], { hp: 70, atk: 85, def: 140, spa: 85, spd: 70, spe: 20 }),
    mon(591, 'Amoonguss', ['Grass', 'Poison'], { hp: 114, atk: 85, def: 70, spa: 85, spd: 80, spe: 30 }),
    mon(858, 'Hatterene', ['Psychic', 'Fairy'], { hp: 57, atk: 90, def: 95, spa: 136, spd: 103, spe: 29 }),
    mon(812, 'Rillaboom', ['Grass'], { hp: 100, atk: 125, def: 90, spa: 60, spd: 70, spe: 85 }),
  ] as any);

  await PokemonSet.create([
    set('Farigiraf', 'Twisted Spoon', 'Armor Tail', 'Sassy', { hp: 252, atk: 0, def: 4, spa: 252, spd: 0, spe: 0 }, ['Trick Room', 'Psychic', 'Hyper Voice', 'Protect']),
    set('Iron Hands', 'Assault Vest', 'Quark Drive', 'Brave', { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 }, ['Close Combat', 'Wild Charge', 'Fake Out', 'Drain Punch']),
    set('Ursaluna', 'Flame Orb', 'Guts', 'Brave', { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 }, ['Facade', 'Earthquake', 'Headlong Rush', 'Protect']),
    set('Indeedee-F', 'Sitrus Berry', 'Psychic Surge', 'Sassy', { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 }, ['Follow Me', 'Psychic', 'Helping Hand', 'Protect']),
    set('Torkoal', 'Charcoal', 'Drought', 'Quiet', { hp: 252, atk: 0, def: 4, spa: 252, spd: 0, spe: 0 }, ['Eruption', 'Earth Power', 'Protect', 'Yawn']),
    set('Amoonguss', 'Sitrus Berry', 'Regenerator', 'Sassy', { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 }, ['Spore', 'Rage Powder', 'Pollen Puff', 'Protect']),
    set('Hatterene', 'Safety Goggles', 'Magic Bounce', 'Quiet', { hp: 252, atk: 0, def: 4, spa: 252, spd: 0, spe: 0 }, ['Dazzling Gleam', 'Mystical Fire', 'Trick Room', 'Protect']),
    set('Rillaboom', 'Assault Vest', 'Grassy Surge', 'Brave', { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 }, ['Wood Hammer', 'Grassy Glide', 'U-turn', 'Fake Out']),
  ] as any);

  const service = new LeadStrategyRecommendationService();
  const result: any = await service.execute({
    lead: [{ name: 'Farigiraf' }, { name: 'Iron Hands' }],
    format: FORMAT, leadMode: 'fixed-lead', allowLegendaries: false, teamIdentity: 'archetype-regression-tr',
  });

  const strategyIds = (result.strategies ?? []).map((s: any) => s.strategy.id);
  assert(
    strategyIds.includes('trick_room'),
    `Com weaknessPenaltyWeight=0.6, esperava trick_room entre as estratégias aceitas, mas foram: ${strategyIds.join(', ') || '(nenhuma)'}`,
  );
  console.log(`  ✅ trick_room: aceita (${strategyIds.join(', ')})`);
}

async function testRainOffense(db: IsolatedTestDatabase): Promise<void> {
  await Pokemon.create([
    mon(279, 'Pelipper', ['Water', 'Flying'], { hp: 60, atk: 50, def: 100, spa: 95, spd: 70, spe: 65 }),
    mon(902, 'Basculegion-M', ['Water', 'Ghost'], { hp: 120, atk: 112, def: 65, spa: 80, spd: 75, spe: 78 }),
    mon(550, 'Barraskewda', ['Water'], { hp: 61, atk: 123, def: 60, spa: 60, spd: 60, spe: 136 }),
    mon(272, 'Ludicolo', ['Water', 'Grass'], { hp: 80, atk: 70, def: 70, spa: 90, spd: 100, spe: 70 }),
    mon(983, 'Kingambit', ['Dark', 'Steel'], { hp: 100, atk: 135, def: 120, spa: 60, spd: 85, spe: 50 }),
    mon(591, 'Amoonguss', ['Grass', 'Poison'], { hp: 114, atk: 85, def: 70, spa: 85, spd: 80, spe: 30 }),
    mon(1017, 'Archaludon', ['Steel', 'Dragon'], { hp: 88, atk: 60, def: 122, spa: 118, spd: 85, spe: 72 }),
    mon(812, 'Rillaboom', ['Grass'], { hp: 100, atk: 125, def: 90, spa: 60, spd: 70, spe: 85 }),
  ] as any);

  await PokemonSet.create([
    set('Pelipper', 'Damp Rock', 'Drizzle', 'Bold', { hp: 252, atk: 0, def: 252, spa: 4, spd: 0, spe: 0 }, ['Hurricane', 'Scald', 'Tailwind', 'Protect']),
    set('Basculegion-M', 'Choice Band', 'Swift Swim', 'Adamant', { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 }, ['Wave Crash', 'Aqua Jet', 'Last Respects', 'Liquidation']),
    set('Barraskewda', 'Choice Band', 'Swift Swim', 'Adamant', { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 }, ['Liquidation', 'Close Combat', 'Flip Turn', 'Aqua Jet']),
    set('Ludicolo', 'Life Orb', 'Swift Swim', 'Modest', { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 }, ['Hydro Pump', 'Giga Drain', 'Ice Beam', 'Protect']),
    set('Kingambit', 'Black Glasses', 'Supreme Overlord', 'Adamant', { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 }, ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Protect']),
    set('Amoonguss', 'Sitrus Berry', 'Regenerator', 'Sassy', { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 }, ['Spore', 'Rage Powder', 'Pollen Puff', 'Protect']),
    set('Archaludon', 'Assault Vest', 'Stamina', 'Modest', { hp: 252, atk: 0, def: 4, spa: 252, spd: 0, spe: 0 }, ['Electro Shot', 'Flash Cannon', 'Draco Meteor', 'Body Press']),
    set('Rillaboom', 'Assault Vest', 'Grassy Surge', 'Adamant', { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 }, ['Wood Hammer', 'Grassy Glide', 'U-turn', 'Fake Out']),
  ] as any);

  const service = new LeadStrategyRecommendationService();
  const result: any = await service.execute({
    lead: [{ name: 'Pelipper' }, { name: 'Basculegion-M' }],
    format: FORMAT, leadMode: 'fixed-lead', allowLegendaries: false, teamIdentity: 'archetype-regression-rain',
  });

  const strategyIds = (result.strategies ?? []).map((s: any) => s.strategy.id);
  assert(
    strategyIds.includes('rain_offense'),
    `Com weaknessPenaltyWeight=0.6, esperava rain_offense entre as estratégias aceitas, mas foram: ${strategyIds.join(', ') || '(nenhuma)'}`,
  );
  console.log(`  ✅ rain_offense: aceita (${strategyIds.join(', ')})`);
}

async function main(): Promise<void> {
  console.log('🧪 Regressão dos 5 arquétipos do Build-Around-Lead com weaknessPenaltyWeight=0.6...');

  let db = await connectIsolatedTestDatabase();
  try {
    await testSunTailwindDefensiveCore(db);
  } finally {
    await db.dispose();
  }

  db = await connectIsolatedTestDatabase();
  try {
    await testTrickRoom(db);
  } finally {
    await db.dispose();
  }

  db = await connectIsolatedTestDatabase();
  try {
    await testRainOffense(db);
  } finally {
    await db.dispose();
  }

  console.log('\n✅ Todos os 5 arquétipos continuam aceitando pelo menos 1 estratégia com weaknessPenaltyWeight=0.6.');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Regressão de arquétipos falhou:', error);
    process.exit(1);
  });
```

- [ ] **Step 2: Rodar o teste**

Run: `npx ts-node src/equinox/lead-build/WeaknessPenaltyArchetypeRegression.e2e.test.ts`

Expected:
```
🧪 Regressão dos 5 arquétipos do Build-Around-Lead com weaknessPenaltyWeight=0.6...
  ✅ sun_offense/tailwind_rush/defensive_core: aceitas (...)
  ✅ trick_room: aceita (trick_room)
  ✅ rain_offense: aceita (rain_offense)

✅ Todos os 5 arquétipos continuam aceitando pelo menos 1 estratégia com weaknessPenaltyWeight=0.6.
```

Se qualquer arquétipo falhar (não aparecer na lista de `strategies` aceitas), **pare** — isso significa que W=0.6 regride um arquétipo real e o valor de produção precisa ser reconsiderado (voltar à Task 2 com um W menor, ou investigar por que este arquétipo específico é mais sensível) antes de qualquer deploy.

- [ ] **Step 3: `tsc` e commit**

Run: `npx tsc --noEmit` — esperado: sem output.

```bash
git add src/equinox/lead-build/WeaknessPenaltyArchetypeRegression.e2e.test.ts
git commit -m "test: regressao E2E dos 5 arquetipos do Build-Around-Lead com weaknessPenaltyWeight=0.6

Confirma, contra o pipeline real (LeadStrategyRecommendationService.execute,
nao chamada direta ao builder), que sun_offense/tailwind_rush/defensive_core
(lead Charizard-Mega-Y+Whimsicott), trick_room (lead Farigiraf+Iron Hands) e
rain_offense (lead Pelipper+Basculegion-M) continuam aceitando pelo menos 1
estrategia cada com a penalidade calibrada ligada -- a precondicao bloqueante
documentada no spec do experimento anterior, agora satisfeita antes de
qualquer deploy real."
```

---

## Depois deste plano (não incluído — passo manual)

1. Deploy do código com `EQUINOX_WEAKNESS_PENALTY_WEIGHT` **não setada** no Render (fica em 0, comportamento inalterado) — confirmar via curl que os resultados de sempre continuam iguais.
2. Só depois, com aprovação explícita do usuário: setar `EQUINOX_WEAKNESS_PENALTY_WEIGHT=0.6` no painel do Render + novo Manual Deploy.
3. Re-confirmar os 5 arquétipos via curl real contra a API implantada.
4. Rollback, se necessário: remover/zerar a env var e re-deployar — sem reverter nenhum código.
