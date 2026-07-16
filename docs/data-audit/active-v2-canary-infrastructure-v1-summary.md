# Active V2 Canary Infrastructure V1 — Sumário da Fase 4

**Status:** Implementado e validado offline (17/17 testes agregados entre Fase 2A, Circuit Breaker e Canary Infrastructure). Nenhuma execução real contra Atlas — ver limitações na seção 4.

## 1. Escopo desta fase

Componentes exigidos pelo resumo do projeto (seção "Fase 4 — Canary Infrastructure: seletor determinístico; feature flags; seed estável; modos off/shadow/internal/percentage/full; fallback por requisição; force baseline; controle operacional dinâmico"):

| Componente | Arquivo |
|---|---|
| Modos e config de canário | `src/services/competitive-data/runtime-control/ActiveV2CanaryConfigTypes.ts` |
| Seletor determinístico (seed estável, cumulativo) | `src/services/competitive-data/runtime-control/ActiveV2CanarySelector.ts` |
| Store com imutabilidade de seed (adendo 4.1) | `src/services/competitive-data/runtime-control/ActiveV2CanaryConfigStore.ts` |
| Role de escrita dedicada | `src/services/competitive-data/runtime-control/ActiveV2CanaryConfigWriteGuard.ts` |
| Tiers de aprovação (tabela 4.2) | `src/services/competitive-data/runtime-control/ActiveV2CanaryTransitionPolicy.ts` |
| **Resolvedor de precedência** (o capstone citado no adendo 3.2) | `src/services/competitive-data/runtime-control/ActiveV2RuntimeDecisionResolver.ts` |

## 2. Regra de precedência implementada

`ActiveV2RuntimeDecisionResolver.ts` implementa exatamente a cadeia do adendo 3.2:

```
circuit breaker dinâmico → FORCE_BASELINE estático → modo operacional → seleção canária → fallback por requisição
```

Testada nos 11 casos de `validateActiveV2RuntimeDecisionResolver.ts`, incluindo a garantia de que o circuit breaker sempre vence mesmo com `mode=full`, e que `mode=shadow` sinaliza avaliação paralela (`shadowParallelEvaluation: true`) sem servir o Active V2 diretamente.

## 3. Governança de quatro olhos (adendo 4.2)

`ActiveV2CanaryTransitionPolicy.ts` classifica cada transição pelo **alvo**, não pela origem (pular etapas nunca reduz o rigor):

| Alvo | Tier | Aprovadores |
|---|---|---|
| off / shadow / internal | single-responsible | 1 |
| percentage ≤ 10% | registered-review | 1 |
| percentage > 10% | two-person | 2 (distintos) |
| full (100%) | executive | 2 técnicos + 1 executivo, todos distintos |

`setActiveV2CanaryMode.ts` recusa (`exit 2`) qualquer tentativa que não satisfaça o tier exigido — testado via smoke test real (tentativa de ir a 25% com um único aprovador foi corretamente rejeitada).

## 4. Limitações assumidas (não superestimar o que foi comprovado)

- **Nenhuma integração com requisições reais.** O resolver é uma função pura, pronta para ser chamada pelo caminho de requisição do runtime — mas não existe hoje nenhum runtime V2 recebendo tráfego público (mesma limitação já registrada na Fase 2A). A integração real fica para quando a Fase 3 (Runtime Shadow Mode) estiver rodando contra o Atlas de produção.
- **`isAuthorizedInternalCanaryRequest` é um insumo externo.** A validação HMAC do canário interno (nonce, timestamp, allowlist) é escopo da **Fase 5**, ainda não implementada. O resolver já está preparado para recebê-la, mas hoje qualquer chamador deve fornecer esse booleano calculado por outro lugar.
- **`windowStartedAt`/`windowEndedAt` só rastreiam o estado atual**, não um histórico completo de janelas. O histórico de transições fica reconstituível pelo changelog (`docs/data-audit/active-v2-runtime-flag-changelog.md`), que registra timestamp de cada mudança — não há uma coleção dedicada de histórico de janelas nesta entrega.
- **Nenhuma escrita real no Atlas.** Como nas fases anteriores, não há `MONGO_URI` configurado neste ambiente — todos os stores foram validados com conexões mockadas, seguindo o mesmo padrão do restante do pipeline (`verifyProductionIndexesAndDuplicities`, etc.). A primeira escrita real em `active-v2-canary-config` e `active-v2-runtime-control` só pode ocorrer após o restore drill da Fase 1.

## 5. Changelog compartilhado

`ActiveV2RuntimeControlChangelogEntry` foi generalizado (campos `valorAnterior`/`valorNovo` de `string` livre, antes restritos aos modos do circuit breaker) para que **um único arquivo** (`docs/data-audit/active-v2-runtime-flag-changelog.md`) registre tanto mudanças do breaker quanto do canário, conforme a tabela 4.2 do adendo trata os dois tipos de mudança na mesma seção de governança.

## 6. Suíte offline

`npm run sets:active-v2-canary:offline:check` — 5 validadores (seletor, política de transição, write guard, store, resolver). Combinado com as suítes anteriores: **17 testes offline** cobrindo Fase 2A + Circuit Breaker + Canary Infrastructure, todos passando nesta branch.
