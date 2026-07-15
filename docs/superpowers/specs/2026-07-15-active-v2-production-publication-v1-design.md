# Active V2 Production Publication V1 Design

## Status

Especificação formal aprovada. Este documento define a arquitetura e as regras de governança para publicação imutável e ativação por versão (Opção C), cálculo de digests canônicos de documentos brutos, controle de linhagem de dados e rollback transacional seguro de runs ativas.

---

## 1. Objective

Esta fase estabelece a publicação de dados competitivos aprovados na coleção de produção:

$$\text{Coleção Destino: } \mathtt{pokemonsets\_v2}$$

Para mitigar o risco de divergência de dados, o motor adota a **Opção C (Publicação Imutável e Ativação por Versão)** associada a um Manifesto persistido transacionalmente na coleção `publication_manifests` como ledger de auditoria imutável. A coleção legada `pokemonsets` permanece intocada.

---

## 2. Linhagem Estrita de Identificadores e 4 Digests

### 2.1. Controle de Identificadores de Execução
*   `activeRunId`: Identificador original da execução no Shadow Comparison.
*   `inputActiveRunId`: Cópia preservada e validada no Acceptance Report.
*   `sourceActiveRunId`: Cópia registrada no Manifesto de Publicação de produção.
*   `publishRunId`: Novo identificador único e imutável da operação de publicação em produção.

A validação de linhagem do publicador exige:

$$\mathtt{sourceActiveRunId} === \mathtt{acceptanceReport.inputActiveRunId}$$

### 2.2. Linhagem de 4 Digests Independentes
O Ledger operacional imutável na coleção `publication_manifests` persistirá de forma independente:
1.  `acceptanceReportDigest`: Hash SHA-256 do veredito `active-v2-acceptance-gates-v1.json`.
2.  `shadowEvidenceDigest`: O `inputEvidenceDigest` registrado no relatório de aceitação.
3.  `activeV2DataDigest`: Hash canônico dos registros V2 homologados.
4.  `baselineSourceDigest`: Hash da fonte baseline controlada.

---

## 3. Origem e Propagação de Digests

### 3.1. Geração no Shadow Comparison
O Shadow Comparison lê os documentos completos do staging correspondentes a:

$$\{\mathtt{activeRunId}: \mathtt{sourceActiveRunId}, \mathtt{status}: \text{'active'}, \mathtt{active}: \mathtt{true}\}$$

a partir de `pokemonsets_v2_staging` (sem fallbacks ou leituras de coleções legadas). E, antes de qualquer normalização, calcula o digest canônico dos documentos brutos e salva no `aggregate` da evidência JSON:
*   `activeV2DataDigest`: String (digest canônico).
*   `activeV2RecordCount`: Número (contagem de registros).
*   `activeV2DataDigestAlgorithm`: `'active-v2-canonical-sha256-v1'`.
*   `activeRunId`: String.

### 3.2. Preservação no Acceptance Gate
O Acceptance Gate valida e **propaga inalterados** os campos do shadow report no veredito JSON de saída `active-v2-acceptance-gates-v1.json`:
*   `activeV2DataDigest`
*   `activeV2RecordCount`
*   `activeV2DataDigestAlgorithm`
*   `inputActiveRunId`

### 3.3. Prova Matemática no Publisher
O Production Publisher lê os registros reais de `pokemonsets_v2_staging`, recalcula de forma independente o digest canônico dos documentos brutos lidos e exige igualdade exata contra os campos assinados no relatório de aceitação.

---

## 4. Algoritmo de Normalização e Digest Canônico

Para garantir equivalência semântica e determinismo de hash:
1.  **Exclusão de Campos Transitórios**: Remover os campos `_id`, `__v`, `createdAt`, `updatedAt`, `publishedAt`, `publishRunId`, `previousPublishRunId`, `active`, `productionActivatedAt`, `productionDeactivatedAt`.
2.  **Ordenação de Arrays de Conteúdo**: Ordenar alfabeticamente os elementos dos arrays `moves`, `roles` e `tags` de cada Pokémon.
3.  **Ordenação de Propriedades**: Ordenar recursivamente todas as chaves de propriedades de forma alfabética.
4.  **Ordenação de Documentos**: Ordenar o array de documentos por `setId` em ordem lexicográfica ascendente.
5.  **Hashing**: Serializar a estrutura resultante em string JSON UTF-8 pura e computar o hash SHA-256 no formato `sha256-<hash>`.

Este algoritmo neutro será exportado pelo módulo compartilhado `src/services/competitive-data/digest/ActiveV2CanonicalDataDigest.ts`.

---

## 5. Modelos e Índices no Banco de Dados

### 5.1. Coleção `pokemonsets_v2`
Cada documento representará uma versão imutável associada ao `publishRunId`.
*   Índice Composto de Versão: `{ setId: 1, publishRunId: 1 }` com `unique: true`.
*   Índice Parcial Único de Ativação (garante apenas uma versão ativa por set):
    ```typescript
    schema.index(
      { setId: 1 },
      {
        unique: true,
        partialFilterExpression: { active: true },
        name: 'uniq_active_version_per_set',
      }
    );
    ```

### 5.2. Coleção `publication_manifests`
*   `publishRunId`: String (único).
*   `previousActivePublishRunId`: String ou null.
*   `status`: `'prepared' | 'published' | 'active' | 'rolled-back' | 'failed'`.
*   `setTransitions`: Array de transições por documento:
    ```typescript
    interface PublicationSetTransition {
      setId: string;
      previousPublishRunId: string | null;
      newPublishRunId: string;
    }
    ```

---

## 6. Fluxo Transacional e Idempotência (3 Estados)

Toda ativação e criação do manifesto executam em uma **Transação Única do MongoDB**.
Se houver `abortTransaction`, nenhum manifesto prepared ou active persiste no banco.
O publicador tratará os 3 estados de idempotência:
1.  **Mesmo `publishRunId` + mesmo digest**: Retorna o manifesto existente (`no-op`).
2.  **Mesmo `publishRunId` + digest diferente**: Bloqueia com o erro `RUN_ID_CONTENT_CONFLICT`.
3.  **Novo `publishRunId` + mesmo digest ativo**: Retorna o status de no-op `ACTIVE_CONTENT_ALREADY_PUBLISHED` sem criar versões ou manifestos no banco.

---

## 7. Rollback Restaurativo Transacional de Runs Ativas

O rollback reverte a publicação de forma cirúrgica baseada em `setTransitions` do manifesto:
1.  **Validação**: Só autoriza se o `publishRunId` for o lote ativo atual e nenhum lote posterior dependa dele (se inativo, lança `ROLLBACK_TARGET_NOT_ACTIVE`).
2.  **Restauração**:
    *   Para cada set em `setTransitions`:
        *   Se `previousPublishRunId === null` (documento novo): A versão do novo lote é apenas desativada (`active = false`), registrando `productionDeactivatedAt = rollbackAt`. O documento histórico não é excluído e nenhuma versão ativa permanece para este set.
        *   Se `previousPublishRunId` válido: Reativa a versão anterior correspondente (`active = true`).
3.  **Manifesto**: Marca o status do manifesto do lote como `rolled-back`.
4.  **Auditabilidade**: Nenhuma limpeza ou exclusão física de registros inativos é feita no rollback para preservar a linhagem de auditoria.
