# Pipeline de staging real contra o Atlas de produção — 2026-07-16

**Status:** Executado de verdade contra o cluster Atlas de produção real (banco `test`, confirmado pelo responsável do projeto como o mesmo usado pelo Render). Primeira vez que a pipeline de staging (`publish:staging` → `promote:verified` → `activate:staging`) roda contra Atlas real nesta branch — as execuções anteriores desta sessão foram todas contra MongoDB local (`mongodb-memory-server`).

## 1. Estado encontrado antes de qualquer escrita

Inspeção read-only (`pokemonsets_v2_staging`) revelou 9 documentos já existentes, de uma promoção real anterior a esta sessão (`activeRunId: active-staging-2026-07-14T12-20-30-421Z`, `verifiedRunId: verified-staging-2026-07-14T01-53-21-201Z`) — exatamente o pacote piloto original (4 ativos + 5 bloqueados). `pokemonsets` (legada) e `pokemonsets_v2`/`publication_manifests` (produção V2) estavam vazias/inexistentes.

## 2. Verificação de segurança antes de escrever

Antes de qualquer escrita real, confirmamos:
- O `dataVersion` do pacote atual (`2026.07.1`) bate com o dos 9 documentos existentes — o `upsert` por `{setId, dataVersion}` em `publishCompetitiveSetsStaging.ts` atualizaria os existentes em vez de duplicar.
- `publishCompetitiveSetsStaging.ts` usa `replaceOne` (substitui o documento inteiro) — isso é seguro porque `setKey`/`active`/`activeRunId`/`verifiedRunId` são recalculados do zero pelas etapas seguintes da pipeline (`promoteReviewedSetsToVerified.ts`, `promoteVerifiedSetsToActive.ts`), não fazem parte do arquivo fonte estático.
- `VERIFIED_STAGING_PROMOTION_ALLOWLIST` está hardcoded com só os 4 setIds originais — os 5 sets novos desta sessão (Suicune, Pelipper, Hydreigon, Indeedee-F, Giratina-O) e os 5 recurados permaneceriam em `reviewed`, não promovidos. Isso é o estado pretendido (decisão já tomada em fase anterior desta sessão: "precisam de nova avaliação competitiva antes de promoção"), não um bug.

## 3. Execução real (3 comandos, cada um com dry-run antes)

| Etapa | Comando real | Resultado |
|---|---|---|
| 1. Publish staging | `sets:publish:staging` | 14 registros escritos (9 atualizados, 5 novos inseridos), 0 escritas em produção legada |
| 2. Promote verified | `promoteReviewedSetsToVerified.ts --execute` | 4/4 elegíveis promovidos para `verified`, hash de conteúdo inalterado (são os 4 originais, sem mudança de curadoria) |
| 3. Activate staging | `promoteVerifiedSetsToActive.ts --execute` | 4/4 promovidos para `active=true`, novo `activeRunId: active-staging-2026-07-16T23-41-34-037Z`, 0 conflitos, 0 duplicatas |

Cada etapa real foi precedida do dry-run correspondente e de confirmação explícita antes de `EQUINOX_ALLOW_DATABASE_WRITES` ser ligado — a flag foi religada para `false` imediatamente após cada escrita.

## 4. Estado final confirmado (leitura pós-execução)

14 documentos em `pokemonsets_v2_staging`:
- 4 `active=true` com `activeRunId=active-staging-2026-07-16T23-41-34-037Z` (os 4 originais: Sinistcha bulky Trick Room, Aggron-Mega physical breaker, Incineroar bulky pivot, Ursaluna-Bloodmoon special breaker).
- 10 `reviewed` (os 5 recurados + os 5 novos desta sessão), aguardando decisão de promoção futura.

`pokemonsets` (legada): continua com 0 documentos, intocada. `pokemonsets_v2`/`publication_manifests`: ainda não existem — a Fase 1 de Publicação em Produção propriamente dita ainda não rodou de verdade.

## 5. Problema de ambiente encontrado e contornado

O resolver DNS padrão deste ambiente falha em consultas SRV (necessárias para `mongodb+srv://`) com `ECONNREFUSED`, provavelmente por interferência do Cloudflare WARP. Contornado forçando `8.8.8.8` como servidor DNS via `dns.setServers()` (scripts diretos) ou um preload `NODE_OPTIONS=--require` (scripts npm existentes, que não podiam ser editados para isso). Não é um problema do Atlas nem do código do projeto — é específico deste ambiente de execução.

## 6. O que isso não prova

- Nada sobre o comportamento da Fase 1 de Publicação em Produção em si (`pokemonsets_v2`/`publication_manifests`) — ainda não executada contra o Atlas real.
- Nada sobre os 10 sets `reviewed` que não foram promovidos — essa decisão de curadoria segue em aberto.
