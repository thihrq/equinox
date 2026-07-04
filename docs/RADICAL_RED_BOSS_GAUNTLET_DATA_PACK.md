# Radical Red Boss Gauntlet Data Pack

## Scope

This data pack makes Radical Red recommendations use scenario-aware boss data instead of generic metagame assumptions.

Current scope:

- Game: Pokémon Radical Red
- Version: 4.1
- Mode: Hardcore / Restricted Mode
- Segment: Indigo League
- Bosses: Lorelei, Bruno, Agatha, Lance, Champion/Rival
- Data pack id: `radicalred_4_1_hardcore_indigo_league`
- Data version: `rr-4.1-hardcore-indigo-v1`

Normal Mode is intentionally not used for team-builder scoring. It is still difficult, but the Equinox builder value is highest for Hardcore / Restricted Mode, where the player needs scenario-specific planning for the Elite 4 + Champion gauntlet.

## Official documentation directory

Radical Red maintains a shared Google Drive documentation directory for project docs, boss team sheets, calculators, and changelogs. Treat that directory as the canonical entry point for updating future data packs, while each imported pack should still record the exact sheet/file, version, mode, timestamp, and hash used for the snapshot.

Canonical directory reference:

```txt
Radical Red Docs — Google Drive folder
https://drive.google.com/drive/folders/1YaYM-8dzRlBRuJm1bmYrjJC6HGwTwl-x
```

Current boss data source:

```txt
Restricted/Hardcore Mode Info & Hardcore Bosses v4.1 - Radical Red
https://docs.google.com/spreadsheets/d/1jDbKFA30xo8csPHZNLtsmqs781bW_Xb9mKoPYyE6KK8/edit?usp=drive_link
```

## Data source policy

The engine is designed so Radical Red data can be updated without rewriting the scoring logic.

Recommended update flow:

1. Collect boss trainer data from the active Radical Red official Drive documentation.
2. Normalize Pokémon names, forms, items, abilities, moves, battle effects, and team variants.
3. Validate that every boss has valid variants and that every variant has Pokémon entries.
4. Update or add a new `RadicalRedDataPack` file.
5. Change the profile metadata in `FormatIntelligenceRegistry`.
6. Run backend and frontend type checks.

## Why this exists

Radical Red is not a ladder metagame. It is a scenario/boss gauntlet context where the quality of a team depends on whether it can survive the actual programmed boss sequence.

The engine therefore optimizes around:

- worst boss matchup;
- average boss performance;
- critical boss threats;
- variant consistency;
- preserved answers across the whole gauntlet;
- data freshness warnings.

## Runtime behavior

When the selected format resolves to `radical_red`, the pipeline runs:

```txt
FormatIntelligenceEngine
  ↓
RadicalRedBossGauntletEngine
  ↓
MetaEngine / ThreatEngine / DamageEngine / Coach / AIBuilder
```

The recommendation payload receives `radicalRedGauntlet`, which powers the frontend panel:

```txt
Radical Red Gauntlet
- average gauntlet score
- worst boss
- consistency score
- boss cards
- critical boss threats
- required actions
```

## Versioning

The current data pack is marked as `verified` because it is aligned to the official Radical Red 4.1 Restricted/Hardcore boss documentation entry. It must still be revalidated when the romhack receives a public update, because boss teams and restrictions can change between versions.
