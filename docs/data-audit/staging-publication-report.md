# Competitive Data V2 Staging Publication

## Scope

Fase 5 prepares the reviewed Champions M-B Doubles pilot package for controlled staging publication.

This phase does not publish to production and does not promote any record to `verified` or `active`.

## Automated Gate

The command below validates the staging publish contract without opening a MongoDB connection:

```powershell
npm run sets:publish:staging:dry
```

It checks:

- target collection resolves to `pokemonsets_v2_staging`
- manifest `recordCount` matches `sets.json`
- manifest `reviewState` is `staging-ready`
- package is not `draft`
- no record is `draft`, `quarantined` or `deprecated`
- planned writes target staging only
- dry-run produces `[WRITES] 0`

## Real Staging Publish

The real publish remains an operator action because it requires the staging MongoDB URI:

```powershell
$env:EQUINOX_DATA_MODE="mongo"
$env:EQUINOX_ALLOW_DATABASE_WRITES="true"
$env:EQUINOX_TARGET_COLLECTION="pokemonsets_v2_staging"
npm run sets:publish:staging
```

## Required Evidence After Real Publish

Before moving to `verified`, record:

- staging publish log
- Team Builder result against staging
- rollback check with `EQUINOX_USE_COMPETITIVE_SETS_V2=false`
- confirmation that production collection `pokemonsets` was not written
- confirmation that all labels remain non-verified

## Resultado da publicação real

- Data: 2026-07-13
- Commit: fb34bf5
- Target collection: `pokemonsets_v2_staging`
- Registros planejados: 9
- Registros escritos: 9
- Registros rejeitados: 0
- Escritas em produção: 0
- Mongo conectado: sim
- Snapshot pré-publicação: concluído
- Snapshot pós-publicação: concluído
- Status final: staging publicado com sucesso
- Observação: URI, usuário e senha não foram registrados por segurança.

## Remaining Blockers

- No production publish.
- No `verified` promotion.
- No `active` promotion.
- No verified competitive label.
