# Verified Matchup Homologation Complete Design

## Goal

Complete the matchup-evidence phase for all 9 Champions M-B Doubles pilot sets without forcing unsupported promotion to `verified` or `active`.

## Approved Scope

The user approved option 3: homologate all 9 sets.

This means every pilot set must receive minimum matchup evidence, but `verified` eligibility remains controlled by the existing readiness rules. Matchup evidence alone is not enough to verify generated sets.

## Current State

- Pilot package: 9 reviewed sets.
- `verified`: 0.
- `active`: 0.
- `sets:verified:matchups` exists and currently fails because all sets have `approvedMatchupScenarios: []`.
- `sets:verified:readiness` passes while keeping promotion blocked.
- `sets:promote:verified:dry` reports 0 eligible, 9 blocked, 0 writes, 0 active writes.
- Production writes remain blocked.

## Non-Negotiable Constraints

- Do not write to MongoDB.
- Do not touch production collection `pokemonsets`.
- Do not promote any set to `active`.
- Do not remove the curated-source freshness blocker for generated sets.
- Do not lower readiness thresholds.
- Do not fake source freshness for generated sets.
- Keep ability, move, item, nature, and Pokemon names in canonical English.

## Homologation Model

Each set receives at least two approved matchup scenario IDs. A scenario ID represents a documented tactical test case, not a battle log claim.

A matchup scenario must record:

- `scenarioId`
- `label`
- `lead` or tested board state
- `opposingThreats`
- `validationGoal`
- `approvedForSets`
- `evidenceLevel`
- `reviewResult`
- `notes`

The minimum accepted `evidenceLevel` for this phase is `internal-scenario-review`. This is intentionally weaker than real ladder/tournament evidence and must not be treated as a complete generated-source freshness review.

## Data Design

Create a dedicated scenario fixture:

```text
src/equinox/data-packs/competitive/champions-reg-mb-doubles/verified-matchup-scenarios.fixture.json
```

Keep per-set references in:

```text
src/equinox/data-packs/competitive/champions-reg-mb-doubles/verified-evidence.fixture.json
```

The evidence fixture should reference scenario IDs only. The scenario fixture owns detailed tactical descriptions.

## Gate Behavior

`sets:verified:matchups` must pass only when:

- every set has at least two scenario IDs in `approvedMatchupScenarios`;
- every referenced scenario exists;
- every referenced scenario includes the set ID in `approvedForSets`;
- every referenced scenario has `reviewResult: "approved"`;
- every referenced scenario has accepted `evidenceLevel`;
- no scenario references unknown set IDs.

`sets:verified:readiness` must continue to evaluate full verified readiness separately.

Expected after this phase:

```text
sets:verified:matchups: pass
sets:verified:readiness: pass, but generated sets may remain blocked
sets:promote:verified:dry: no writes
activeWritten: 0
```

## Expected Eligibility Outcome

Curated sets may become closer to `verified` if their remaining blockers are resolved by scenario evidence and staging evidence.

Generated sets must still remain blocked unless they also satisfy curated-source freshness. The implementation must preserve this blocker even if matchup evidence is complete.

## Reporting

Create or update a report:

```text
docs/data-audit/verified-matchup-homologation-report.md
```

The report must summarize:

- all 9 sets;
- assigned scenario IDs;
- which sets remain blocked;
- why generated sets remain blocked if source freshness is incomplete;
- confirmation that `verified` and `active` were not promoted automatically;
- commands run and results.

## Testing

Required validation commands:

```powershell
npm.cmd run typecheck
npm.cmd run sets:verified:matchups
npm.cmd run sets:verified:readiness
npm.cmd run sets:promote:verified:dry
npm.cmd run sets:structure:check
npm.cmd run sets:legality:check
npm.cmd run sets:coherence:check
npm.cmd run build
git diff --check
```

The full `preflight` may remain unchanged unless the new matchup gate is stable and intended to run in the standard pipeline.

## Out of Scope

- MongoDB writes.
- Production deployment.
- Promotion to `active`.
- Removing generated provenance blockers.
- Claiming tournament-level evidence.
- Replacing the existing readiness gate.
