# Promoção a produção da penalidade de empilhamento de fraquezas

## Contexto

O experimento anterior (spec e plano de `2026-08-02-weakness-stacking-penalty-experiment-*`,
mergeado no PR [#51](https://github.com/thihrq/equinox/pull/51)) adicionou
`applyWeaknessPenalty?: boolean` (default `false`) ao
`FirstCompleteTeamBuilder`, reaproveitando `evaluatePartialTeamDefensiveQuality`
(`PartialTeamDefensiveEvaluator.ts`) para penalizar candidatos que aumentam o
empilhamento de fraqueza elemental sem resposta durante a montagem do time. O
parâmetro nunca foi conectado a nenhum call site de produção
(`AnytimeSearchCoordinator.ts`/`LeadStrategyRecommendationService.ts`) — hoje
não muda nada em produção.

A revisão final daquele trabalho encontrou um risco real e mensurado: num
cenário construído especificamente para testar isso (Cenário C do script
`experimentWeaknessPenalty.ts`), a penalidade (força total, sem nenhum
ajuste) **cancelou por completo** o score de um candidato que preenchia duas
roles obrigatórias de uma estratégia real — penalidade 40 contra score
líquido 40, empate exato, derrubando o candidato de 1º para 4º lugar na
primeira rodada de escolha. O spec do experimento documentou uma precondição
bloqueante: os arquétipos já validados nesta sessão (`sun_offense`,
`tailwind_rush`, `defensive_core`, `hard_trick_room`, `rain_offense`) nunca
foram re-testados contra o pipeline real com a penalidade ligada.

Testes adicionais com dois leads reais (Aggron-Mega+Sinistcha,
Charizard-Mega-Y+Whimsicott) e pools de candidatos reais mostraram que,
quando o pool já é defensivamente saudável, a penalidade não atrapalha nem
ajuda — o risco só se manifesta quando o pool força uma escolha difícil entre
"estrategicamente correto" e "defensivamente seguro".

## Objetivo

Ligar a penalidade de empilhamento de fraqueza em produção de forma segura:
com um coeficiente de peso calibrado (não a força total já sabida como
arriscada), atrás de um flag de config que permite rollback sem novo deploy
de código, e só depois de confirmar que não regride os arquétipos já
validados — tanto localmente quanto contra o pipeline real de produção.

## Design

### 1. Trocar o parâmetro booleano por um peso numérico

Em `FirstCompleteTeamBuilder.ts`, `FirstCompleteTeamBuilderInput.applyWeaknessPenalty?: boolean`
é substituído por `weaknessPenaltyWeight?: number` (default `0` — equivalente
a "desligado", preserva o comportamento atual byte-a-byte quando omitido ou
zero). A penalidade efetivamente subtraída no comparador passa a ser
`totalPenalty * weaknessPenaltyWeight` em vez de `totalPenalty` puro.

`FirstCompleteTeamBuilder.test.ts` é atualizado: a chamada que hoje usa
`applyWeaknessPenalty: true` passa a usar `weaknessPenaltyWeight: 1`
(matematicamente idêntico ao comportamento já testado e aprovado no PR #51 —
nenhuma mudança de comportamento nesse teste, só de nome/tipo do parâmetro).

### 2. Calibrar o peso W no script de experimento

Estender `src/scripts/experimentWeaknessPenalty.ts`: para o Cenário C
(penalidade vs. score de estratégia real), rodar com `weaknessPenaltyWeight`
em `[0.25, 0.4, 0.6, 1.0]` e reportar, para cada valor, se `StrategicPick`
mantém a 1ª colocação na primeira rodada de escolha (não apenas "sobrevive no
time final", que é um bar mais baixo já visto passar até com W=1 no pool
testado). Escolher, como valor de produção, o **maior** W dentre os testados
que ainda preserva a 1ª colocação do pick estratégico na Cenário C E resolve
completamente os Cenários A/B (0 tipos com empilhamento crítico) — maximizando
o efeito da penalidade dentro da margem de segurança confirmada.

Os Cenários A e B do script também são re-rodados com o W escolhido (não só
W=1) para confirmar que a força reduzida ainda resolve os casos que a força
total resolvia.

### 3. Flag de config, seguindo o padrão já existente

Em `src/config/env.ts`, novo campo `weaknessPenaltyWeight: number` na
interface `AppConfig`, lido via `parseFloat(process.env.EQUINOX_WEAKNESS_PENALTY_WEIGHT ?? '0')`
(default `0`, mesmo padrão de nomenclatura `EQUINOX_*` já usado por
`EQUINOX_USE_COMPETITIVE_SETS_V2` etc.). Se o valor parseado for `NaN` ou
negativo, cai para `0` (fail-safe: config inválida nunca liga a penalidade
por acidente).

`AnytimeSearchCoordinatorInput` ganha `weaknessPenaltyWeight?: number`,
repassado para `this.teamBuilder.build({ ..., weaknessPenaltyWeight })` no
único call site existente (`AnytimeSearchCoordinator.ts`, dentro do loop de
`executeSearch`). O coordinator não lê `appConfig` diretamente — segue o
padrão de injeção de dependência já usado pelos outros campos do input.

`LeadStrategyRecommendationService.ts` (quem já instancia e chama
`AnytimeSearchCoordinator.executeSearch`) passa `weaknessPenaltyWeight:
appConfig.weaknessPenaltyWeight`.

### 4. Checagem de regressão dos arquétipos — duas camadas

**Camada local (antes de qualquer deploy):** novo teste E2E
(`src/equinox/lead-build/WeaknessPenaltyArchetypeRegression.e2e.test.ts`)
que roda, contra Mongo isolado, os 5 arquétipos já validados nesta sessão —
para `sun_offense`/`tailwind_rush`/`defensive_core`, reaproveita o lead
Charizard-Mega-Y + Whimsicott e o pool de 8 candidatos reais já usado nos
probes desta conversa; para `hard_trick_room` e `rain_offense`, o plano de
implementação constrói leads e pools com a mesma metodologia (espécies
reais, tipos/status-base reais, papéis reais compatíveis com cada arquétipo —
um lead lento com abusers de Trick Room reais para o primeiro, um
setter de chuva real + abusadores de Swift Swim/chuva reais para o
segundo), já que os pools exatos usados quando esses dois arquétipos foram
validados originalmente não foram preservados em nenhum arquivo desta sessão.
Roda com o `weaknessPenaltyWeight` calibrado no passo 2, e assert que cada
arquétipo continua aceitando pelo menos 1 estratégia. Só se este teste
passar, avança para o deploy.

**Camada de produção real (depois do deploy):** o deploy inicial sobe o
código com `EQUINOX_WEAKNESS_PENALTY_WEIGHT` **não setado** no Render
(fica em `0`, comportamento de produção inalterado — deploy seguro por
construção). Só depois de confirmado no ar, o usuário seta a env var pro W
calibrado no painel do Render e dispara um novo Manual Deploy — aí sim os 5
arquétipos são re-confirmados via curl real contra a API implantada, o mesmo
padrão de validação usado o resto desta sessão. Rollback, se algum arquétipo
regredir: remover/zerar a env var e re-deployar — sem reverter nenhum
código.

## Fora de escopo

- Qualquer mudança em `evaluateDefensiveQuality.ts`, `TeamDefensiveProfile.ts`,
  `CombinationSearchEngine.ts`, ou no fluxo geral de Team Builder (fora do
  Build-Around-Lead) — inalterado, como no experimento anterior.
- Ligar o corte rígido (`pruned`/`valid`) de `PartialTeamDefensiveEvaluator` —
  continua fora de escopo, só a penalidade suave é usada.
- Ajuste dinâmico de W por formato/estratégia — um único valor global via env
  var é suficiente por ora; segmentar por formato fica para um ciclo futuro
  se a necessidade aparecer.

## Verificação

1. `npx tsc --noEmit` após cada mudança de código.
2. Script de experimento re-rodado com os 4 valores de W no Cenário C +
   re-confirmação dos Cenários A/B com o W escolhido — revisado com o
   usuário antes de fixar o valor de produção.
3. Teste E2E local dos 5 arquétipos, todos aceitando ≥1 estratégia com o W
   calibrado — obrigatório passar antes do deploy.
4. Deploy real com a env var **não setada** primeiro (comportamento
   inalterado, verificável via curl mostrando os mesmos resultados de
   sempre).
5. Só depois: env var setada + novo deploy + confirmação real dos 5
   arquétipos via curl em produção, com aprovação do usuário em cada etapa
   de deploy (mesmo padrão desta sessão inteira).
