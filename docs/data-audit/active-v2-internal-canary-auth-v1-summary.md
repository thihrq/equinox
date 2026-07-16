# Active V2 Internal Canary Auth (HMAC) V1 — Sumário da Fase 5

**Status:** Implementado e validado offline (23/23 testes agregados entre Fase 2A, Circuit Breaker, Canary Infrastructure e Canário Interno). Fecha o **refinamento #1** da seção 8 do adendo (nonce store compartilhado).

## 1. Escopo desta fase

Esquema assinado descrito no adendo 3.5, substituindo o header estático original:

| Componente | Arquivo |
|---|---|
| Assinatura HMAC-SHA256 (timing-safe) | `src/services/competitive-data/internal-canary-auth/ActiveV2InternalCanarySignature.ts` |
| Registro de segredos com rotação | `src/services/competitive-data/internal-canary-auth/ActiveV2InternalCanarySecretRegistry.ts` |
| Allowlist de subjects | `src/services/competitive-data/internal-canary-auth/ActiveV2InternalCanaryAllowlist.ts` |
| **Nonce store compartilhado** (refinamento #1) | `src/services/competitive-data/internal-canary-auth/ActiveV2InternalCanaryNonceStore.ts` |
| Rate limiter compartilhado | `src/services/competitive-data/internal-canary-auth/ActiveV2InternalCanaryRateLimiter.ts` |
| Orquestrador (as 6 validações, em ordem) | `src/services/competitive-data/internal-canary-auth/ActiveV2InternalCanaryAuthValidator.ts` |
| Audit logger (sem IP por padrão) | `src/services/competitive-data/internal-canary-auth/ActiveV2InternalCanaryAuditLogger.ts` |

## 2. Como o refinamento #1 foi fechado

O adendo apontava: nonce em memória local por instância do Render quebra a proteção anti-replay, porque uma requisição repetida pode ser aceita por uma instância diferente da que já a processou.

`ActiveV2InternalCanaryNonceStore.ts` usa **Mongo compartilhado com `_id` determinístico** (`subject:nonce`). A detecção de replay não é um "verificar depois inserir" (que teria uma janela de corrida) — é uma única operação `insertOne` que se apoia na própria restrição de unicidade do banco: se o nonce já existe, o Mongo rejeita com erro de chave duplicada (código 11000), e isso é atômico entre qualquer número de instâncias. Também implementei o preflight de índice TTL (`verifyActiveV2CanaryNonceStoreIndexes`), no mesmo padrão de `ActiveV2ProductionPreflight.ts`, para garantir que a coleção tenha limpeza automática.

## 3. As 6 validações do adendo 3.5, em ordem

1. Timestamp dentro da janela (±5 min, configurável)
2. Subject em allowlist
3. Segredo ativo e não expirado (suporta múltiplos segredos simultâneos para rotação sem downtime)
4. Assinatura válida (comparação de tempo constante)
5. Nonce ainda não utilizado (Mongo compartilhado)
6. Rate limit específico por subject (Mongo compartilhado)

A ordem é deliberada: assinatura é verificada **antes** de consumir o nonce, para que uma requisição mal assinada nunca "queime" um nonce legítimo de outra pessoa.

## 4. Decisão de design: segredos e allowlist ficam em env, não no Mongo

Ao contrário do nonce store e do rate limiter (que **precisam** ser compartilhados por correção, não por sigilo), os segredos HMAC e a allowlist de subjects ficam em variáveis de ambiente (`EQUINOX_ACTIVE_V2_CANARY_HMAC_SECRETS`, `EQUINOX_ACTIVE_V2_CANARY_SUBJECT_ALLOWLIST`). Guardar material de segredo dentro de uma coleção Mongo ao lado de dados operacionais é um padrão a evitar; em produção real isso deveria vir de um secrets manager dedicado (Render secret files ou equivalente), não deste código.

## 5. CLIs de teste manual

- `signActiveV2InternalCanaryRequest.ts` — gera os 4 headers válidos (e um comando `curl` pronto) a partir de um segredo local ou do primeiro segredo ativo em env. Testado ao vivo nesta sessão.
- `checkActiveV2InternalCanaryAuth.ts` — valida headers fornecidos contra o Mongo real.

## 6. Limitações assumidas

- **Nenhuma integração HTTP real.** Não existe middleware Express lendo esses headers de requisições reais — o validador é uma função pronta para ser chamada por um middleware quando o runtime V2 existir. O resolver de precedência da Fase 4 já espera exatamente este booleano (`isAuthorizedInternalCanaryRequest`).
- **Nenhuma escrita real no Atlas.** Mesma limitação de todas as fases anteriores — sem `MONGO_URI` configurado neste ambiente, tudo validado com conexões mockadas.
- **Rate limiter tem uma pequena janela de corrida** entre o incremento e a leitura da contagem (documentado no próprio código) — aceitável porque não é o controle de segurança primário (esse é assinatura + allowlist), apenas defesa em profundidade.

## 7. Suíte offline

`npm run sets:active-v2-internal-canary:offline:check` — 6 validadores. Combinado com as suítes anteriores: **23 testes offline** (Fase 2A + Circuit Breaker + Canary Infrastructure + Canário Interno), todos passando, typecheck limpo, zero regressão.
