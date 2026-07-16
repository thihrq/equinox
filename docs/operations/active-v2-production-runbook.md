# Active V2 Production Runbook

**Status:** Runbook incremental (adendo 4.7). Ampliado a cada fase. Esta versão cobre até a Fase 5 (Canário Interno) e a primeira integração real da Fase 3 (Runtime Shadow Mode). Todo comando abaixo já foi validado contra um MongoDB **local** real (`scripts-local/`, ver `docs/data-audit/active-v2-local-mongo-validation-v1-report.md`) — não é o Atlas de produção, mas é mais do que apenas offline/mockado. Antes do primeiro uso real contra Atlas, confirme que o comando ainda corresponde ao código (`git log` no arquivo referenciado) e rode o restore drill oficial (seção 8) com as ferramentas reais do Atlas.

## 0. Como usar este documento

- Cada seção de fase segue a mesma estrutura mínima do adendo 4.7: **sinais de incidente**, **comandos permitidos**, **flags**, **responsáveis**, **rollback**, **validação pós-rollback**, **coleta de evidência**, **comunicação**.
- Todo comando aqui é `npm run <script>`, executado a partir da raiz do repositório, branch `feature/active-v2-production-publication-and-gates` (ou a branch que a suceder após merge).
- **Nenhum comando de escrita real funciona sem as flags de ambiente explícitas listadas.** Isso é deliberado — a ausência de flag é o comportamento seguro por padrão em todo o pipeline.
- "Responsável" abaixo é um papel, não uma pessoa nomeada — preencher com o nome real na hora do incidente e registrar no changelog.

## 1. Publicação e rollback de dados (Fase 1 — Production Publication)

### Sinais de incidente
- `publishActiveV2Production.ts` retorna exit code diferente de 0.
- Digest recalculado (`ActiveV2CanonicalDataDigest`) diverge do digest do manifesto ativo.
- `pokemonsets` (coleção legada) sofre qualquer escrita não intencional — isso é sempre um incidente crítico, nunca esperado.

### Comandos permitidos
```bash
npm run sets:active-v2-production:publish -- --acceptance-report <path> --publish-run-id <id> [--dry-run]
npm run sets:active-v2-production:rollback -- --publish-run-id <id> [--dry-run]
```

### Flags obrigatórias
- `MONGO_URI` ou `MONGODB_URI`
- `EQUINOX_ENABLE_ACTIVE_V2_PRODUCTION_PUBLICATION=true`
- Dry-run: `EQUINOX_ALLOW_DATABASE_WRITES=false` (obrigatório — dry-run com writes=true é recusado)
- Execução real: `EQUINOX_ALLOW_DATABASE_WRITES=true` e `EQUINOX_ACTIVE_V2_PRODUCTION_TARGET=pokemonsets_v2`

### Responsáveis
- Publicação: 1 responsável autorizado (fora de janela canária ativa) ou 2 aprovadores (durante exceção de congelamento — ver seção 8).

### Rollback
`rollbackActiveV2Production.ts` desativa a versão publicada e reativa a anterior via `setTransitions`, em uma única transação. Não executa deletes. Execução imediata permitida, sem aprovação prévia — é uma ação de recuperação, não uma mudança de estado.

### Validação pós-rollback
1. `npm run sets:active-v2-production:publish -- --dry-run` deve reportar `no-op` para o `publishRunId` revertido.
2. Confirmar via `ActiveV2RuntimeManifestHealth` (seção 4) que `digestMatchesManifest = true` e `manifestRecordCountMatchesActiveSetCount = true`.

### Coleta de evidência
- Saída completa (stdout) do comando de rollback.
- `publishRunId` anterior e novo, registrados no changelog (seção 7).

### Comunicação
- Notificar antes de iniciar publicação real fora de horário de baixo tráfego.

---

## 2. Runtime Read Homologation (Fase 2)

### Sinais de incidente
- `homologateActiveV2RuntimeRead` reporta `approved: false` (exit 1).
- `MANIFEST_HEALTH_ISSUE` — mesma causa raiz do circuit breaker (seção 5); considerar acioná-lo se isso ocorrer com a flag de leitura ligada em produção.
- `INCOMPLETE_ACTIVE_SET` — um `setId` listado no manifesto ativo não foi encontrado entre os registros ativos lidos. Isso é o sintoma exato de um fallback silencioso que a Fase 2 existe para prevenir.

### Comandos permitidos
```bash
npm run sets:active-v2-runtime-read:homologate -- [--output-json <path>] [--output-markdown <path>]
```

### Flags
- `EQUINOX_ACTIVE_V2_RUNTIME_READ_ENABLED=true` — sem essa flag (padrão), o comando roda em modo `baseline-only` e **nem tenta** ler `pokemonsets_v2`. Isso não é um branch condicional depois da leitura; é a garantia estrutural do critério "mesmo comportamento quando a flag estiver desligada".
- Com a flag ligada: `MONGO_URI`/`MONGODB_URI` obrigatório.
- O leitor (`ActiveV2RuntimeReader.ts`) só conhece os nomes `pokemonsets_v2` e `publication_manifests` — a coleção legada `pokemonsets` nunca é referenciada no código deste caminho, tornando "zero leitura da coleção legada" uma garantia por construção, testada em `validateActiveV2RuntimeReader.ts` (spy que falha se `pokemonsets` for solicitado).

### Responsáveis
- Leitura/homologação: qualquer responsável autorizado. É somente leitura (0 writes) — não há uma "escrita" a ser aprovada aqui.

### Rollback
Não aplicável — comando somente leitura. Se `approved: false`, o rollback é o mesmo da causa raiz identificada (rollback de publicação, seção 1, ou reativação do circuit breaker, seção 5), não desta homologação em si.

### Validação pós-rollback
Rodar `sets:active-v2-runtime-read:homologate` novamente e confirmar `approved: SIM` antes de prosseguir para a Fase 3.

### Coleta de evidência
- Relatório JSON/Markdown gerado pelo próprio comando quando `--output-*` é passado, mesmo padrão das demais fases.

### Comunicação
- Esta homologação é um pré-requisito silencioso — não precisa de comunicação própria, mas seu resultado (`approved`) deve ser conferido antes de qualquer decisão de avançar para o Runtime Shadow Mode (Fase 3).

---

## 3. Runtime Shadow Mode (Fase 3)

**Esta é a primeira seção deste runbook que descreve código já ligado a uma requisição real** (`POST /api/team/suggest` → `TeamController.suggest` → `src/services/competitive-data/runtime-shadow/ActiveV2RuntimeShadowOrchestrator.ts`), embora ainda sem tráfego real chegando (canário em modo `off` por padrão).

### Escopo desta integração — leia antes de operar
O caminho V2 em paralelo **não** re-executa o algoritmo de seleção de candidatos (`CandidateSelector`/`CandidateScoreEngine`/`CombinationSearchEngine`) contra dados V2 — isso exigiria clonar o pipeline inteiro de `TeamService.suggestComplements`, e a cobertura de dados V2 hoje (14 sets) tornaria a maior parte das comparações inúteis por falta de cobertura. Em vez disso, compara **dados de set** (item/ability/nature/moves) dos Pokémon que o baseline já escolheu, contra o set ativo correspondente em `pokemonsets_v2`, quando existir. EVs/IVs não são comparados porque o endpoint `/api/team/suggest` nunca os calcula — não há dado real para comparar.

### Sinais de incidente
- Qualquer erro relacionado a `runActiveV2RuntimeShadow` nos logs do servidor (`console.warn('[Equinox] Active V2 runtime shadow failed (ignored):' ...)`) — por design **nunca** afeta a resposta ao usuário, mas um volume alto e sustentado desses warnings indica um problema real (ex: Mongo instável) que vale investigar antes que afete outras partes do sistema.
- Alertas da Fase 2A (seção 4) usando os eventos escritos por este caminho — a partir do momento em que o canário estiver em modo `shadow`, `evaluateActiveV2RuntimeObservability --with-manifest-health` passa a ter dados reais de `active_v2_runtime_telemetry` para avaliar.

### Comandos permitidos
Não há um CLI dedicado para esta fase — a execução acontece dentro do processo do servidor a cada requisição a `/api/team/suggest`, condicionada ao modo de canário (ver Flags). Para inspecionar o resultado, use os comandos já existentes da Fase 2A (seção 4) apontando para a coleção `active_v2_runtime_telemetry`.

### Flags
- **`EQUINOX_ACTIVE_V2_RUNTIME_SHADOW_ENABLED=true`** — interruptor estático de deploy, independente do Mongo. Sem essa flag (padrão), zero interação com o banco em qualquer requisição, mesmo que o canário esteja em `shadow`. É o kill-switch a usar se for preciso desligar este caminho sem depender do mesmo Mongo que pode estar com problema.
- Modo de canário deve ser `shadow` (`npm run sets:active-v2-canary:set-mode -- --mode shadow ...`, seção 6) — sem isso, o código sai depois de 1 leitura (a config de canário) sem sequer ler o estado do circuit breaker.
- A cadeia de precedência completa da Fase 4 se aplica: circuit breaker em `force-baseline` (seção 5) ou `EQUINOX_ACTIVE_V2_FORCE_BASELINE=true` suprimem a avaliação shadow mesmo com o canário em modo `shadow` (`resolveActiveV2RuntimeDecision` decide isso).
- Só é avaliado para requisições com `format=champions_reg_m_b_doubles` — o único formato coberto pelos dados V2 hoje. Qualquer outro formato sai antes de qualquer chamada ao Mongo.
- **Ordem das checagens, do mais barato para o mais caro:** formato (sem Mongo) → flag estática (sem Mongo) → config de canário (1 leitura) → estado do breaker, só se o canário já estiver em `shadow` (2ª leitura). No caso comum — feature desligada ou canário desligado — o custo é zero ou uma leitura, não duas em toda requisição.

### Responsáveis
- Ligar o modo `shadow`: mesma governança da seção 6 (transição para `shadow` exige 1 responsável).
- Este caminho nunca escreve em `pokemonsets_v2` ou `pokemonsets` — a única escrita é um documento novo em `active_v2_runtime_telemetry` por requisição avaliada. Não há aprovação necessária para a leitura/comparação em si.

### Rollback
Não aplicável a este código diretamente — se o comportamento for indesejado, o rollback é voltar o modo de canário para `off` (seção 6) ou acionar o circuit breaker (seção 5), ambos já suprimem a chamada inteira.

### Validação pós-rollback
Confirmar via `npm run sets:active-v2-canary:status` que o modo voltou a `off`, e que os logs do servidor não mostram mais `[Equinox] Active V2 runtime shadow failed`.

### Coleta de evidência
- Documentos em `active_v2_runtime_telemetry` (consultar via `sets:active-v2-runtime-observability:evaluate --with-manifest-health`, seção 4).
- Console warnings, se houver falhas (a falha nunca é silenciosa — sempre loga, mesmo não afetando a resposta).

### Comunicação
- Ligar o modo `shadow` pela primeira vez em produção deve ser comunicado à equipe — é o primeiro momento em que código Active V2 toca uma requisição real, mesmo que apenas em paralelo.

### Limitações assumidas
- Nenhum teste real contra tráfego de produção — só validado offline com conexão Mongo mockada (`validateActiveV2RuntimeShadowOrchestrator.ts`) e confirmando que o servidor sobe sem erro de import/inicialização.
- Mesmo com a flag estática e o canário em `shadow`, cada requisição avaliada ainda faz 1 leitura de Mongo (config de canário) antes de decidir, e uma 2ª (estado do breaker) só quando o canário já está em `shadow` — sem cache. Para um volume alto de tráfego real com o canário deliberadamente em `shadow` por dias, cache com TTL curto é um candidato natural de otimização futura.
- Compara apenas o **time principal** sugerido (`topTeams[0]`), não as 5 variantes retornadas — reduz volume de telemetria sem perder o sinal principal.

---

## 4. Observabilidade (Fase 2A)

### Sinais de incidente
Os 9 alertas mínimos, avaliados por `ActiveV2RuntimeAlertEvaluator`: `V2_ERROR_RATE`, `V2_TIMEOUT_RATE`, `FALLBACK_RATE`, `BLOCKER_CLASSIFICATION_PRESENT`, `P95_LATENCY_DEGRADATION`, `ZERO_ACTIVE_SETS`, `MULTIPLE_ACTIVE_VERSIONS`, `MANIFEST_INCONSISTENCY`, `DIGEST_MISMATCH`.

### Comandos permitidos
```bash
npm run sets:active-v2-runtime-observability:evaluate -- --input <telemetria.json> [--output-json <path>] [--output-markdown <path>] [--with-manifest-health]
npm run sets:active-v2-runtime-observability:inject-synthetic-alert -- [--output-json <path>] [--output-markdown <path>]
```

### Flags
- `--with-manifest-health` exige `MONGO_URI`/`MONGODB_URI`. Sem essa flag, apenas métricas de telemetria são avaliadas (sem os 4 alertas estruturais).

### Responsáveis
- Leitura/monitoramento: qualquer responsável autorizado. Não é uma ação de escrita.

### Rollback
Não aplicável — este comando é somente leitura (0 writes).

### Validação pós-rollback
N/A.

### Coleta de evidência
- `docs/data-audit/active-v2-runtime-observability-v1-report.md` e o JSON correspondente em `artifacts/` — gerados automaticamente pelo próprio comando quando `--output-*` é passado.
- Para o gate de injeção sintética: `docs/data-audit/active-v2-runtime-observability-synthetic-injection-v1-report.md`.

### Comunicação
- `hasCriticalAlert=true` (exit code 1) deve ser tratado como sinal para avaliar o acionamento do circuit breaker (seção 5), não silenciosamente ignorado.

---

## 5. Circuit Breaker (Fase 4B)

### Sinais de incidente
Qualquer alerta de severidade `critical` da seção 4, sustentado, é motivo para acionar `force-baseline`.

### Comandos permitidos
```bash
npm run sets:active-v2-circuit-breaker:status
npm run sets:active-v2-circuit-breaker:force-baseline -- --operator <nome> --reason <texto> [--triggered-by manual|automatic] [--reason-code <CODIGO>]
npm run sets:active-v2-circuit-breaker:reactivate -- --approver-one <nome> --approver-two <nome> --reason <texto>
```

### Flags
- `MONGO_URI`/`MONGODB_URI` sempre.
- Escrita do estado do breaker exige `EQUINOX_ACTIVE_V2_CIRCUIT_BREAKER_WRITE_ROLE=true` — **flag distinta** de `EQUINOX_ALLOW_DATABASE_WRITES` (adendo 3.2/refinamento 8.4). Só conceder essa flag à credencial/role dedicada, nunca à credencial geral da aplicação.

### Responsáveis
- **Acionamento (`force-baseline`): execução imediata, 1 operador, sem aprovação prévia.** É uma ação de proteção, não pode esperar aprovação.
- **Reativação: 2 aprovadores distintos, obrigatório.** O CLI recusa (`exit 2`) se os dois nomes forem iguais.

### Rollback
O "rollback" do circuit breaker é a própria reativação (retirar `force-baseline`). Não há uma ação de rollback separada — o breaker em si já é o mecanismo de recuperação para o Active V2, **incluindo o caminho shadow da Fase 3** (`resolveActiveV2RuntimeDecision` respeita `force-baseline` antes de checar o modo de canário).

### Validação pós-rollback (pós-reativação)
1. `npm run sets:active-v2-circuit-breaker:status` deve reportar `mode: NORMAL` e `requiresManualRecovery: NAO`.
2. Rodar novamente `sets:active-v2-runtime-observability:evaluate --with-manifest-health` e confirmar `hasCriticalAlert=false` antes de considerar o incidente encerrado.

### Coleta de evidência
- `docs/data-audit/active-v2-runtime-flag-changelog.md` recebe uma linha automática a cada trip/reativação (timestamp UTC, responsável, aprovador, valor anterior/novo, motivo).

### Comunicação
- Acionamento do breaker é sempre comunicado à equipe imediatamente (não espera o changelog ser lido).
- Reativação é comunicada antes de ser executada, já que reabre o caminho para tráfego no Active V2 (inclusive o caminho shadow da Fase 3).

---

## 6. Canary Infrastructure e percentuais (Fase 4)

### Sinais de incidente
- `checkActiveV2CanaryConfig` mostra um modo/percentual inesperado (mudança não registrada no changelog).
- Discrepância entre o modo esperado (última entrada do changelog) e o modo lido do banco.

### Comandos permitidos
```bash
npm run sets:active-v2-canary:status
npm run sets:active-v2-canary:set-mode -- --mode <off|shadow|internal|percentage|full> [--percentage <N>] --responsible <nome> --reason <texto> [--approver-two <nome>] [--executive-approver <nome>] [--new-canary-campaign-id <id>] [--new-seed <valor>]
```

### Flags
- `MONGO_URI`/`MONGODB_URI` sempre.
- Escrita exige `EQUINOX_ACTIVE_V2_CANARY_CONFIG_WRITE_ROLE=true` (flag dedicada, mesmo princípio da seção 5).

### Responsáveis (controle de quatro olhos — adendo 4.2)
| Transição alvo | Aprovadores exigidos |
|---|---|
| off / shadow / internal | 1 (`--responsible`) |
| percentage ≤ 10% | 1 (`--responsible`, revisão registrada) |
| percentage > 10% | 2 (`--responsible` + `--approver-two`, distintos) |
| full (100%) | 2 técnicos + 1 executivo (`--executive-approver`, distinto dos outros dois) |

O CLI recusa (`exit 2`) qualquer transição sem os aprovadores exigidos pelo tier — isso é aplicado por código (`ActiveV2CanaryTransitionPolicy.ts`), não depende de disciplina manual.

**Ligar o modo `shadow` (Fase 3) usa o tier de 1 responsável**, mesmo que já esteja ligando código de produção real pela primeira vez — trate essa transição específica com o mesmo cuidado de comunicação de uma mudança maior, mesmo que a governança formal exija só 1 aprovador.

### Regra de seed (adendo 4.1)
A seed é imutável dentro de uma campanha (`canaryCampaignId`). Mudar a seed sem fornecer um `--new-canary-campaign-id` junto é rejeitado com `SEED_CHANGE_REQUIRES_NEW_CAMPAIGN`. Isso preserva a amostragem cumulativa (quem está nos 5% permanece nos 10%, 25%, etc.).

### Rollback
Voltar ao modo/percentual anterior é uma transição normal pelo mesmo `set-mode`, sujeita ao mesmo tier de aprovação do modo de **destino** (não do modo de origem) — reduzir de 25% para 10%, por exemplo, ainda é classificado pelo alvo (10%, tier de 1 aprovador).

### Validação pós-rollback
1. `npm run sets:active-v2-canary:status` confirma o modo/percentual esperado.
2. Confirmar no changelog que a linha da mudança foi registrada com o motivo correto.

### Coleta de evidência
- Mesma linha do changelog da seção 5 (`active-v2-runtime-flag-changelog.md`) — breaker e canário compartilham o arquivo.

### Comunicação
- Toda mudança acima de 10% é comunicada antes da execução (aprovação de duas pessoas já implica isso na prática).
- 50% → 100% (full) é comunicada com antecedência à liderança técnica, dado o requisito de aprovação executiva.

---

## 7. Canário Interno / HMAC (Fase 5)

### Sinais de incidente
- Taxa elevada de `NONCE_ALREADY_USED` fora de um cenário de replay conhecido (pode indicar um bug de cliente reenviando requisições).
- `NO_ACTIVE_SECRET` — janela de rotação de segredo mal configurada (todos os segredos expiraram ou nenhum começou a valer ainda).
- `RATE_LIMIT_EXCEEDED` sustentado para um subject legítimo — pode indicar um loop de retry indevido no lado do cliente.

### Comandos permitidos
```bash
npm run sets:active-v2-internal-canary:sign -- --subject <nome> --request-path </caminho> [--secret <valor>]
npm run sets:active-v2-internal-canary:check -- --subject <s> --timestamp <epochMs> --nonce <n> --signature <sig> --request-path </caminho>
```

### Flags
- `EQUINOX_ACTIVE_V2_CANARY_HMAC_SECRETS` (JSON, nunca no Mongo — ver `ActiveV2InternalCanarySecretRegistry.ts`).
- `EQUINOX_ACTIVE_V2_CANARY_SUBJECT_ALLOWLIST` (comma-separated).
- `MONGO_URI`/`MONGODB_URI` para o `:check` (nonce store e rate limiter são compartilhados via Mongo).

### Responsáveis
- Adicionar/remover um subject da allowlist é uma mudança de configuração de deploy (variável de ambiente), não uma escrita em runtime — trate com o mesmo rigor de qualquer mudança de flag estática (revisão registrada).
- Rotação de segredo: gerar o novo segredo, publicá-lo com `activeFrom` no futuro próximo e `activeUntil` do segredo antigo definido (nunca revogar um segredo instantaneamente sem sobreposição — isso quebra qualquer cliente com um `signActiveV2InternalCanaryRequest` já em voo).

### Rollback
Reverter a variável de ambiente do segredo/allowlist ao valor anterior (redeploy). Não há estado dinâmico a reverter no Mongo além do nonce/rate-limit stores, que se auto-expiram (TTL) e não precisam de rollback manual.

### Validação pós-rollback
- Rodar `sets:active-v2-internal-canary:sign` seguido de `:check` com um subject de teste conhecido e confirmar `authorized: SIM`.

### Coleta de evidência
- Console output do `:check` já inclui `[CANARY AUTH] subject=... authorized=... reason=...` — nunca inclui IP a menos que explicitamente solicitado (política de privacidade, adendo 3.5).

### Comunicação
- Rotação de segredo é comunicada à equipe com antecedência suficiente para atualizar qualquer automação de teste que assine requisições.

---

## 8. Restore drill (transversal, antes da primeira escrita real)

**Executado contra MongoDB local real** em 2026-07-16 (`npm run local-mongo:restore-drill`, ver `docs/data-audit/active-v2-local-mongo-validation-v1-report.md`) — 14/14 registros restaurados, digest idêntico, índices batendo. **Ainda não executado contra o Atlas real** — o drill local usa um mecanismo de snapshot/restore em nível de aplicação (via driver), não os binários `mongodump`/`mongorestore` (indisponíveis neste ambiente). Procedimento oficial (adendo 3.7), a repetir contra Atlas antes da primeira escrita real de produção:

1. Snapshot do ambiente (com as ferramentas reais do Atlas).
2. Restauração em cluster/banco isolado (nunca sobre produção).
3. Validação de contagens, índices, manifestos e digests no ambiente restaurado.
4. Relatório do restore drill, publicado em `docs/data-audit/`.

Este drill é um bloqueio formal antes da primeira escrita real em `pokemonsets_v2`/`publication_manifests` **no Atlas de produção** — o drill local não substitui isso, só reduz o risco de o mecanismo em si estar quebrado.

---

## 9. Congelamento de dados durante janela canária (adendo 3.3)

Publicações em `pokemonsets_v2` ficam congeladas durante qualquer janela de observação canária ativa (Fase 6 em diante). Exceção só para: incidente crítico, correção de blocker, vulnerabilidade, ou erro grave de integridade de dados — e exige aprovação de duas pessoas com `reasonCode` registrado (adendo 4.2).

**Ponto em aberto não resolvido nesta branch:** o adendo identifica que falta um aprovador *nomeado* (papel formal, não apenas "duas pessoas quaisquer") para essa exceção especificamente. Isso é uma decisão de governança organizacional, não uma lacuna de código — precisa ser definida pela equipe antes do primeiro canário público (Fase 6).

---

## 10. Teto de `hold` por volume insuficiente (adendo 4.3)

`ActiveV2RolloutHoldPolicy.ts` define o teto: **21 dias corridos**. Ao atingir o teto, a fase não pode permanecer em `hold` silenciosamente — exige revisão humana explícita e registrada (prosseguir, ajustar o piso de volume, ou encerrar a fase). Não há automação de alerta para esse teto ainda; monitorar manualmente a data de início do `hold` até que a Fase 6+ implemente o rastreamento de janela por estágio.

---

## 11. Matriz de bloqueios (referência rápida)

| Marco | Bloqueio obrigatório | Status nesta branch |
|---|---|---|
| Primeira escrita real | Restore drill concluído | ✅ Concluído contra Mongo local (seção 8); pendente contra Atlas real |
| Runtime Shadow (Fase 3) | Fase 2A + teste de injeção sintética | ✅ Ligado em `TeamController.suggest`, testado offline e contra Mongo local real (seção 3); nunca exercitado via HTTP com tráfego real |
| Canary Infrastructure (Fase 4) | Circuit breaker dinâmico + role de escrita restrita | ✅ Código pronto e testado offline (seção 6) |
| Canary interno (Fase 5) | HMAC + nonce store compartilhado | ✅ Código pronto e testado offline (seção 7) |
| Canary 25% (Fase 8) | Fase 4A (teste de capacidade no Atlas) | Não iniciado — exige Atlas real |
| Rollout 100% (Fase 10) | Quatro olhos + runbook + alertas completos | Runbook nasce aqui; quatro olhos e alertas prontos, não exercitados ao vivo |

---

## Changelog deste runbook

| Data | Mudança |
|---|---|
| 2026-07-15 | Criação inicial. Cobre Fase 1 (publicação/rollback), Fase 2A (observabilidade), Fase 4B (circuit breaker), Fase 4 (canário público/percentuais), Fase 5 (canário interno/HMAC), restore drill (pendente), congelamento de dados, teto de hold. |
| 2026-07-16 | Adiciona Fase 2 (Runtime Read Homologation): leitura estritamente read-only de `pokemonsets_v2`, com "zero leitura da coleção legada" e "mesmo comportamento com a flag desligada" garantidos por construção do código, não apenas por teste. |
| 2026-07-16 | Adiciona Fase 3 (Runtime Shadow Mode): primeira integração real em `TeamController.suggest`, escopo reduzido a comparação de dados de set (sem re-executar o algoritmo de recomendação). Renumera as seções 3-10 para 4-11. |
