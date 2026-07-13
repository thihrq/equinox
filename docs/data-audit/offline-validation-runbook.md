# Equinox Offline Competitive Data Runbook

## Auditoria Local

```powershell
$env:EQUINOX_DATA_MODE="filesystem"
$env:EQUINOX_ALLOW_DATABASE_WRITES="false"
$env:MONGODB_URI="mongodb://127.0.0.1:27099/equinox-blocked"
npm run preflight
```

## Importacao Dry-Run

```powershell
npm run sets:import:dry -- --file .\src\equinox\data-packs\competitive\champions-reg-mb-doubles\sets.json
```

Use `--allow-empty` somente para pacote draft explicitamente vazio.

## Lote Vazio

```powershell
npm run sets:import:dry -- --file .\src\equinox\data-packs\fixtures\empty-sets.json
```

Resultado esperado: falha controlada com `No competitive sets were loaded`.

```powershell
npm run sets:import:dry -- --file .\src\equinox\data-packs\fixtures\empty-sets.json --allow-empty
```

O uso de `--allow-empty` deve aparecer no relatorio.

## Migracao Dry-Run

```powershell
npm run sets:migrate:dry
```

## Shadow

```powershell
$env:EQUINOX_DATA_MODE="shadow"
$env:EQUINOX_ALLOW_DATABASE_WRITES="false"
npm run sets:shadow:compare
```

## Producao

Nao utilizar V2 em producao ate aprovacao formal dos sets e do staging.

## Pacote Piloto

O pacote `champions-reg-mb-doubles` esta `reviewed` e pronto apenas para staging. Os arquivos obrigatorios sao:

- `manifest.json`
- `regulation.json`
- `roster.json`
- `sets.json`
- `audit.json`

Promocao para `verified` ou `active` continua bloqueada e exige revisao humana em `docs/data-audit/pilot-curation-review.md`.

## Staging

Preflight sem MongoDB:

```powershell
$env:EQUINOX_DATA_MODE="filesystem"
$env:EQUINOX_ALLOW_DATABASE_WRITES="false"
npm run sets:publish:staging:dry
```

Staging deve usar colecao separada:

```powershell
$env:EQUINOX_DATA_MODE="mongo"
$env:EQUINOX_ALLOW_DATABASE_WRITES="true"
$env:EQUINOX_TARGET_COLLECTION="pokemonsets_v2_staging"
npm run sets:publish:staging
```

O comando bloqueia pacotes `draft` e tambem bloqueia registros `draft`, `quarantined` ou `deprecated`. Nunca publicar diretamente em `pokemonsets`.

Antes de executar o publish real, confirme:

- `MONGODB_URI` aponta para o ambiente correto.
- `EQUINOX_TARGET_COLLECTION` esta exatamente como `pokemonsets_v2_staging`.
- `npm run preflight` passou.
- `npm run sets:publish:staging:dry` passou com `[WRITES] 0`.

## Publicacao Futura

1. Rodar `npm run preflight`.
2. Publicar em `pokemonsets_v2_staging`.
3. Testar Team Builder contra staging.
4. Aprovar rollback.
5. Rodar `npm run sets:verified:readiness`.
6. Somente depois avaliar promocao para `verified`.
7. Somente depois de `verified`, avaliar promocao para producao.

## Verified Readiness

O gate abaixo nao promove registros. Ele confirma se a promocao `reviewed -> verified` continua bloqueada ou se todas as evidencias exigidas foram atendidas:

```powershell
npm run sets:verified:readiness
```

O estado esperado atual e bloqueado:

- `promotionReady: 0`
- `blocked: 9`
- nenhum registro `verified`
- nenhum registro `active`
- limitacoes humanas ainda abertas por set
- rollback evidence ainda pendente

Quando esse comando deixar de bloquear algum set, a curadoria humana deve atualizar `docs/data-audit/pilot-curation-review.md` antes de qualquer escrita em MongoDB.

## Rollback

1. Defina `EQUINOX_USE_COMPETITIVE_SETS_V2=false`.
2. Mantenha `EQUINOX_ALLOW_DATABASE_WRITES=false`.
3. Retorne o pacote versionado anterior.
4. Execute `npm run preflight`.
