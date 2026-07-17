# Primeira publicação real em produção (Atlas) — 2026-07-16

**Status:** A primeira escrita real de sempre em `pokemonsets_v2`/`publication_manifests`, contra o cluster Atlas de produção real (banco `test`, confirmado pelo responsável do projeto). Marco mais significativo desta sessão: a Fase 1 (Production Publication) deixa de ser "só validada localmente" e passa a ter uma execução real completa, incluindo um bug de produção real corrigido no processo.

## 1. Sequência executada

1. **Preflight de índices** (só leitura) — falhou como esperado: `pokemonsets_v2`/`publication_manifests` ainda não existiam (`ns does not exist`).
2. **Criação dos índices reais** (`scripts-local/atlas-create-production-indexes.js`) — criou os 3 índices exigidos (`{setId:1, publishRunId:1}` único, `{setId:1}` único parcial quando `active:true`, `{publishRunId:1}` único). Isso é o momento em que as duas coleções passaram a existir de verdade em produção, ainda vazias.
3. **Preflight de novo** — passou.
4. **Regeneração do shadow comparison + acceptance gate** — o artifact existente (`artifacts/active-v2-acceptance-gates-v1.json`) estava desatualizado, referenciando o `activeRunId` antigo (`2026-07-14`, antes da reimportação desta sessão). Regenerado contra o `activeRunId` atual (`active-staging-2026-07-16T23-41-34-037Z`): `gateStatus: approved`, 4/4 cenários `equivalent`.
5. **Dry-run da publicação** — passou (`Records to write: 4`), zero escrita.
6. **Publicação real** — ver seção 2 (bug encontrado e corrigido no meio do processo).
7. **Confirmação pós-publicação** (leitura) — 4 documentos em `pokemonsets_v2` (todos `active=true`, `publishRunId=prod-run-2026-07-16-001`), 1 manifesto `active` com `recordCount=4` e o digest correto, `pokemonsets` (legada) intocada (0 documentos).
8. **Homologação real da Fase 2** (`homologateActiveV2RuntimeRead`, com `EQUINOX_ACTIVE_V2_RUNTIME_READ_ENABLED=true`) — `approved: true`, 4 registros lidos, 0 problemas. Primeira leitura real de ponta a ponta do caminho de produção V2.
9. **Idempotência** — republicar com o mesmo `publish-run-id` (`prod-run-2026-07-16-001`) retornou `NO-OP`/`RUN_ID_ALREADY_PUBLISHED_SAME_CONTENT`, zero escrita, estado confirmado idêntico por leitura.
10. **Rollback real** — `rollbackActiveV2Production.ts --run-id prod-run-2026-07-16-001` (dry-run antes, depois real): os 4 sets ficaram `active=false`, manifesto passou a `status=rolled-back`. Funcionou de primeira, já com o retry automático da correção da seção 2.
11. **Republicação final** — novo `publish-run-id` (`prod-run-2026-07-16-002`), mesmo acceptance report (staging inalterada). Resultado: 8 documentos totais em `pokemonsets_v2` (4 antigos de `prod-run-001`, `active=false`; 4 novos de `prod-run-002`, `active=true`) — o design de publicação imutável (nunca deleta, só desativa) funcionando exatamente como projetado. `previousActivePublishRunId=null` no novo manifesto, correto, já que não havia manifesto `active` no momento da republicação (o anterior estava `rolled-back`). Homologação da Fase 2 rodada de novo, confirmando que a leitura pega o manifesto novo corretamente (4 registros, 0 problemas).

Com isso, o checklist completo da Fase 1 real (runbook, seção 11: restore drill, preflight, dry-run, publicação, idempotência, rollback, republicação) está fechado contra o Atlas de produção real.

## 2. Bug real encontrado e corrigido: transações sem retry em `TransientTransactionError`

A publicação real falhou 4 vezes consecutivas com:
```
Error determining if update will go over space quota: Error computing current atlas size:
internal atlas error checking things: Failure getting dbStats: (MaxTimeMSExpired)
operation exceeded time limit: context deadline exceeded
```

### Diagnóstico
- Uso real de disco confirmado no painel do Atlas: **1.13–1.21MB de um limite de 512MB** (0,2% de uso) — não é um problema real de espaço.
- Uma escrita simples (sem transação) funcionou perfeitamente (31ms) — descartou a hipótese de "todas as escritas estão quebradas".
- Uma transação mínima (1 operação) funcionou sem erro — descartou "transações nunca funcionam neste cluster".
- A transação real de publicação (7-8 operações sequenciais: `find`, `insertMany`, `save`, 2x `updateMany`, 2x `save`) falhou consistentemente com a mesma mensagem.
- **Causa raiz identificada:** `publishToProduction`/`rollbackProductionBatch` nunca tratavam `TransientTransactionError` — o rótulo oficial do MongoDB para erros que o *chamador* deve retentar automaticamente, não que um humano reexecute o comando manualmente. Essa era literalmente a primeira transação MongoDB já tentada contra este cluster nesta sessão (toda escrita real anterior — staging, verified, active, criação de índices — usou operações simples, não transacionais).
- **Complicador adicional:** o erro observado não carrega o rótulo padrão `TransientTransactionError` do MongoDB — é um erro injetado pela camada de proxy do Atlas específica de tiers compartilhados/gratuitos (M0/Flex), que roda uma checagem de quota de armazenamento antes de aceitar uma transação. Precisou de reconhecimento por padrão de mensagem (`isKnownAtlasTransientQuotaCheckError`), não só pelo rótulo padrão.

### Correção
- `ActiveV2ProductionTransactionRetry.ts` (novo): helper compartilhado `runInTransactionWithRetry` — sessão nova a cada tentativa, até 5 tentativas com backoff curto, só quando o erro é `TransientTransactionError` OU o padrão específico do Atlas.
- `ActiveV2ProductionPublisher.ts`/`ActiveV2ProductionRollback.ts`: refatorados para usar o helper em vez de duplicar lógica de sessão/commit/abort.
- Nenhuma escrita parcial ocorreu em nenhuma das 4 falhas — cada tentativa fez rollback limpo (confirmado por leitura entre cada tentativa).
- Depois da correção, a publicação real funcionou na primeira tentativa (2ª rodada, já com o padrão específico do Atlas reconhecido).

## 3. O que isso prova

- O pipeline completo de publicação real (preflight → dry-run → publicação transacional → validação pós-publicação) funciona de ponta a ponta contra o Atlas de produção real.
- O congelamento de dados (`ActiveV2DataFreezeGuard`) e a validação de linhagem (`ActiveV2ProductionLineageValidator`) foram exercitados de verdade nesta execução (nenhum dos dois bloqueou, como esperado — canário estava em modo `off`).
- A leitura real de produção (Fase 2) funciona contra os dados recém-publicados.

## 4. O que isso não prova

- Nada sobre o comportamento do circuit breaker/canário/observabilidade *usando dados reais desta publicação* (essas fases foram validadas contra Mongo local nesta sessão, não contra este publishRunId real).
- Nada sobre o comportamento sob carga real (Fase 4A) ou com múltiplas publicações concorrentes.
- Se o erro de quota transitório do Atlas M0/Flex vai se repetir com mais frequência conforme o volume de dados cresce — o retry mitiga isso, mas não elimina a causa raiz (que é da infraestrutura do Atlas, fora do nosso controle).
