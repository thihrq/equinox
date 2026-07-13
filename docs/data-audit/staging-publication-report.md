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

## Resultado da publicacao real

- Data: 2026-07-13
- Commit: fb34bf5
- Target collection: `pokemonsets_v2_staging`
- Registros planejados: 9
- Registros escritos: 9
- Registros rejeitados: 0
- Escritas em producao: 0
- Mongo conectado: sim
- Snapshot pre-publicacao: concluido
- Snapshot pos-publicacao: concluido
- Status final: staging publicado com sucesso
- Observacao: URI, usuario e senha nao foram registrados por seguranca.

## Functional Staging Homologation

After the real staging publish, run the read-only homologation gate against the staging collection:

```powershell
$env:EQUINOX_DATA_MODE="mongo"
$env:EQUINOX_ALLOW_DATABASE_WRITES="false"
$env:EQUINOX_TARGET_COLLECTION="pokemonsets_v2_staging"
$env:EQUINOX_USE_COMPETITIVE_SETS_V2="true"
npm run sets:staging:homologate
```

The command must prove:

- target collection is exactly `pokemonsets_v2_staging`
- Mongo writes remain disabled
- staging contains exactly 9 records
- `reviewed: 9`
- `draft: 0`
- `quarantined: 0`
- `deprecated: 0`
- `verified: 0`
- `active: 0`
- all records use `regulationId=champions_reg_m_b_doubles`
- all records use `battleStyle=doubles`
- no record has `legal=false`
- no homologation scenario consumes draft data
- no reviewed-only team receives the verified competitive label
- export, legality and role mismatch rates remain 0

For CI or local validation without Mongo credentials, use the fixture-only equivalent:

```powershell
npm run sets:staging:homologate:fixture
```

## Remaining Blockers

- No production publish.
- No `verified` promotion.
- No `active` promotion.
- No verified competitive label.
