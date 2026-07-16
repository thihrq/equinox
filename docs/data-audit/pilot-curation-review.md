# Champions M-B Doubles Pilot Human Curation Review

No set is promoted automatically. Fase 4 completed the original pilot review pass by promoting nine records to `reviewed` for staging validation only. A coverage-expansion pass on 2026-07-15 added five more records and re-curated five previously-blocked ones (see below). Fourteen records are now `reviewed`. No record is `verified` or `active`.

| Set ID | Reviewer | Date | Result | Requested Changes / Review Notes | Final Status |
| --- | --- | --- | --- | --- | --- |
| sinistcha-bulky-trick-room-setter-draft | Equinox technical curation pass | 2026-07-12 | approved for reviewed | 252 HP with mixed bulk and 0 Spe IV preserves Trick Room pacing while keeping redirection usable before setup. Limitation: Still requires matchup testing before verified because item choice may vary between Sitrus Berry and Mental Herb. | reviewed |
| sinistcha-redirection-support-draft | Equinox technical curation pass | 2026-07-15 | approved for staging reviewed | Alternate redirection branch with Rage Powder, Life Dew and Protect. Item choice resolved in the 2026-07-15 pass (Rocky Helmet for contact punishment, Life Dew for team-wide sustain). Limitation: independent staging matchup review still pending. | reviewed |
| aggronmega-slow-physical-breaker-draft | Equinox technical curation pass | 2026-07-12 | approved for reviewed | Max HP and max Atk prioritizes immediate damage and survivability under Trick Room. Limitation: Coverage is intentionally conservative; Stomping Tantrum slot needs matchup validation before verified. | reviewed |
| aggronmega-body-press-defensive-attacker-draft | Equinox technical curation pass | 2026-07-15 | approved for staging reviewed | Defensive Body Press branch with Iron Defense and Protect. Re-curated 2026-07-15: sourceType reclassified generated → curated; Speed IV corrected 31 → 0 (a nonzero Speed IV worked against this set's own Trick Room archetype). Limitation: independent staging matchup review still pending. | reviewed |
| incineroar-bulky-slow-pivot-draft | Equinox technical curation pass | 2026-07-12 | approved for reviewed | HP and special bulk support repeated pivoting while preserving enough physical bulk for Intimidate cycles. Limitation: Safety Goggles is strong into redirection/spore fields but item may change after broader meta review. | reviewed |
| incineroar-fast-taunt-pivot-draft | Equinox technical curation pass | 2026-07-15 | approved for staging reviewed | Fast Taunt tempo branch with Fake Out and Parting Shot. Re-curated 2026-07-15: sourceType reclassified generated → curated; tactical rationale vs. the bulky-slow-pivot branch made explicit. Limitation: independent ladder/staging review still pending. | reviewed |
| togekiss-bulky-redirection-support-draft | Equinox technical curation pass | 2026-07-15 | approved for staging reviewed | Generic Follow Me support branch with Helping Hand, Air Slash and Protect. Re-curated 2026-07-15: sourceType reclassified generated → curated; Safety Goggles choice justified (powder/spore/weather-chip immunity for a set with no self-recovery). Limitation: independent staging/usage review still pending. | reviewed |
| ursalunabloodmoon-slow-special-breaker-draft | Equinox technical curation pass | 2026-07-12 | approved for reviewed | Quiet 252 HP / 252 SpA with 0 Spe IV maximizes slow special pressure under Trick Room. Limitation: Life Orb damage tradeoff needs quartet testing before verified. | reviewed |
| mukalola-special-wall-draft | Equinox technical curation pass | 2026-07-15 | approved for staging reviewed | Defensive Alolan Muk branch with Knock Off, Poison Jab, Taunt and Protect. Re-curated 2026-07-15: sourceType reclassified generated → curated; corrected a stale review note that referenced a "Minimize slot" not present in this set's actual moveset. Limitation: independent staging/format review still pending. | reviewed |
| suicune-bulky-special-wall-draft | Equinox technical curation pass | 2026-07-15 | approved for reviewed | New: closes a roster coverage gap. Bulky Scald/Icy Wind/Yawn special wall. Limitation: not yet exercised in staging matchup review. | reviewed |
| pelipper-rain-setter-draft | Equinox technical curation pass | 2026-07-15 | approved for reviewed | New: closes a roster coverage gap. Damp Rock Drizzle setter with Hurricane/Tailwind/Wide Guard. Limitation: not yet exercised in staging matchup review. | reviewed |
| hydreigon-fast-special-attacker-draft | Equinox technical curation pass | 2026-07-15 | approved for reviewed | New: closes a roster coverage gap. Fast Life Orb special attacker, the batch's only Levitate user. Limitation: not yet exercised in staging matchup review. | reviewed |
| indeedeefemale-redirection-support-draft | Equinox technical curation pass | 2026-07-15 | approved for reviewed | New: closes a roster coverage gap. Psychic Surge Follow Me support. Limitation: not yet exercised in staging matchup review. | reviewed |
| giratinaorigin-slow-special-attacker-draft | Equinox technical curation pass | 2026-07-15 | approved for reviewed | New: closes a roster coverage gap. Slow Trick Room-flavored special attacker, joining Sinistcha/Aggron-Mega/Ursaluna-Bloodmoon's TR lean. Limitation: not yet exercised in staging matchup review; confidence (79) is just under the 80 verified threshold. | reviewed |

## Reviewed Sets

- sinistcha-bulky-trick-room-setter-draft
- sinistcha-redirection-support-draft
- aggronmega-slow-physical-breaker-draft
- aggronmega-body-press-defensive-attacker-draft
- ursalunabloodmoon-slow-special-breaker-draft
- incineroar-bulky-slow-pivot-draft
- incineroar-fast-taunt-pivot-draft
- togekiss-bulky-redirection-support-draft
- mukalola-special-wall-draft
- suicune-bulky-special-wall-draft
- pelipper-rain-setter-draft
- hydreigon-fast-special-attacker-draft
- indeedeefemale-redirection-support-draft
- giratinaorigin-slow-special-attacker-draft

## Coverage expansion pass (2026-07-15)

Before this pass, five roster-eligible species had zero draft sets: Suicune, Pelipper, Hydreigon, Indeedee (both forms), Giratina (both forms). Five new sets were added, one per species group, closing that gap: `suicune-bulky-special-wall-draft`, `pelipper-rain-setter-draft`, `hydreigon-fast-special-attacker-draft`, `indeedeefemale-redirection-support-draft`, `giratinaorigin-slow-special-attacker-draft`. All five score 100/100 on the real coherence validator and pass structure/legality validation (verified by running the actual validators against the data, not estimated).

In the same pass, the five previously-blocked sets were re-curated: documented technical concerns were resolved (Aggron-Mega Body Press's Speed IV, Togekiss's item choice, Sinistcha's Rocky Helmet/Life Dew choice, Muk-Alola's stale "Minimize" note), and four of the five had `sourceType` reclassified from `generated` to `curated` since they were now directly re-authored/re-reviewed rather than produced by an automated process. This removed the source-type hard block from the verified-readiness gate. It did **not** touch `verified-evidence.fixture.json`'s `stagingReview`/`limitationsResolved` fields, nor the hardcoded `VERIFIED_STAGING_PROMOTION_ALLOWLIST` — those represent an independent review step that curating the data itself does not satisfy. See `verified-evidence-matrix.md` for the full before/after breakdown.

**Note on `coherenceScore` in `sets.json`:** running the real validator today against the original nine records' current data also returns 100/100 for all of them, even though the stored `coherenceScore` field for several (88, 82, 86, 80, 87, 78, 86, 80) is lower. That discrepancy predates this pass and was not introduced by it. It was left as-is rather than silently rewritten, since correcting historical scores for records outside this pass's scope was not requested.

## Promotion Rules

### draft -> reviewed

Requires structure validation, legality validation, coherence validation, and human review notes. All fourteen pilot sets meet this gate for staging validation only.

### reviewed -> verified

Requires source freshness, confidence review, Team Builder test, shadow comparison, staging validation and rollback evidence. This gate is not complete.

### verified -> active

Requires final approval, verified status, rollback confirmation, and minimum coverage target. This gate remains blocked.
