# Verified Matchup Homologation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete minimum matchup-evidence homologation for all 9 Champions M-B Doubles pilot sets while keeping `verified`, `active`, MongoDB writes, and production writes blocked.

**Architecture:** Add a dedicated matchup-scenario fixture and make the matchup gate validate scenario integrity instead of only counting string IDs. The per-set evidence fixture references scenario IDs and may mark matchup testing as approved, while the readiness gate continues to keep all reviewed sets blocked through staging/limitation/source-freshness rules. Reporting records what was homologated and what remains blocked.

**Tech Stack:** TypeScript, ts-node scripts, JSON fixtures, npm script gates, existing Equinox competitive data validators.

## Global Constraints

- Do not write to MongoDB.
- Do not touch production collection `pokemonsets`.
- Do not promote any set to `active`.
- Do not remove the curated-source freshness blocker for generated sets.
- Do not lower readiness thresholds.
- Do not fake source freshness for generated sets.
- Keep ability, move, item, nature, and Pokemon names in canonical English.
- Keep `sets:verified:readiness` passing with `promotionReady: 0` and `blocked: 9` in this phase.
- Keep `sets:promote:verified:dry` reporting `recordsEligible: 0`, `recordsBlocked: 9`, `recordsWritten: 0`, and `activeWritten: 0`.

---

### Task 1: Add Matchup Scenario Fixture

**Files:**
- Create: `src/equinox/data-packs/competitive/champions-reg-mb-doubles/verified-matchup-scenarios.fixture.json`
- Read: `src/equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json`

**Interfaces:**
- Consumes: current set IDs from the pilot package.
- Produces: scenario records referenced later by `verified-evidence.fixture.json`.

- [ ] **Step 1: Create scenario fixture with approved internal scenarios**

Create `src/equinox/data-packs/competitive/champions-reg-mb-doubles/verified-matchup-scenarios.fixture.json` with this shape:

```json
{
  "formatId": "champions_reg_m_b_doubles",
  "acceptedEvidenceLevels": ["internal-scenario-review"],
  "scenarios": [
    {
      "scenarioId": "sinistcha-tr-room-redirect-vs-fast-offense",
      "label": "Sinistcha Trick Room redirection into fast offense",
      "lead": ["Sinistcha", "Aggron-Mega"],
      "opposingThreats": ["Tornadus", "Urshifu-Rapid-Strike", "Flutter Mane"],
      "validationGoal": "Validate that Trick Room plus Rage Powder gives slow attackers a safe first tempo line into fast pressure.",
      "approvedForSets": ["sinistcha-bulky-trick-room-setter-draft", "aggronmega-slow-physical-breaker-draft"],
      "evidenceLevel": "internal-scenario-review",
      "reviewResult": "approved",
      "notes": "Approved as internal tactical evidence only; not ladder or tournament proof."
    }
  ]
}
```

Add enough scenarios so every one of these set IDs appears in at least two scenario `approvedForSets` arrays:

```text
sinistcha-bulky-trick-room-setter-draft
sinistcha-redirection-support-draft
aggronmega-slow-physical-breaker-draft
aggronmega-body-press-defensive-attacker-draft
incineroar-bulky-slow-pivot-draft
incineroar-fast-taunt-pivot-draft
togekiss-bulky-redirection-support-draft
ursalunabloodmoon-slow-special-breaker-draft
mukalola-special-wall-draft
```

- [ ] **Step 2: Verify JSON parses**

Run:

```powershell
node -e "JSON.parse(require('fs').readFileSync('src/equinox/data-packs/competitive/champions-reg-mb-doubles/verified-matchup-scenarios.fixture.json','utf8')); console.log('matchup scenario fixture json ok')"
```

Expected: `matchup scenario fixture json ok`.

- [ ] **Step 3: Commit**

```powershell
git add src/equinox/data-packs/competitive/champions-reg-mb-doubles/verified-matchup-scenarios.fixture.json
git commit -m "test: add verified matchup scenario fixture"
```

---

### Task 2: Strengthen Matchup Evidence Validator

**Files:**
- Modify: `src/scripts/validateVerifiedMatchupEvidence.ts`
- Read: `src/equinox/data-packs/competitive/champions-reg-mb-doubles/verified-evidence.fixture.json`
- Read: `src/equinox/data-packs/competitive/champions-reg-mb-doubles/verified-matchup-scenarios.fixture.json`
- Read: `src/equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json`

**Interfaces:**
- Consumes: scenario fixture from Task 1.
- Produces: strict gate that validates references and scenario integrity.

- [ ] **Step 1: Update imports and types**

Update `src/scripts/validateVerifiedMatchupEvidence.ts` to import the scenario fixture and pilot set pack:

```ts
import pilotPack from '../equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json';
import evidenceFixture from '../equinox/data-packs/competitive/champions-reg-mb-doubles/verified-evidence.fixture.json';
import scenarioFixture from '../equinox/data-packs/competitive/champions-reg-mb-doubles/verified-matchup-scenarios.fixture.json';
```

Add interfaces:

```ts
interface VerifiedEvidenceRecord {
  setId: string;
  approvedMatchupScenarios: string[];
}

interface VerifiedMatchupScenario {
  scenarioId: string;
  label: string;
  lead: string[];
  opposingThreats: string[];
  validationGoal: string;
  approvedForSets: string[];
  evidenceLevel: string;
  reviewResult: string;
  notes: string;
}
```

- [ ] **Step 2: Implement validation rules**

The script must fail if any rule is violated:

```text
- evidence fixture formatId is champions_reg_m_b_doubles
- scenario fixture formatId is champions_reg_m_b_doubles
- every pilot set has one evidence record
- every evidence record has at least two non-empty approvedMatchupScenarios
- every scenario ID referenced by evidence exists
- every referenced scenario has reviewResult approved
- every referenced scenario uses an accepted evidenceLevel
- every referenced scenario includes the setId in approvedForSets
- every approvedForSets entry points to a known pilot set
- scenario IDs are unique
```

- [ ] **Step 3: Run expected failure before evidence links are added**

Run:

```powershell
npm.cmd run sets:verified:matchups
```

Expected: FAIL because evidence records still have empty arrays.

- [ ] **Step 4: Commit**

```powershell
git add src/scripts/validateVerifiedMatchupEvidence.ts
git commit -m "test: validate verified matchup scenario integrity"
```

---

### Task 3: Link Evidence Records to Approved Scenarios

**Files:**
- Modify: `src/equinox/data-packs/competitive/champions-reg-mb-doubles/verified-evidence.fixture.json`

**Interfaces:**
- Consumes: scenario IDs from Task 1.
- Produces: per-set scenario references that let `sets:verified:matchups` pass.

- [ ] **Step 1: Add at least two scenario IDs per set**

For every record in `verified-evidence.fixture.json`, replace:

```json
"approvedMatchupScenarios": []
```

with at least two scenario IDs that exist in `verified-matchup-scenarios.fixture.json` and include that set in `approvedForSets`.

- [ ] **Step 2: Mark matchup testing approved only**

For every record, update:

```json
"matchupTesting": "approved"
```

Do not change these blockers in this task:

```json
"stagingReview": "pending",
"limitationsResolved": false
```

Do not change generated records into curated records. Do not change `sourceFreshnessReview` to bypass provenance.

- [ ] **Step 3: Verify matchup gate now passes**

Run:

```powershell
npm.cmd run sets:verified:matchups
```

Expected: PASS for 9 records.

- [ ] **Step 4: Verify readiness remains blocked**

Run:

```powershell
npm.cmd run sets:verified:readiness
```

Expected: PASS with `promotionReady: 0` and `blocked: 9`. The blockers should no longer include missing matchup testing, but should still include staging/limitations and generated source blockers where applicable.

- [ ] **Step 5: Commit**

```powershell
git add src/equinox/data-packs/competitive/champions-reg-mb-doubles/verified-evidence.fixture.json
git commit -m "test: link pilot sets to verified matchup scenarios"
```

---

### Task 4: Add Homologation Report

**Files:**
- Create: `docs/data-audit/verified-matchup-homologation-report.md`
- Modify: `docs/data-audit/verified-evidence-matrix.md`

**Interfaces:**
- Consumes: scenario fixture and evidence fixture.
- Produces: human-readable audit record for the curator.

- [ ] **Step 1: Create report**

Create `docs/data-audit/verified-matchup-homologation-report.md` with sections:

```markdown
# Verified Matchup Homologation Report

## Scope

## Scenario Coverage

## Set Outcomes

## Remaining Blockers

## Safety Confirmation

## Commands
```

The report must state:

```text
Reviewed: 9
Matchup evidence: 9/9
Verified: 0
Active: 0
MongoDB writes: 0
Production writes: 0
```

- [ ] **Step 2: Update evidence matrix**

Update `docs/data-audit/verified-evidence-matrix.md` so each row mentions that matchup evidence is now recorded, while `Verified eligible` remains `No` for all rows.

- [ ] **Step 3: Verify readiness and matchup gates**

Run:

```powershell
npm.cmd run sets:verified:matchups
npm.cmd run sets:verified:readiness
```

Expected: both PASS; readiness keeps all 9 blocked.

- [ ] **Step 4: Commit**

```powershell
git add docs/data-audit/verified-matchup-homologation-report.md docs/data-audit/verified-evidence-matrix.md
git commit -m "docs: report verified matchup homologation"
```

---

### Task 5: Final Verification

**Files:**
- Read all modified files.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: evidence that matchup homologation is complete while verified promotion remains controlled.

- [ ] **Step 1: Run required validations**

Run:

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

Expected:

```text
sets:verified:matchups passes
sets:verified:readiness passes with promotionReady 0 and blocked 9
sets:promote:verified:dry reports recordsEligible 0, recordsBlocked 9, recordsWritten 0, activeWritten 0
build passes
```

- [ ] **Step 2: Confirm final Git state**

Run:

```powershell
git status --short
git --no-pager log --oneline --decorate -8
```

Expected: only coordination scratch files may remain untracked; implementation files are committed.

- [ ] **Step 3: Final report**

Final response must include:

```text
Reviewed: 9
Matchup evidence: 9/9
Verified: 0
Active: 0
Production writes: 0
Generated source blockers preserved: yes
```
