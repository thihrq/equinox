# Sprint 18 — Format Intelligence Layer

The Format Intelligence Layer separates battle contexts that should not be scored by the same assumptions.

## Format families

| Format | Intelligence mode | Strategy |
| --- | --- | --- |
| Vanilla | Generic Balance | Broad synergy and baseline singles threats |
| National Dex | Meta Ladder | Expanded ladder threats and form pressure |
| Radical Red | Boss Gauntlet | Elite Four + Champion progression, worst-matchup safety, resource preservation |
| Pokémon Champions Singles | Live Regulation | Season/regulation-aware singles bootstrap |
| Pokémon Champions Doubles | Live Regulation | Season/regulation-aware doubles bootstrap |

## Why this exists

Radical Red should not be treated as a generic competitive metagame. It is a boss gauntlet, so recommendations must eventually optimize for known boss teams, variants, and the worst matchup in the Elite Four + Champion sequence.

Pokémon Champions should not be treated as Vanilla either. It is a live competitive environment, so the correct long-term model is a regulation profile that can change with season data, allowed Pokémon, items, and mechanics.

## Data policy

The engine is ready for external data packs, but Sprint 18 intentionally keeps Radical Red and Pokémon Champions as transparent bootstrap profiles until verified versioned data is loaded.

A format profile must expose:

- data status: verified, community, outdated, or unknown
- data version
- source name
- warning when the recommendation is only a bootstrap/fallback
- engine strategy used by Equinox

## Next implementation targets

1. Radical Red Boss Gauntlet data pack
2. Radical Red Elite Four + Champion report UI
3. Pokémon Champions regulation profile importer
4. Champions Singles and Doubles dedicated scoring rules
