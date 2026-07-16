# Active V2 Runtime Shadow Mode V1 — Sumário da Fase 3

**Status:** Implementado e ligado em código de produção real (`TeamController.suggest`), validado offline (29/29 testes agregados desta sessão). **Nunca exercitado com tráfego real** — o modo de canário padrão é `off`, então o código está presente mas inerte até alguém explicitamente rodar `sets:active-v2-canary:set-mode -- --mode shadow`.

## 1. Por que o escopo foi reduzido

O objetivo original da Fase 3 ("V2 executa em paralelo, diferenças são registradas") poderia ser lido como "reconstruir todo o algoritmo de recomendação contra dados V2". Isso foi conscientemente rejeitado nesta implementação, por dois motivos:

1. **Escala do trabalho.** O pipeline de `TeamService.suggestComplements` tem mais de 400 linhas e múltiplos estágios (Mongo candidates → seleção → score → diversidade → busca de combinação). Cloná-lo para uma segunda fonte de dados seria um projeto por si só, com risco proporcional.
2. **Cobertura de dados insuficiente para o resultado ser útil.** A base Active V2 hoje tem 14 sets curados contra um roster completo de centenas de Pokémon elegíveis. Re-executar a seleção de candidatos contra isso produziria quase só "sem dado" — pouco sinal, para um risco de código desproporcional.

Em vez disso, esta fase compara **dados de set** (item, ability, nature, moves) dos Pokémon que o baseline **já escolheu**, contra o set ativo correspondente em `pokemonsets_v2`. Isso testa exatamente o que toda a governança Active V2 construída até aqui sempre validou — fidelidade de dados de set — sem tocar no algoritmo de recomendação em si.

**Não comparado:** EVs/IVs. `/api/team/suggest` nunca os calcula (confirmado via investigação do código: `PokemonData`/`SuggestedPokemon` não têm esses campos) — comparar contra um valor inexistente seria inventar dado, não observar.

## 2. Ponto de integração

`src/controllers/TeamController.ts`, método `suggest` — depois de `res.json(result)`, fire-and-forget:
```ts
void runActiveV2RuntimeShadow(mongoose.connection, {...})
  .catch(error => console.warn('[Equinox] Active V2 runtime shadow failed (ignored):', error));
```
Mesmo padrão fire-and-forget já usado em `src/server.ts` para `DataSyncService.syncRemote()` — não é uma convenção nova.

**Garantia estrutural:** o `void` + `.catch()` roda depois que a resposta já foi enviada ao usuário. Uma falha no caminho shadow não pode, por construção, virar um erro 500 ou alterar o payload que o usuário recebeu.

## 3. Descoberta relevante durante a investigação

Existe um caminho pré-existente, **não relacionado a este trabalho**, chamado `applyV2ShadowSetSelection` em `src/services/LeadStrategyRecommendationService.ts` (endpoint `/api/team/suggest-from-lead`) que, apesar do nome, **aplica** dados V2 à resposta quando `EQUINOX_USE_COMPETITIVE_SETS_V2=true` e a comparação prefere V2 — não é shadow-safe. Confirmei que essa flag não está setada em `render.yaml` (produção), então esse caminho está inerte hoje. Não foi tocado nesta fase — é de outro endpoint e usa uma fonte de dados diferente (pacote JSON estático, não `pokemonsets_v2`). Fica registrado aqui para quem for reconciliar a nomenclatura depois.

## 4. Ajuste feito antes de consolidar: interruptor estático + ordem de leituras

Na primeira versão, o orquestrador lia estado do circuit breaker + config de canário (2 leituras de Mongo) em **toda** requisição do formato coberto, mesmo com o canário desligado (o padrão). Isso é custo real sem benefício até alguém ligar a feature de propósito, e não havia nenhum jeito de desligar esse caminho sem depender do próprio Mongo.

Corrigido antes do commit: `EQUINOX_ACTIVE_V2_RUNTIME_SHADOW_ENABLED` — flag estática de deploy, checada antes de qualquer acesso ao banco. Além disso, a ordem das leituras foi invertida: a config de canário é lida primeiro (1 leitura), e o estado do breaker só é lido depois, se o canário já estiver em `shadow` (2ª leitura). No caso comum (feature desligada, ou canário desligado), o custo caiu para zero ou uma leitura por requisição, não duas sempre.

## 5. Reaproveitamento

- **Gate:** `resolveActiveV2RuntimeDecision` (Fase 4) — o branch `mode === 'shadow'` existe desde a Fase 4 exatamente para isto; esta fase é a primeira a de fato chamá-lo de um caminho de requisição real.
- **Cadeia de precedência:** circuit breaker (Fase 4B) e `FORCE_BASELINE` estático continuam valendo — se qualquer um estiver ativo, a avaliação shadow nem começa, mesmo com o canário em `shadow`.
- **Sink de telemetria:** `ActiveV2RuntimeTelemetryEvent` (Fase 2A) — o modelo já existia desde a Fase 2A, mas nada escrevia nele até agora. Esta fase é o primeiro *writer* real.
- **Tipo estendido:** `ActiveV2RuntimeFallbackReason` ganhou o valor `'no-v2-data'` (Fase 2A), para o caso "nenhum set V2 encontrado para esta espécie" — distinto de erro/timeout/circuit-breaker.

## 6. Suíte offline

`npm run sets:active-v2-runtime-shadow:offline:check` — 2 validadores (comparador de sets, orquestrador com conexão Mongo mockada, cobrindo formato não coberto / flag estática desligada / canário desligado / match / divergência / dado ausente / circuit breaker em force-baseline). Combinado com as suítes anteriores: **29 testes offline**, `npm run preflight` com exit 0 depois de tocar `TeamController.ts`.

## 7. Verificação de não-regressão no código de produção

Como esta é a primeira fase que edita um arquivo que já serve tráfego real, a barra de verificação foi mais alta que nas fases anteriores:
- `npx tsc --noEmit`: limpo.
- `npm run preflight`: exit 0.
- Boot real do servidor (`ts-node src/server.ts`) sem MongoDB local disponível: sobe sem erro de import/inicialização, falha no ponto exato onde já falharia sem esta mudança (guarda de conexão Mongo em modo filesystem) — confirma que a integração não introduziu nenhum novo modo de falha no boot.

**Limitação assumida:** não foi possível testar contra tráfego real (mesma limitação de toda a sessão — sem Atlas configurado neste ambiente). O primeiro teste real só pode acontecer depois que alguém ligar `EQUINOX_DATA_MODE=mongo` com um `MONGO_URI` válido e explicitamente colocar o canário em modo `shadow`.
