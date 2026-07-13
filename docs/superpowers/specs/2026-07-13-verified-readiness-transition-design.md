# Verified Readiness Transition Design

## Goal

Move the Champions M-B Doubles pilot package from full matchup homologation into a controlled verified-readiness transition, allowing only eligible curated records to become promotion-ready in dry-run while keeping generated records, `active`, MongoDB writes, and production writes blocked.

## Approved Scope

The user approved starting the next phase after matchup evidence reached 9/9.

This phase does not publish data and does not activate V2 records. It changes readiness evaluation from a hard-coded "all blocked" gate into a controlled eligibility gate that can identify curated records ready for verified promotion.

## Current State

- Branch: `develop`.
- Latest merged phase: verified matchup homologation.
- Pilot package: 9 reviewed sets.
- Matchup evidence: 9/9.
- `verified`: 0.
- `active`: 0.
- `sets:verified:readiness` currently asserts `promotionReady.length === 0` and `blocked.length === records.length`.
- `sets:promote:verified:dry` currently prints static counts: `recordsEligible: 0`, `recordsBlocked: 9`, `recordsWritten: 0`, `activeWritten: 0`.

## Non-Negotiable Constraints

- Do not write to MongoDB.
- Do not touch production collection `pokemonsets`.
- Do not promote any set to `active`.
- Do not commit any real MongoDB URI, username, password, token, or secret.
- Do not remove the curated-source freshness blocker for generated sets.
- Do not lower confidence or coherence thresholds.
- Do not fake source freshness for generated sets.
- Keep ability, move, item, nature, and Pokemon names in canonical English.
- Keep generated records blocked unless future curated-source evidence is explicitly added in a separate approved phase.

## Eligibility Policy

A record can be considered `promotionReady` for verified dry-run only when all conditions are true:

- `status === "reviewed"`;
- `sourceType === "curated"`;
- `sourceUpdatedAt` exists;
- `matchupTesting === "approved"`;
- `sourceFreshnessReview === "approved"`;
- `shadowReview === "approved"`;
- `stagingReview === "approved"`;
- `exportParityReview === "approved"`;
- `rollbackEvidence === "approved"`;
- `limitationsResolved === true`;
- `confidence >= 80`;
- `coherenceScore >= 85`.

Generated records must remain blocked even if they have matchup evidence. Their blockers must still include curated source freshness and confidence/coherence failures where applicable.

## Target Pilot Outcome

This phase may resolve staging and limitations for curated records only.

Expected curated records that can become ready if evidence is updated:

- `sinistcha-bulky-trick-room-setter-draft`
- `aggronmega-slow-physical-breaker-draft`
- `incineroar-bulky-slow-pivot-draft`
- `ursalunabloodmoon-slow-special-breaker-draft`

`sinistcha-redirection-support-draft` is curated but remains below the verified confidence/coherence threshold and should stay blocked unless its scores are raised by a separate explicit curation decision. This phase should not raise scores.

Generated records remain blocked:

- `aggronmega-body-press-defensive-attacker-draft`
- `incineroar-fast-taunt-pivot-draft`
- `togekiss-bulky-redirection-support-draft`
- `mukalola-special-wall-draft`

## Readiness Gate Behavior

`sets:verified:readiness` must stop asserting that all records are blocked. Instead it must assert:

- all records remain `reviewed`;
- no record is `verified`;
- no record is `active`;
- `activeCount === 0`;
- generated records are blocked;
- `promotionReady` contains only curated records that satisfy the eligibility policy;
- every promotion-ready record has zero blockers;
- every blocked record has at least one blocker;
- readiness output reports aggregate counts.

The script should remain read-only and must not mutate fixture or set data.

## Dry-Run Promotion Behavior

`sets:promote:verified:dry` must become data-driven instead of static.

It must read the same pilot sets and verified evidence fixture, apply the same eligibility policy, and print:

```text
recordsEligible: <promotionReady count>
recordsBlocked: <blocked count>
recordsWritten: 0
activeWritten: 0
```

It must continue to throw without `--dry-run`.

It must not import MongoDB clients, connect to MongoDB, or write files.

## Evidence Updates

Only curated records selected for readiness may have these fields updated:

```json
"stagingReview": "approved",
"limitationsResolved": true
```

Their `notes` should be rewritten from an unresolved limitation into a concise resolved-review note.

Do not change `status` to `verified`.
Do not change any set in `sets.json` to `verified` or `active`.
Do not change generated records to curated.
Do not raise confidence or coherence scores in this phase.

## Reporting

Create or update:

```text
docs/data-audit/verified-readiness-transition-report.md
```

The report must include:

- number of reviewed records;
- number of matchup-homologated records;
- number of promotion-ready records;
- number of blocked records;
- list of ready curated records;
- list of blocked generated records and their reasons;
- confirmation that `verified` remains 0;
- confirmation that `active` remains 0;
- confirmation that MongoDB writes and production writes remain 0;
- commands run and results.

## Required Validation

Run these commands after implementation:

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

Expected final properties:

```text
Matchup evidence: 9/9
Promotion-ready records: curated only
Generated records: blocked
Verified records: 0
Active records: 0
recordsWritten: 0
activeWritten: 0
MongoDB writes: 0
Production writes: 0
```

## Out of Scope

- MongoDB staging writes.
- Production writes.
- Promotion to `active`.
- Committing actual `verified` status to set data.
- Resolving generated-source freshness.
- Raising confidence/coherence scores.
- Replacing the verified-readiness policy with a looser gate.
