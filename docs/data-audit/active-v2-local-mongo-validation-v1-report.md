# Validação real contra MongoDB local — 2026-07-16

**Status:** Executado de verdade (não mockado) contra um MongoDB local real (`mongodb-memory-server`, replica set de 1 nó). **Não é o Atlas de produção** — sem latência de rede real, sem os limites de recursos do plano do Atlas, sem `mongodump`/`mongorestore` físicos (não disponíveis neste ambiente; o restore drill usa um equivalente em nível de aplicação — ver `scripts-local/README.md`). Ainda assim, é a primeira vez neste projeto que o pipeline Active V2 roda contra um MongoDB real de ponta a ponta, e revelou bugs reais que nenhum teste offline (conexão mockada) jamais teria encontrado.

## 1. O que foi executado de verdade

| Etapa | Resultado |
|---|---|
| Pipeline de staging (import → publish staging → verified → active staging) | ✅ Real. 14 registros publicados em staging, 4 promovidos a verified, 4 ativados via transação atômica |
| Restore drill (adendo 3.7) | ✅ Real (equivalente em nível de aplicação). 14/14 registros restaurados, digest idêntico, índices batendo |
| Fase 1 completa: preflight de índices, dry-run, publish, validação pós-publicação, idempotência, rollback, republicação | ✅ Real. Resultado final: `pokemonsets_v2` com 4 versões ativas, `publication_manifests` com uma run de teste `rolled-back` e a final `active`, `pokemonsets` legada inalterada (0 docs) — exatamente o resultado esperado descrito no plano original |
| Fase 2 (Runtime Read Homologation) | ✅ Real, contra os dados recém-publicados. `approved: true`, 0 problemas, após as correções abaixo |
| Fase 2A (Observability, manifest health) | ✅ Real. 0 alertas contra o estado real e saudável |
| Fase 4B (Circuit Breaker) | ✅ Real. `force-baseline` e reativação com 2 aprovadores, ambos com escrita real e changelog real |
| Fase 4 (Canary Config) | ✅ Real. Transição real para modo `shadow` com nova campanha/seed |
| Fase 5 (Canário Interno / HMAC) | ✅ Real. Assinatura válida autorizada; replay do mesmo nonce corretamente rejeitado pelo nonce store real do Mongo (`NONCE_ALREADY_USED`) |
| Fase 3 (Runtime Shadow Mode) | ✅ Real (parcial). Servidor conectou de verdade ao Mongo e subiu. O orquestrador da Fase 3 foi chamado diretamente contra o Mongo real (não via HTTP completo — ver limitação abaixo) e escreveu um evento de telemetria real e correto |
| Fase 4A (Capacidade) | ❌ Não coberto — exige latência de rede e limites de recursos reais do Atlas |

## 2. Bugs reais encontrados e corrigidos

Nenhum destes seria detectável por testes offline com conexão Mongo mockada — todos exigiram schema real do Mongoose, transações reais, ou comparação real de documentos.

### 2.1 `PokemonSetV2 validation failed: role: Path 'role' is required`
`ActiveV2ProductionPublisher.ts` clonava os registros de staging diretamente para inserção em `pokemonsets_v2`, mas o schema Mongoose exige um campo `role` (singular, legado) que os dados reais nunca populam — o pipeline de curação usa `primaryRole`/`secondaryRoles`. **Corrigido:** o publisher agora deriva `role` de `primaryRole` no momento da inserção.

### 2.2 Divergência de digest (`digestMatchesManifest: false`) — três causas
Corrigir o bug 2.1 revelou um segundo problema: o digest calculado a partir dos registros de staging (antes de inserir) não batia com o digest recalculado a partir dos documentos já publicados. Comparando os dois documentos campo a campo (não apenas por amostragem), encontrei três causas:

1. **`role` recém-adicionado** não fazia parte do digest original de staging — precisava ser excluído do cálculo do digest, não apenas satisfazer o schema.
2. **Mongoose descarta silenciosamente campos não declarados no schema** (`strict` mode) — toda a metadata de governança de staging (`humanReview`, `verifiedAt`, `verifiedRunId`, `activatedAt`, `activatedFromStatus`, `activationMetadata`, `activeRunId`, `previousVerifiedRunId`) desaparece na publicação, e o schema preenche defaults para campos ausentes (`legal`, `validationErrors`, `validationWarnings`, `importedAt`, `sourceActiveRunId`) que nunca existiram no dado curado original.
3. **`sourceUpdatedAt` serializa diferente**: string solta (`"2026-07-12"`) na leitura bruta de staging vs. `Date` real do Mongoose (`"2026-07-12T00:00:00.000Z"`) na leitura de um documento já publicado.

**Corrigido:** `ActiveV2CanonicalDataDigest.ts` — lista de exclusão expandida (9 campos novos, com comentário explicando a categoria de cada um) e uma regra de normalização de data para `sourceUpdatedAt`. Documentado em detalhe no próprio arquivo, já que a lista de exclusão se mostrou frágil (mesmo depois de duas rodadas de correção, ainda faltavam campos) — vale considerar uma revisão arquitetural futura para uma lista de inclusão explícita de "conteúdo curado" em vez de uma lista de exclusão de "o que não é conteúdo", que é inerentemente mais frágil a cada novo campo de schema.

### 2.3 `blockedRecordsStillReviewed must be 5` (hardcoded)
Ao tentar ativar os 4 sets verified para active staging, `VerifiedToActiveStagingPolicy.ts` (e o script paralelo `validateVerifiedStagingPromotion.ts`) tinham a contagem de "registros bloqueados que devem permanecer reviewed" hardcoded em `5` — um resquício de quando o pacote piloto tinha 9 registros (4 elegíveis + 5 bloqueados). Depois da expansão de dados desta sessão (14 registros: 4 elegíveis + 10 bloqueados), essa asserção sempre falharia. **Corrigido:** a checagem agora compara `blockedRecordsStillReviewed` contra `recordsBlocked`/`blockedSetIds.length` (dinâmico), não um número fixo — a invariante real é "todo registro bloqueado permanece intocado", não um total específico.

## 3. Por que os testes offline não pegaram nada disso

Todos os validadores offline desta sessão (e da sessão anterior) usam conexões Mongo **mockadas** — objetos JavaScript simples que simulam `find`/`findOne`/`insertOne` retornando exatamente o que o teste pede. Isso prova que a *lógica* está correta dado um input controlado, mas nunca exercita:
- Validação de schema real do Mongoose (campos obrigatórios, defaults, `strict` mode descartando campos não declarados).
- Serialização real de tipos (Date vs string).
- Transações reais (`session.startTransaction()`/`commitTransaction()`).
- Índices reais (existência, unicidade, filtros parciais).

Isso não é uma falha dos testes offline — eles continuam validando exatamente o que se propõem a validar (a lógica de decisão). Mas confirma, de forma concreta, o que o adendo original já apontava: "implementado não é o mesmo que testado", e "testado offline" não é o mesmo que "testado contra um banco real".

## 4. Verificação pós-correção

`npm run preflight`: exit 0. Suíte offline completa (34 validadores agregados entre todas as fases desta sessão): todos passando, sem regressão. Fase 1 offline (25 testes): sem regressão. Ciclo completo real (publish → idempotência → rollback → republicação) reexecutado do zero após as correções do digest, com `Fase 2 approved: true` no final.

## 5. O que isso não prova

- Nada sobre desempenho/capacidade sob carga real (Fase 4A).
- Nada sobre o comportamento do Atlas real (failover, latência de rede, limites do plano).
- A Fase 3 não foi testada via um request HTTP completo (`POST /api/team/suggest` de ponta a ponta) porque isso exigiria semear todo o dataset legado de Pokémon (`pokemons`/`pokemonsets`) neste Mongo local — fora do escopo desta validação. O orquestrador da Fase 3 foi chamado diretamente contra o Mongo real com input realista, o que prova o caminho de escrita/leitura real, mas não o roteamento HTTP completo.
- O restore drill usou um mecanismo em nível de aplicação (driver), não os binários `mongodump`/`mongorestore` reais — a validação lógica é a mesma, mas não prova compatibilidade com o backup/restore nativo do Atlas.
