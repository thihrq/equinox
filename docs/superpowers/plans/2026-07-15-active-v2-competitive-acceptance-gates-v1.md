# Active V2 Competitive Acceptance Gates V1 Implementation Plan

Este documento define o plano de tarefas, arquivos a serem criados/modificados e a estratégia de testes para implementar os portões de aceitação competitiva.

---

## 🛠️ Mudanças Propostas

### 0. Confirmação do Caminho de Importação de Tipos
*   Antes de usar o tipo `ActiveV2ShadowReport`, confirmar a existência de `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowTypes.ts` usando `Test-Path`. Se existir, importar dali diretamente.

### 1. Camada de Domínio, Política e Tipos
#### [NEW] `src/services/competitive-data/acceptance/ActiveV2AcceptanceTypes.ts`
*   Definir os tipos de classificação competitiva e estruturas de dados de auditoria:
    *   `CompetitiveClassification`
    *   `AcceptanceReasonCode`
    *   `ComparatorClassification`
    *   `AcceptanceScenarioVerdict`
    *   `ActiveV2AcceptanceReport`
    *   `AcceptanceGateStatus`
*   Reutilizar as definições de tipo estruturadas importando `ActiveV2ShadowReport` diretamente de `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowTypes.ts`.

#### [NEW] `src/services/competitive-data/acceptance/ActiveV2AcceptancePolicy.ts`
*   Expor a política `ACTIVE_V2_ACCEPTANCE_POLICY_V1` com thresholds de score:
    ```typescript
    export const ACTIVE_V2_ACCEPTANCE_POLICY_V1 = {
      version: 'active-v2-acceptance-v1',
      scoreRegressionExclusiveUpperBound: -10,
      scoreReviewExclusiveUpperBound: -5,
      scoreAcceptableUpperBound: 5,
    } as const;
    ```
*   Expor a hierarquia de qualidade de sets `SET_QUALITY_RANK` e a lista de comparadores críticos `CRITICAL_COMPARATORS`.

---

### 2. Validador, Classificador e Motor de Gates
#### [NEW] `src/services/competitive-data/acceptance/ActiveV2AcceptanceEvidenceValidator.ts`
*   Componente funcional puro para validar a estrutura, metadados e invariantes físicas (zero reads de produção, zero writes, pronta para gates, etc.) antes da classificação.
*   Validar o digest do baselineSource usando expressão regular `/^sha256-[a-f0-9]{64}$/`.
*   Se a validação falhar, abortar a classificação e retornar veredito global `'rejected'` com classificação `'blocker'` e reasonCode `'SHADOW_EVIDENCE_INVALID'`.

#### [NEW] `src/services/competitive-data/acceptance/ActiveV2AcceptanceClassifier.ts`
*   Motor funcional puro para classificar cada comparador com base na política e nos reason codes.
*   Implementar a função pura `resolveSetQuality` a partir dos campos reais do set (`status`, `sourceType`, `sourceKind`, `fallbackUsed`).
*   Mapear o comparador `errorDiff` baseado no contrato real:
    ```typescript
    const hasExecutionError =
      comparison.errorDiff.status === 'different' ||
      baselineResult.errors.length > 0 ||
      activeV2Result.errors.length > 0;
    ```
*   Cálculo exato de deltas de pontuação (absoluto e percentual) e árvore de decisão determinística por comparador.

#### [NEW] `src/services/competitive-data/acceptance/ActiveV2AcceptanceGates.ts`
*   Motor funcional puro para consolidar os vereditos dos cenários e gerar a decisão agregada do gate (`approved`, `rejected` ou `human-review-required`).

#### [NEW] `src/services/competitive-data/acceptance/ActiveV2AcceptanceReportFormatter.ts`
*   Formatador funcional puro. Gera strings de relatórios Markdown e JSON puros, sem usar `fs`.

---

### 3. CLI, Integração de Scripts e E/S
#### [NEW] `src/scripts/support/writeActiveV2AcceptanceArtifacts.ts`
*   Módulo de suporte de persistência de arquivos. Cria diretórios de saída e escreve em arquivos temporários (ex: `report.json.tmp`, `report.md.tmp`) antes de renomear para os destinos finais, garantindo escrita atômica e limpando temporários em caso de falha.

#### [NEW] `src/scripts/checkActiveV2Acceptance.ts`
*   Script principal de execução do portão aceitando argumentos `--input`, `--output-json`, `--output-markdown`.
*   Tratar falhas físicas de leitura de arquivos e parse JSON inválido (Exit Code 3).
*   Calcular o digest do input em buffer usando `createHash('sha256').update(inputBuffer).digest('hex')` e salvá-lo no JSON gerado como `inputEvidenceDigest` no formato `sha256-<hash>`.
*   Executar fluxo de validação da evidência, classificação, agregação de gates e escrita dos relatórios.
*   Exit Codes determinísticos: `0` (Approved), `1` (Rejected por regressão, blocker ou falha global de evidência), `4` (Human Review Required), `2` (Configuração CLI inválida).

#### [MODIFY] `package.json`
*   Adicionar atalhos para os testes e auditoria offline agregada:
    ```json
    {
      "sets:active-v2-acceptance:check": "ts-node src/scripts/checkActiveV2Acceptance.ts",
      "sets:active-v2-acceptance:contracts:check": "ts-node src/scripts/validateActiveV2AcceptanceContracts.ts",
      "sets:active-v2-acceptance:evidence:check": "ts-node src/scripts/validateActiveV2AcceptanceEvidenceValidator.ts",
      "sets:active-v2-acceptance:classifier:check": "ts-node src/scripts/validateActiveV2AcceptanceClassifier.ts",
      "sets:active-v2-acceptance:gates:check": "ts-node src/scripts/validateActiveV2AcceptanceGates.ts",
      "sets:active-v2-acceptance:report:check": "ts-node src/scripts/validateActiveV2AcceptanceReportWriter.ts",
      "sets:active-v2-acceptance:cli-exit-codes:check": "ts-node src/scripts/validateActiveV2AcceptanceCliExitCodes.ts",
      "sets:active-v2-acceptance:offline:check": "ts-node src/scripts/validateActiveV2AcceptanceOffline.ts"
    }
    ```

---

## 🧪 Estratégia de Testes

### 1. Testes de Tipos e Contratos
*   **[NEW] `src/scripts/validateActiveV2AcceptanceContracts.ts`**
    *   Verificar contratos e integridade dos esquemas de dados.

### 2. Testes de Integridade de Evidência
*   **[NEW] `src/scripts/validateActiveV2AcceptanceEvidenceValidator.ts`**
    *   Testar que relatórios incompletos, com flags de fallback ativadas ou leituras de produção maiores que zero geram bloqueante imediato (`blocker` com reasonCode `SHADOW_EVIDENCE_INVALID`).

### 3. Testes da Árvore de Decisão
*   **[NEW] `src/scripts/validateActiveV2AcceptanceClassifier.ts`**
    *   Mocks com deltas de score e classificação correspondente.
    *   Queda de qualidade de set -> `regression`.
    *   Teste de precedência múltipla: Score $+12$ + estratégia diferente + fallback V2 introduzido -> veredito esperado `blocker` (provando que blocker > human-review-needed > improvement).
    *   Teste de precedência intermediária: Score $+8$ + estratégia central diferente -> veredito esperado `human-review-needed`.
    *   Moves diferentes + roles iguais + delta $+2$ -> `acceptable-divergence`.
    *   Todos críticos equal -> `equivalent`.

### 4. Testes dos Portões e Relatórios
*   **[NEW] `src/scripts/validateActiveV2AcceptanceGates.ts`**
    *   Casos agregados (revisão humana em um cenário forcando portão para `human-review-required`).
*   **[NEW] `src/scripts/validateActiveV2AcceptanceReportWriter.ts`**
    *   Assegurar escrita segura sem segredos, formatação e verificação de gravação de arquivos JSON/Markdown e tratamento de caminhos de diretório.

### 5. Testes de Exit Codes da CLI
*   **[NEW] `src/scripts/validateActiveV2AcceptanceCliExitCodes.ts`**
    *   Executar o binário CLI por subprocesso validando o retorno exato de exit codes `0`, `1`, `4`, `2` e `3`.

### 6. Execução da Validação Agregada Offline
*   **[NEW] `src/scripts/validateActiveV2AcceptanceOffline.ts`**
    *   Script que orquestra toda a suíte de validações locais offline.

---

## 📋 Lista Completa de Testes Mínimos Obrigatórios

O plano de testes cobrirá as seguintes asserções exatas:
1.  Evidência válida ➔ classificação executada com sucesso.
2.  JSON de entrada ausente ➔ CLI retorna Exit Code 3.
3.  JSON de entrada inválido/malformado ➔ CLI retorna Exit Code 3.
4.  Argumento `--input` ausente ➔ CLI retorna Exit Code 2.
5.  Schema/metadados da evidência inválidos ➔ veredito `blocker` e Exit Code 1.
6.  Safety counters de produção ou escrita diferente de zero ➔ veredito `blocker` e Exit Code 1.
7.  Score delta menor que -10 (ex: -12) ➔ veredito `regression` e Exit Code 1.
8.  Score delta entre -10 e -5 (ex: -7) ➔ veredito `human-review-needed` e Exit Code 4.
9.  Score delta maior que +5 (ex: +8) sem outras divergências ➔ veredito `improvement` e Exit Code 0.
10. Score delta maior que +5 (ex: +8) com estratégia central diferente ➔ veredito `human-review-needed` e Exit Code 4.
11. Score delta maior que +5 (ex: +8) com fallback V2 introduzido ➔ veredito `blocker` e Exit Code 1.
12. Moves/itens diferentes, com mesmo papel estratégico (`roleDiff === equal`) e delta $+2$ ➔ veredito `acceptable-divergence` e Exit Code 0.
13. Todos os comparadores críticos iguais ➔ veredito `equivalent` e Exit Code 0.
14. Queda de qualidade de set competitiva (rank menor no V2) ➔ veredito `regression` e Exit Code 1.
15. Erro no comparador `errorDiff` ou nos arrays de erro ➔ veredito `blocker` e Exit Code 1.
16. Comparador obrigatório ausente no relatório ➔ veredito `blocker` e Exit Code 1.
17. Precedência múltipla (melhoria + revisão + blocker no mesmo cenário) ➔ maior severidade (`blocker`) vence.
18. Veredito global de revisão humana sem regressão/bloqueio ➔ CLI retorna Exit Code 4.
19. Veredito global de regressão ou bloqueante ➔ CLI retorna Exit Code 1.
20. Veredito global de aprovado ➔ CLI retorna Exit Code 0.
21. Os relatórios JSON e Markdown refletem de forma idêntica o mesmo `gateStatus`.
22. O arquivo de input original permanece completamente inalterado.
23. Nenhum acesso à rede ou ao banco MongoDB Atlas/Local ocorre.
