# Equinox Competitive Data Baseline - 2026-07

This document records the baseline process before the competitive data contract migration.

Generated artifacts:

- `data-audit/snapshots/2026-07-current-state.json`
- `data-audit/reports/`

Current known constraints:

- Legacy `sets-data-pack.json` remains a fallback source until curated versioned packs replace it.
- MongoDB export must be executed by an operator with database credentials and `mongoexport` available.
- No script in this audit writes to the active production collection by default.

Required operator exports:

```powershell
mongoexport --collection=pokemonsets --out=pokemonsets-backup.json
mongoexport --collection=pokemons --out=pokemons-backup.json
```

Store those backups outside the production application folder before publishing any V2 data.
