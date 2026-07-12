# Competitive Data V2 Shadow Homologation

## Scope

This report records Phase 3 shadow homologation for the Champions M-B Doubles pilot package.

The validation is offline and read-only:

- `EQUINOX_DATA_MODE=filesystem`
- `EQUINOX_ALLOW_DATABASE_WRITES=false`
- no MongoDB reads
- no MongoDB writes
- no staging publish
- no production activation

## Homologation Matrix

The script `npm run sets:shadow:homologate` validates these cases:

| Case | Lead | Validation goal |
| --- | --- | --- |
| Sinistcha + Aggron-Mega | `Sinistcha` + `Aggron-Mega` | Main Trick Room pilot case with four reviewed V2 sets and two fallbacks. |
| Indeedee-F + Hatterene | `Indeedee-F` + `Hatterene` | Psychic Terrain and Trick Room case with partial V2 support. |
| Pelipper + Basculegion | `Pelipper` + `Basculegion` | Rain tempo case with partial V2 support. |
| Torkoal + Lilligant | `Torkoal` + `Lilligant` | Sun mode with secondary slow-room support. |
| Rillaboom + physical attacker | `Rillaboom` + `Aggron-Mega` | Terrain support for a physical win condition. |
| Fast Tailwind lead | `Tornadus` + `Incineroar` | Tailwind tempo with slower backup breakers. |
| Defensive redirection lead | `Sinistcha` + `Ursaluna-Bloodmoon` | Redirection support protecting a slow special breaker. |

## Metrics

For each case, the script records:

- V2 preference rate
- manual-review rate
- fallback rate
- verified coverage
- coherence average
- legality failure rate
- role mismatch rate
- export mismatch rate
- raw strategic score
- data confidence
- confidence cap
- final competitive score
- quartet
- win condition

## Acceptance Rules

The homologation script fails if any case violates these rules:

- legality failure rate must be `0`
- role mismatch rate must be `0`
- export mismatch rate must be `0`
- teams with reviewed-only data cannot receive a verified competitive label
- teams with three or more generated fallbacks must cap final confidence at `65`
- teams with fewer than four verified sets must cap data confidence at `70`

## Export Parity

Showdown, plain text and JSON exports are generated from the same `CompetitivePokemonSet` objects used by the team result. The script checks item, ability, nature and moves across all export formats.

## Current Gate Result

Phase 3 approved the package for shadow validation only. Fase 4 later completed reviewed-set curation for staging readiness.

The following gates remain blocked:

- production activation
- promotion to `verified`
- promotion to `active`
- verified competitive label

The main reason is expected: the pilot has reviewed records only, zero `verified` sets and zero `active` sets.
