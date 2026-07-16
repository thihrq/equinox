# Kit de validação local contra MongoDB real

Estes scripts sobem um MongoDB **real** local (via `mongodb-memory-server`,
replica set de 1 nó — necessário para suportar as transações usadas nos
scripts de publicação/rollback) e rodam os comandos do pipeline Active V2
contra ele de verdade, em vez de conexões mockadas. Não é Atlas — sem
latência de rede real, sem os limites de recursos do plano do Atlas, sem o
backup/restore nativo do Atlas — mas exercita o código real (schema do
Mongoose, transações, índices, escrita/leitura real) de um jeito que testes
offline com conexão mockada nunca conseguem.

## Uso

```bash
# 1. Sobe o Mongo local em background (mantém rodando até você matar o processo)
npm run local-mongo:start
# Aguarde a linha "[local-mongo] ready. URI: mongodb://127.0.0.1:PORTA/?replicaSet=testset"

# 2. Em outro terminal, exporte a URI (ajuste a porta impressa acima)
export MONGO_URI="mongodb://127.0.0.1:PORTA/pokemon_teambuilder?replicaSet=testset"
export EQUINOX_DATA_MODE=mongo

# 3. Cria os índices reais exigidos por pokemonsets_v2/publication_manifests
#    (nenhum script do pipeline principal cria esses índices — só verifica
#    que existem — então isso precisa rodar manualmente antes da primeira
#    publicação real, seja aqui ou em produção)
npm run local-mongo:create-indexes

# 4. Restore drill real (adendo 3.7) — snapshot/restore em nível de aplicação
#    via driver, já que mongodump/mongorestore não estão disponíveis neste
#    ambiente. A validação (contagens/índices/digests) é a mesma que rodaria
#    contra um dump físico.
npm run local-mongo:restore-drill

# 5. Daqui em diante, qualquer comando do runbook
#    (docs/operations/active-v2-production-runbook.md) funciona contra este
#    Mongo real, bastando as flags de ambiente de cada comando.
```

`local-mongo-env.sh` tem um exemplo pronto das flags mais comuns —
`source scripts-local/local-mongo-env.sh` depois de ajustar a porta.

## O que já foi validado com este kit (2026-07-16)

Ver `docs/data-audit/active-v2-local-mongo-validation-v1-report.md` para o
relatório completo: o pipeline de staging real (import → verified → active),
o restore drill, o ciclo completo da Fase 1 (preflight, dry-run, publish,
idempotência, rollback, republicação), e as Fases 2/2A/3/4B/4/5 rodaram de
verdade contra este Mongo local — não apenas mockado. Isso revelou e
corrigiu 4 bugs reais que nenhum teste offline (conexão mockada) jamais
teria pego.

## O que isso não substitui

- Teste de capacidade/carga real (Fase 4A) — precisa de latência de rede e
  limites de recursos reais do Atlas.
- O restore drill oficial usando `mongodump`/`mongorestore` (Database
  Tools do MongoDB) contra um snapshot real do Atlas — este kit reproduz a
  mesma validação em nível de aplicação, não com os binários físicos.
- O Atlas de produção em si.
