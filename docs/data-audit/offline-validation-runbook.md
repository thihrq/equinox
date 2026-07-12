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

O pacote `champions-reg-mb-doubles` permanece `draft`. Os arquivos obrigatorios sao:

- `manifest.json`
- `regulation.json`
- `roster.json`
- `sets.json`
- `audit.json`

Promocao de status exige revisao humana em `docs/data-audit/pilot-curation-review.md`.

## Staging

Staging deve usar colecao separada:

```powershell
$env:EQUINOX_DATA_MODE="mongo"
$env:EQUINOX_ALLOW_DATABASE_WRITES="true"
$env:EQUINOX_TARGET_COLLECTION="pokemonsets_v2_staging"
npm run sets:publish:staging
```

O comando bloqueia pacotes `draft`; ele so deve ser usado depois de `reviewed` ou superior. Nunca publicar diretamente em `pokemonsets`.

## Publicacao Futura

1. Completar revisao humana.
2. Promover `draft` para `reviewed`.
3. Rodar `npm run preflight`.
4. Publicar em `pokemonsets_v2_staging`.
5. Testar Team Builder contra staging.
6. Aprovar rollback.
7. Somente depois avaliar promocao para producao.

## Rollback

1. Defina `EQUINOX_USE_COMPETITIVE_SETS_V2=false`.
2. Mantenha `EQUINOX_ALLOW_DATABASE_WRITES=false`.
3. Retorne o pacote versionado anterior.
4. Execute `npm run preflight`.
