# Experimento: penalidade de empilhamento de fraquezas no FirstCompleteTeamBuilder

## Contexto

Times gerados pelo Build-Around-Lead podem empilhar fraqueza elemental pesada
(ex.: 5/6 membros fracos a Fogo, 4/6 a Gelo/Voador, 3/6 a Psíquico) sem
nenhum sinal de erro. Investigação prévia (agente `Explore`, mesma sessão)
mapeou a causa:

- O único gate "duro" de qualidade defensiva (`evaluateDefensiveQuality.ts`,
  chamado de `FullTeamEvaluator.ts:711`) só marca um tipo como crítico
  quando **nenhum** dos 6 membros resiste/é imune àquele tipo. Basta 1
  membro resistir para o gate passar, mesmo com os outros 5 fracos.
- `weightedExposure` (`TeamDefensiveProfile.ts:223`), a métrica que
  descreveria esse empilhamento com mais nuance, é calculada mas nunca lida
  em nenhum outro lugar do código — puramente decorativa.
- `calculateDefensiveCoverageScore` (soft score) entra no `overallScore`
  com peso de só 25%, diluído por 4 outras dimensões — pode ser mascarado.
- **O builder que efetivamente monta o time em produção hoje,
  `FirstCompleteTeamBuilder.ts` (confirmado via
  `firstCompleteTeamBuilderInvocationCount` nos runtime diagnostics reais),
  não considera cobertura defensiva em NENHUM momento da escolha de
  candidatos** — só `scoreCandidateForStrategy` + bônus de set curado +
  `usageScore` como desempate (`FirstCompleteTeamBuilder.ts:40-46`).
- Existe um mecanismo pronto e testado para isso, só que num builder legado
  não usado em produção (`legacyExpandBeamInvocationCount=0` nos mesmos
  diagnostics): `PartialTeamDefensiveEvaluator.ts`, com
  `evaluatePartialTeamDefensiveQuality()` — penalidade escalonada por
  fraqueza-sem-resposta acumulada (0 pts até 2, 8 pts em 3, 20 em 4, 40 em
  5+) e um corte de poda para casos irrecuperáveis.

## Objetivo deste experimento

Validar, **sem alterar o comportamento de produção**, se reaproveitar
`evaluatePartialTeamDefensiveQuality()` dentro do comparador de ordenação
do `FirstCompleteTeamBuilder.ts` reduz o empilhamento de fraquezas nos
times finais, antes de decidir se isso vira um fix permanente.

## Escopo

- Não é uma correção definitiva — é uma comparação instrumentada,
  reversível, controlada por parâmetro.
- Só a penalidade suave (`totalPenalty`) é usada. O corte de poda
  (`pruned`/`valid`) do `PartialTeamDefensiveEvaluator` **não** é ligado
  neste experimento (decisão do usuário: soft-score primeiro, hard gate é
  decisão separada e futura).
- Nenhum teste automatizado formal é escrito nesta fase — o script de
  comparação é a evidência. Se os números confirmarem melhora sem regressão
  nos arquétipos que já funcionam nesta sessão (sun_offense, tailwind_rush,
  defensive_core, hard_trick_room, rain_offense), formalizamos com TDD antes
  de tornar o comportamento padrão.

## Design

### 1. Mudança mínima em `FirstCompleteTeamBuilder.ts`

Adicionar um parâmetro opcional `applyWeaknessPenalty?: boolean` (default
`false` — comportamento atual inalterado) à função que constrói o time.
Quando `true`, o comparador de ordenação do pool (linhas 40-46) passa a
subtrair `evaluatePartialTeamDefensiveQuality(candidateTeam, remainingSlots,
poolRestante).totalPenalty` do score de cada candidato antes de comparar:

```ts
const penaltyA = applyWeaknessPenalty
  ? evaluatePartialTeamDefensiveQuality([...chosen, a], 6 - chosen.length - 1, pool).totalPenalty
  : 0;
const penaltyB = applyWeaknessPenalty
  ? evaluatePartialTeamDefensiveQuality([...chosen, b], 6 - chosen.length - 1, pool).totalPenalty
  : 0;
// score final de comparação já considera scoreCandidateForStrategy + bônus - penalidade
```

Como o parâmetro é opcional e default `false`, este commit sozinho não
muda nada em produção — é seguro de mesclar mesmo antes do experimento
terminar.

### 2. Script de comparação (`src/scripts/experimentWeaknessPenalty.ts`)

Não entra em produção — script standalone via `ts-node`, seguindo o mesmo
padrão dos outros scripts de validação local desta sessão (isolamento via
`IsolatedTestDatabase` ou dados em memória, sem afetar Mongo real).

Para cada lead de teste (Charizard-Mega-Y+Whimsicott, Aggron-Mega+Sinistcha,
mais 2-3 leads adicionais variados para generalizar — ex.: um lead sem
sinergia defensiva clara, um lead já testado nesta sessão como
`hard_trick_room`), roda o pipeline completo duas vezes: uma com
`applyWeaknessPenalty: false` (baseline) e outra com `true` (experimento).

Para cada execução, calcula `calculateTeamDefensiveProfile(fullTeam)` sobre
o time final e reporta:
- Quantos tipos (dos 18) têm `weakTargets >= 4 && defensiveAnswers === 0`
  (empilhamento crítico sem resposta).
- O pior caso: maior `weakTargets` para qualquer tipo com `defensiveAnswers
  === 0`.
- `totalScore` do perfil defensivo do time.
- Se a composição final do time mudou entre baseline e experimento.

Imprime uma tabela comparativa por lead/estratégia (baseline vs
experimento) ao final.

### 3. Critério de sucesso do experimento

- Nos leads testados, o experimento deve reduzir (ou não piorar) a contagem
  de tipos com empilhamento crítico sem resposta, comparado ao baseline.
- Os arquétipos já validados nesta sessão (sun_offense, tailwind_rush,
  defensive_core, hard_trick_room, rain_offense) devem continuar aceitando
  pelo menos 1 estratégia cada — o experimento não pode zerar resultados
  que já funcionavam (mesmo risco já visto com `NO_CAPABILITY_REQUESTS_DERIVED`
  ao adicionar filtros novos nesta sessão).

## Fora de escopo (decisões futuras, não deste experimento)

- Ligar o `pruned`/corte rígido do `PartialTeamDefensiveEvaluator`.
- Tornar `applyWeaknessPenalty: true` o padrão em produção.
- Mexer em `evaluateDefensiveQuality.ts` (o gate "duro" pós-hoc) ou em
  `weightedExposure` (`TeamDefensiveProfile.ts`) — permanecem como estão.
- Qualquer mudança no `CombinationSearchEngine.ts`/fluxo geral de Team
  Builder (fora do Build-Around-Lead) — este experimento é escopado só ao
  `FirstCompleteTeamBuilder.ts`, o builder ativo do fluxo de lead.

## Verificação

1. `npx tsc --noEmit` após a mudança em `FirstCompleteTeamBuilder.ts`.
2. Rodar o script de comparação e revisar a tabela de resultados com o
   usuário antes de qualquer decisão de tornar permanente.
3. Confirmar que `applyWeaknessPenalty` default `false` não muda nenhum
   resultado hoje já validado (rodar os testes E2E existentes desta sessão
   sem passar o parâmetro).

## Precondição antes de qualquer promoção a produção

Antes de `applyWeaknessPenalty` ser um dia definido como `true` por padrão
em código de produção (ou seja, antes de qualquer plano futuro que o
conecte em `AnytimeSearchCoordinator.ts` e/ou
`LeadStrategyRecommendationService.ts`), os arquétipos já validados
(sun_offense, tailwind_rush, defensive_core, hard_trick_room, rain_offense)
precisam ser re-executados contra o pipeline real de produção (via curl na
API implantada, ou pelo caminho E2E completo) e confirmados a continuar
aceitando pelo menos 1 estratégia cada.

Essa verificação **não foi feita** nesta fase experimental — o script de
comparação (`src/scripts/experimentWeaknessPenalty.ts`) roda inteiramente
em memória, fora do pipeline de produção, e não exercita nenhum dos
arquétipos citados. Isso não é opcional: o Cenário C do script (adicionado
para corrigir a finding #1 da revisão final) mostra que a penalidade de
empilhamento de fraqueza pode ter magnitude uma ordem de grandeza maior que
um score de estratégia real (dezenas contra centenas), o que é exatamente o
tipo de efeito que poderia zerar resultados de arquétipos hoje validados
sem nenhum aviso — o mesmo risco já observado nesta sessão com
`NO_CAPABILITY_REQUESTS_DERIVED` ao adicionar filtros novos. Esta
precondição fica registrada aqui como bloqueio explícito para qualquer
plano futuro de promoção.
