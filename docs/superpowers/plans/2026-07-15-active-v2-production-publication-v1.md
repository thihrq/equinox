# Active V2 Production Publication V1 Implementation Plan

Este documento define o roteiro de tarefas e estratégia de testes TDD para a fase de publicação em produção V1, com base na Opção C, digests canônicos de staging, e rollback transacional seguro de runs ativas (sem exclusão física).

---

## 🛠️ Mudanças Propostas

### 0. Módulo Compartilhado de Digest Canônico
*   **`src/services/competitive-data/digest/ActiveV2CanonicalDataDigest.ts`**
    *   Implementar `calculateCanonicalActiveV2DataDigest(records)` normalizando dados, ordenando alfabeticamente propriedades e arrays (`moves`, `roles`, `tags`), e excluindo os campos transitórios: `_id`, `__v`, `createdAt`, `updatedAt`, `publishedAt`, `publishRunId`, `previousPublishRunId`, `active`, `productionActivatedAt`, `productionDeactivatedAt`.

### 1. Ampliação do Shadow Comparison e Acceptance Gate V1
*   **`src/equinox/competitive/active-v2-shadow/ActiveV2ShadowTypes.ts`**
    *   Adicionar `activeV2DataDigest`, `activeV2RecordCount` e `activeV2DataDigestAlgorithm` no `ActiveV2ShadowAggregate`.
*   **`src/equinox/competitive/active-v2-shadow/ActiveV2ShadowRunner.ts`**
    *   Carregar documentos completos do staging (`pokemonsets_v2_staging` filtrados por `activeRunId`, `status: 'active'`, `active: true`). Calcular o digest canônico importando `ActiveV2CanonicalDataDigest.ts` e salvar no `aggregate`.
*   **`src/services/competitive-data/acceptance/ActiveV2AcceptanceTypes.ts`**
    *   Adicionar `activeV2DataDigest`, `activeV2RecordCount` e `activeV2DataDigestAlgorithm` no `ActiveV2AcceptanceReport`.
*   **`src/scripts/checkActiveV2Acceptance.ts`**
    *   Apenas validar e propagar estes novos campos de digest do shadow para o Acceptance Report de saída.

### 2. Modelos Mongoose
*   **`src/models/PokemonSetV2.ts`**
    *   Modelo `PokemonSetV2` mapeado para `pokemonsets_v2` com índices compostos únicos `{ setId: 1, publishRunId: 1 }` e parciais de ativação `{ setId: 1 }` com `{ active: true }`.
*   **`src/models/PublicationManifest.ts`**
    *   Modelo `PublicationManifest` contendo `setTransitions`.

### 3. Preflight e Serviços Transacionais
*   **`src/services/competitive-data/publication/ActiveV2ProductionPreflight.ts`**
    *   Apenas verificar índices (`{ setId: 1, publishRunId: 1 }` unique, índice parcial `{ setId: 1 }` unique e index `publishRunId` unique de manifestos) e duplicidades ativas fora da transação. Em falhas, lança `INDEX_PREFLIGHT_FAILED`.
*   **`src/services/competitive-data/publication/ActiveV2ProductionPublisher.ts`**
    *   Publicação sob transação única, com 3 fluxos de idempotência.
*   **`src/services/competitive-data/publication/ActiveV2ProductionRollback.ts`**
    *   Rollback transacional sob transação de runs ativas revertendo com base em `setTransitions` (sem exclusão física, marcando apenas `active = false` e `productionDeactivatedAt = rollbackAt`).

### 4. Scripts CLI e package.json
*   **`src/scripts/publishActiveV2Production.ts`**
    *   CLI principal com allowlist para coleções e validação de flags obrigatórias.
*   **`src/scripts/rollbackActiveV2Production.ts`**
    *   CLI de rollback.

---

## 🧪 Estratégia de Testes TDD Offline (25 Testes Obrigatórios)

A suíte offline em `validateActiveV2ProductionOffline.ts` validará as 25 asserções estritas:
1.  Mesmo `publishRunId` + mesmo digest ➔ no-op (manifesto preservado).
2.  Mesmo `publishRunId` + digest diferente ➔ blocker `RUN_ID_CONTENT_CONFLICT`.
3.  Novo `publishRunId` + mesmo digest ativo ➔ no-op (sem criar nova versão).
4.  Dois registros ativos para o mesmo `setId` ➔ transação abortada pelo índice parcial.
5.  O digest de conteúdo não é afetado pela ordem dos documentos ou propriedades transitórias.
6.  Mudança competitiva real altera o digest.
7.  Acceptance report sem `activeV2DataDigest` ➔ rejeição.
8.  `activeRunId` divergente no publisher ➔ rejeição.
9.  `recordCount` divergente no publisher ➔ rejeição.
10. Rollback de run não ativo ➔ aborta com `ROLLBACK_TARGET_NOT_ACTIVE`.
11. Rollback restaura o `previousActivePublishRunId` via `setTransitions`.
12. Falha durante ativação ➔ rollback transacional completo (abortTransaction).
13. Simulação `--dry-run` não cria manifestos nem versões.
14. Isolamento estrito: nenhuma operação de escrita/exclusão referencia a coleção legada `pokemonsets`.
15. Set novo sem versão anterior no rollback desativa a versão nova, sem versão ativa restante, e não apaga documento histórico.
16. Lote parcial com versões anteriores de runs diferentes é reativado corretamente.
17. Falha durante a transação ➔ nenhum manifesto active ou prepared persiste.
18. Digest algorithm incompatível ➔ rejeição.
19. Índice parcial ausente ou divergente ➔ preflight falha com `INDEX_PREFLIGHT_FAILED`.
20. Shadow report propaga digest dos documentos completos do staging.
21. Acceptance Gate não recalcula nem altera o digest.
22. Manifesto não persiste como active/prepared após abort da transação.
23. Dry-run pode ler staging e produção, mas registra zero comandos de escrita.
24. Rollback nunca executa delete físico no banco de dados.
25. Mesmo conteúdo com ordem diferente de moves/roles/tags gera o mesmo digest.
