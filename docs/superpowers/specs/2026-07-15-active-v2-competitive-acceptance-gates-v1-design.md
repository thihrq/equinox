# Active V2 Competitive Acceptance Gates V1 Design

## Status

Especificação em revisão. Este documento define as regras lógicas de governança de dados para a fase de aceitação competitiva do Equinox. Ele é um documento de especificação técnica e não altera o tráfego público, configuração do Render ou executa escritas em produção.

---

## 1. Objective

A fase **Active V2 Competitive Acceptance Gates V1** consome as saídas de diferenças estruturadas (*shadow comparison report*) geradas na fase anterior e as traduz em classificações e vereditos competitivos determinísticos e auditáveis.

O objetivo é automatizar a avaliação de conformidade competitiva do novo motor de dados (V2) através de regras de negócio claras, gerando um relatório estruturado em JSON, um relatório humano em Markdown e determinando se as divergências observadas impedem, exigem revisão humana ou aprovam a transição competitiva.

---

## 2. Princípios de Segurança e Não-Negociabilidade

*   **Read-Only**: O runner de aceitação opera apenas lendo o relatório JSON. Ele não faz conexões ao banco de dados MongoDB de produção ou staging.
*   **Isolamento**: A rotina executa exclusivamente via script CLI e processos de auditoria local ou CI.
*   **Validação Prévia de Integridade**: O relatório shadow fornecido como entrada deve ser validado por um componente dedicado para garantir que a evidência de comparação é 100% íntegra antes de qualquer classificação ou lógica competitiva.

---

## 3. Estrutura de Arquivos e Diretórios

Os novos arquivos serão estruturados conforme a seguinte organização:

```text
src/services/competitive-data/acceptance/
  ActiveV2AcceptanceTypes.ts            # Tipagens e contratos de aceitação
  ActiveV2AcceptancePolicy.ts           # Centralização de limites e constantes (policy)
  ActiveV2AcceptanceEvidenceValidator.ts # Validador de integridade e metadados da evidência
  ActiveV2AcceptanceClassifier.ts       # Lógica da árvore de decisão pura por comparador
  ActiveV2AcceptanceGates.ts            # Avaliação agregada e veredito do portão
  ActiveV2AcceptanceReportFormatter.ts  # Formatador de relatórios Markdown e JSON puros

src/scripts/
  checkActiveV2Acceptance.ts                    # Script CLI principal de validação
  validateActiveV2AcceptanceContracts.ts        # Testes de contrato de dados offline
  validateActiveV2AcceptanceEvidenceValidator.ts # Testes de integridade física e safety
  validateActiveV2AcceptanceClassifier.ts       # Testes da árvore de decisão competitiva
  validateActiveV2AcceptanceGates.ts            # Testes dos portões agregados
  validateActiveV2AcceptanceReportWriter.ts     # Testes de formatação e escrita do relatório
  validateActiveV2AcceptanceCliExitCodes.ts     # Testes de códigos de saída da CLI
  validateActiveV2AcceptanceOffline.ts          # Integrador e suíte de execução offline

src/scripts/support/
  writeActiveV2AcceptanceArtifacts.ts           # Adaptador de persistência física (E/S) atômica
```

---

## 4. Contrato de Entrada e Evidência de Shadow

O CLI do Acceptance Gates dependerá do carregamento do relatório de Shadow em formato JSON. O contrato de entrada reusará diretamente as tipagens oficiais geradas no shadow runner (`ActiveV2ShadowReport` importado do arquivo `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowTypes.ts`) para evitar duplicação ou divergência futura.

O validador de evidência (`ActiveV2AcceptanceEvidenceValidator.ts`) deve rejeitar a evidência globalmente se qualquer uma das validações abaixo falhar:

*   `targetCollection` diferente de `pokemonsets_v2_staging`.
*   `scenariosCompared` diferente de `4`.
*   `scenarios.length` diferente de `4`.
*   `differencesFullyRecorded` diferente de `true`.
*   `readyForCompetitiveAcceptanceGate` diferente de `true`.
*   `productionCollectionReads` maior que `0`.
*   `observedMongoWriteCommands` maior que `0`.
*   `recordsWritten` maior que `0`.
*   `productionWrites` maior que `0`.
*   `baselineFallbackUsed` igual a `true`.
*   `activeV2FallbackUsed` igual a `true`.
*   `localPilotFallbackUsed` igual a `true`.
*   `activeRunId` ausente ou vazio.
*   `baselineSourceVersion` ausente ou vazio.
*   `baselineSourceDigest` inválido (deve casar com a regex `/^sha256-[a-f0-9]{64}$/`).
*   `baselineSourceRecordCount` menor ou igual a `0`.
*   Algum comparador obrigatório ausente no diff de qualquer cenário.
*   Presença de cenários duplicados.
*   `scenarioId` ausente ou vazio.

### 4.1. Comportamento com Evidência Inválida
Caso a validação global falhe, o classificador competitivo **não iniciará** a classificação por cenário. O resultado agregado do gate deve ser imediatamente marcado como rejeitado contendo um bloqueante global:

```json
{
  "gateStatus": "rejected",
  "automaticRolloutApproved": false,
  "evidenceValid": false,
  "globalBlockers": [
    {
      "classification": "blocker",
      "reasonCode": "SHADOW_EVIDENCE_INVALID",
      "explanation": "Shadow evidence failed validation checks."
    }
  ],
  "scenarioVerdicts": []
}
```

---

## 5. Política de Aceitação Centralizada

Os limites competitivos e as constantes serão governados pela política centralizada `ACTIVE_V2_ACCEPTANCE_POLICY_V1`:

```typescript
export interface ActiveV2AcceptancePolicy {
  version: string;
  scoreRegressionExclusiveUpperBound: number; // ex: -10
  scoreReviewExclusiveUpperBound: number;      // ex: -5
  scoreAcceptableUpperBound: number;           // ex: 5
}

export const ACTIVE_V2_ACCEPTANCE_POLICY_V1: ActiveV2AcceptancePolicy = {
  version: 'active-v2-acceptance-v1',
  scoreRegressionExclusiveUpperBound: -10,
  scoreReviewExclusiveUpperBound: -5,
  scoreAcceptableUpperBound: 5,
} as const;
```

---

## 6. Precedência das Classificações Competitivas

Cada comparador gerará um resultado individual de severidade, e o veredito geral do cenário será determinado pela classificação de maior precedência (mais severa para menos severa):

`blocker` ➔ `regression` ➔ `human-review-needed` ➔ `improvement` ➔ `acceptable-divergence` ➔ `equivalent`

*   `blocker` sempre domina e impede qualquer aprovação automática.
*   `regression` nunca pode ser mascarada por melhorias parciais no mesmo cenário.
*   Qualquer mudança estratégica central (`selectedLeadStrategyDiff`) exige revisão humana mesmo se acompanhada por score superior.
*   `improvement` só é atribuída quando não há riscos de severidade superior no cenário.

---

## 7. Códigos de Razão Estáveis (`AcceptanceReasonCode`)

As classificações por comparador registrarão um código de razão estável correspondente:

```typescript
export type AcceptanceReasonCode =
  | 'SHADOW_EVIDENCE_INVALID'
  | 'ACTIVE_V2_FALLBACK_INTRODUCED'
  | 'EXECUTION_ERROR_PRESENT'
  | 'SET_QUALITY_REGRESSION'
  | 'SCORE_MAJOR_REGRESSION'
  | 'SCORE_REVIEW_RANGE'
  | 'SCORE_IMPROVEMENT'
  | 'CENTRAL_STRATEGY_CHANGED'
  | 'TACTICAL_VARIATION_ACCEPTABLE'
  | 'CRITICAL_COMPARATORS_EQUAL';
```

---

## 8. Lógica de Classificação por Comparador

O `ActiveV2AcceptanceClassifier` deve ser funcional puro (sem IO, Console ou conexões). Cada comparador produzirá um resultado de classificação obrigatório:

```typescript
export interface ComparatorClassification {
  comparator: string;
  diffStatus: 'equal' | 'different' | 'error';
  classification: CompetitiveClassification;
  reasonCode: AcceptanceReasonCode;
  explanation: string;
  baselineValue?: unknown;
  activeV2Value?: unknown;
  scoreDeltaAbsolute?: number;
  scoreDeltaPercent?: number | null;
}
```

### 8.1. Qualidade de Sets (`setDiff`)
A qualidade do set não deve ser inferida por texto livre, mas sim resolvida a partir dos campos reais do set (`status`, `sourceType`, `sourceKind`, `fallbackUsed`) através de uma função pura:

```typescript
export type SetQualityCategory =
  | 'active-curated'
  | 'verified-curated'
  | 'reviewed-curated'
  | 'verified-generated'
  | 'reviewed-generated'
  | 'local-pilot'
  | 'generic-fallback'
  | 'missing';

export function resolveSetQuality(
  status: string | undefined,
  sourceType: string | undefined,
  sourceKind: string | undefined,
  fallbackUsed: boolean,
): SetQualityCategory;
```

Se receber um valor desconhecido, ela resultará em `human-review-needed` ou `blocker` (caso impeça classificação confiável).

*   **`regression`**: Se a qualidade de qualquer set escolhido no V2 possuir rank de qualidade estritamente menor do que o do baseline para o mesmo Pokémon.
*   **`improvement`**: Se o V2 carregou sets curados (`active-curated`, `verified-curated`, `reviewed-curated`) enquanto o baseline utilizava ranks menores.
*   **`equivalent`**: Sets idênticos.
*   **`acceptable-divergence`**: Sets diferentes mas com mesmo rank de qualidade e mesma curadoria.

### 8.2. Lógica de Classificação de Score (`scoreDiff`)
O delta de score será computado de forma absoluta e percentual:

$$\text{scoreDeltaAbsolute} = \text{activeV2Score} - \text{baselineScore}$$

$$\text{scoreDeltaPercent} = \begin{cases} 
\text{null}, & \text{se } \text{baselineScore} = 0 \\
\left( \frac{\text{scoreDeltaAbsolute}}{|\text{baselineScore}|} \right) \times 100, & \text{se } \text{baselineScore} \neq 0 
\end{cases}$$

Regra de score fixada sem lacunas:
```typescript
if (delta < -10) {
  return 'regression'; // SCORE_MAJOR_REGRESSION
}
if (delta >= -10 && delta < -5) {
  return 'human-review-needed'; // SCORE_REVIEW_RANGE
}
if (delta >= -5 && delta <= 5) {
  return hasTacticalDifferences
    ? 'acceptable-divergence' // TACTICAL_VARIATION_ACCEPTABLE
    : 'equivalent'; // CRITICAL_COMPARATORS_EQUAL
}
return 'improvement'; // delta > 5 e SCORE_IMPROVEMENT
```

### 8.3. Contrato Real de Erros (`errorDiff`)
O erro de execução no comparador de erros será resolvido com base na estrutura real importada do shadow comparison:
```typescript
const hasExecutionError =
  comparison.errorDiff.status === 'different' ||
  baselineResult.errors.length > 0 ||
  activeV2Result.errors.length > 0;
```
Se `hasExecutionError` for verdadeiro, a classificação do comparador será `blocker` (`EXECUTION_ERROR_PRESENT`).

### 8.4. Comparadores Críticos e Regra de Aceitação Estrita
Os comparadores críticos analisados são:
```typescript
export const CRITICAL_COMPARATORS = [
  'setDiff',
  'moveDiff',
  'itemDiff',
  'abilityDiff',
  'roleDiff',
  'leadStrategyDiff',
  'teamDataCoverageDiff',
  'fullTeamEvaluationDiff',
  'scoreDiff',
  'fallbackDiff',
  'exportDiff',
  'errorDiff',
] as const;
```

A classificação `acceptable-divergence` exige simultaneamente:
*   `scoreDelta` entre $-5$ e $+5$.
*   `roleDiff.status === 'equal'`.
*   `leadStrategyDiff.status === 'equal'`.
*   `fallbackDiff.status === 'equal'`.
*   `errorDiff.status === 'equal'`.
*   Export estruturalmente válido (`exportDiff` sem erros).
*   Nenhuma redução de qualidade de set no `setDiff`.
*   Moves, itens e habilidades sugeridos válidos e equivalentes estrategicamente.
Se qualquer uma das condições falhar, a classificação escala para `human-review-needed`.

---

## 9. Validação e Portão de Aceitação Agregado

O portão de aceitação agregado consolida os vereditos dos cenários em um status global (`AcceptanceGateStatus`):

*   **`approved`**: Todos os cenários classificados como `improvement`, `acceptable-divergence` ou `equivalent`.
*   **`rejected`**: Presença de qualquer comparador ou cenário com classificação `blocker` ou `regression`.
*   **`human-review-required`**: Sem regressão ou bloqueio, mas com pelo menos um cenário com `human-review-needed`.

---

## 10. Execução CLI, Parâmetros e Saídas

O script CLI (`checkActiveV2Acceptance.ts`) aceitará parâmetros explícitos:

```powershell
npm.cmd run sets:active-v2-acceptance:check -- `
  --input ".\artifacts\active-v2-shadow-comparison-v1.json" `
  --output-json ".\artifacts\active-v2-acceptance-gates-v1.json" `
  --output-markdown ".\docs\data-audit\active-v2-acceptance-gates-v1-report.md"
```

O script CLI calculará o digest hash sobre os bytes originais do arquivo JSON de entrada consumido e o registrará no relatório no formato `sha256-<64 caracteres hexadecimais>` na propriedade `inputEvidenceDigest`.

### 10.1. Escrita Atômica dos Relatórios
O adaptador de persistência física (`writeActiveV2AcceptanceArtifacts.ts`) garantirá a integridade do disco criando o diretório e escrevendo primeiro em arquivos temporários (ex: `report.json.tmp`, `report.md.tmp`) e, somente após a conclusão da gravação, renomeará os arquivos para o destino final (removendo os temporários em caso de falha de gravação).

### 10.2. Códigos de Saída (Exit Codes)
*   **`0`**: Portão aceito e aprovado automaticamente (`approved`).
*   **`1`**: Portão rejeitado (`rejected` por regressão, bloqueador ou falha global de evidência).
*   **`4`**: Portão necessita de revisão humana (`human-review-required`).
*   **`2`**: Parâmetros CLI inválidos.
*   **`3`**: Arquivo de input ausente ou falha física no parse do JSON.
