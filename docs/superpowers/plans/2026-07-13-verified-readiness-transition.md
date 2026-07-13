# Verified Readiness Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert verified readiness from an all-blocked gate into a controlled dry-run eligibility gate for curated pilot records, while keeping generated records, active status, MongoDB writes, and production writes blocked.

**Architecture:** Extract the verified eligibility policy into a reusable read-only module consumed by both readiness validation and dry-run promotion. Update only selected curated evidence records to resolve staging and limitations. Keep set statuses unchanged, report the transition, and validate that promotion remains dry-run only.

**Tech Stack:** TypeScript, ts-node scripts, JSON fixtures, npm script gates, existing Equinox competitive data validators.

## Global Constraints

- Do not write to MongoDB.
- Do not touch production collection `pokemonsets`.
- Do not promote any set to `active`.
- Do not commit any real MongoDB URI, username, password, token, or secret.
- Do not remove the curated-source freshness blocker for generated sets.
- Do not lower confidence or coherence thresholds.
- Do not fake source freshness for generated sets.
- Keep ability, move, item, nature, and Pokemon names in canonical English.
- Keep generated records blocked unless future curated-source evidence is explicitly added in a separate approved phase.

---

### Task 1: Extract Verified Eligibility Policy

**Files:**
- Create: `src/equinox/competitive/VerifiedReadinessPolicy.ts`
- Modify: `src/scripts/validateVerifiedReadiness.ts`

**Interfaces:**
- Produces: `evaluateVerifiedReadiness(records, evidenceRecords): VerifiedReadinessEvaluation`
- Consumed by: readiness validation and dry-run promotion.

- [ ] **Step 1: Create policy module**

Create `src/equinox/competitive/VerifiedReadinessPolicy.ts` with exported types and functions:

```ts
import { CompetitiveSetValidationInput } from '../data-validation/CompetitiveValidationTypes';

export type EvidenceReviewStatus = 'pending' | 'approved';

export interface VerifiedEvidenceRecord {
  setId: string;
  matchupTesting: EvidenceReviewStatus;
  sourceFreshnessReview: EvidenceReviewStatus;
  shadowReview: EvidenceReviewStatus;
  stagingReview: EvidenceReviewStatus;
  exportParityReview: EvidenceReviewStatus;
  rollbackEvidence: EvidenceReviewStatus;
  limitationsResolved: boolean;
  notes: string;
}

export interface VerifiedReadinessItem {
  setId: string;
  pokemonName: string;
  status: string;
  sourceType?: string;
  confidence: number;
  coherenceScore: number;
  blockers: string[];
  evidence: {
    matchupTesting: boolean;
    sourceFreshnessReview: boolean;
    confidenceReviewed: boolean;
    shadowReview: boolean;
    stagingReview: boolean;
    exportParityReview: boolean;
    rollbackEvidence: boolean;
    limitationsResolved: boolean;
  };
}

export interface VerifiedReadinessEvaluation {
  records: VerifiedReadinessItem[];
  promotionReady: VerifiedReadinessItem[];
  blocked: VerifiedReadinessItem[];
  aggregate: {
    records: number;
    promotionReady: number;
    blocked: number;
    activeCount: number;
    verifiedCount: number;
    generatedBlockedCount: number;
    matchupTestingApprovedCount: number;
    sourceFreshnessReviewedCount: number;
    confidenceReadyCount: number;
    shadowReviewedCount: number;
    stagingReviewedCount: number;
    exportParityReviewedCount: number;
    rollbackEvidenceCount: number;
    limitationsResolvedCount: number;
  };
}
```

- [ ] **Step 2: Implement policy functions**

Implement:

```ts
export function evaluateVerifiedRecord(
  record: CompetitiveSetValidationInput,
  verifiedEvidence: VerifiedEvidenceRecord,
): VerifiedReadinessItem
```

and:

```ts
export function evaluateVerifiedReadiness(
  records: CompetitiveSetValidationInput[],
  evidenceRecords: VerifiedEvidenceRecord[],
): VerifiedReadinessEvaluation
```

Rules:

```text
sourceFreshnessReview is true only when record.sourceType === curated, record.sourceUpdatedAt exists, and evidence sourceFreshnessReview is approved.
confidenceReviewed is true only when confidence >= 80 and coherenceScore >= 85.
promotionReady records are records with zero blockers.
generated records must still receive source freshness blockers.
activeCount counts records with status active.
verifiedCount counts records with status verified.
```

- [ ] **Step 3: Refactor readiness script to use policy**

Modify `src/scripts/validateVerifiedReadiness.ts` so it imports:

```ts
import { evaluateVerifiedReadiness, VerifiedEvidenceRecord } from '../equinox/competitive/VerifiedReadinessPolicy';
```

It must still assert:

```ts
records.length === 9
records.every(record => record.status === 'reviewed')
evaluation.aggregate.activeCount === 0
evaluation.aggregate.verifiedCount === 0
evaluation.promotionReady.every(record => record.sourceType === 'curated')
evaluation.blocked.every(record => record.blockers.length > 0)
```

Remove the old assertions that required:

```ts
promotionReady.length === 0
blocked.length === records.length
```

- [ ] **Step 4: Verify current state remains safe before evidence update**

Run:

```powershell
npm.cmd run sets:verified:readiness
npm.cmd run typecheck
```

Expected: PASS with current counts still `promotionReady: 0`, `blocked: 9` before Task 2 updates evidence.

- [ ] **Step 5: Commit**

```powershell
git add src/equinox/competitive/VerifiedReadinessPolicy.ts src/scripts/validateVerifiedReadiness.ts
git commit -m "test: extract verified readiness policy"
```

---

### Task 2: Resolve Curated Readiness Evidence

**Files:**
- Modify: `src/equinox/data-packs/competitive/champions-reg-mb-doubles/verified-evidence.fixture.json`

**Interfaces:**
- Consumes: policy from Task 1.
- Produces: promotion-ready curated records while generated records remain blocked.

- [ ] **Step 1: Update selected curated records only**

For these records only:

```text
sinistcha-bulky-trick-room-setter-draft
aggronmega-slow-physical-breaker-draft
incineroar-bulky-slow-pivot-draft
ursalunabloodmoon-slow-special-breaker-draft
```

Set:

```json
"stagingReview": "approved",
"limitationsResolved": true
```

Replace their `notes` values with resolved-review notes:

```text
Verified readiness transition: staging review approved and prior limitation resolved for dry-run verified eligibility.
```

- [ ] **Step 2: Preserve blocked records**

Do not change these records:

```text
sinistcha-redirection-support-draft
aggronmega-body-press-defensive-attacker-draft
incineroar-fast-taunt-pivot-draft
togekiss-bulky-redirection-support-draft
mukalola-special-wall-draft
```

Do not change any `sourceFreshnessReview`, source type, status, confidence, or coherence score.

- [ ] **Step 3: Verify readiness now reports curated candidates**

Run:

```powershell
npm.cmd run sets:verified:readiness
```

Expected:

```text
promotionReady: 4
blocked: 5
generatedBlockedCount: 4
activeCount: 0
verifiedCount: 0
```

- [ ] **Step 4: Verify matchup gate still passes**

Run:

```powershell
npm.cmd run sets:verified:matchups
```

Expected: PASS for 9 records.

- [ ] **Step 5: Commit**

```powershell
git add src/equinox/data-packs/competitive/champions-reg-mb-doubles/verified-evidence.fixture.json
git commit -m "test: resolve curated verified readiness evidence"
```

---

### Task 3: Make Verified Promotion Dry-Run Data-Driven

**Files:**
- Modify: `src/scripts/promoteReviewedSetsToVerified.ts`

**Interfaces:**
- Consumes: `evaluateVerifiedReadiness` from Task 1.
- Produces: dynamic dry-run counts with zero writes.

- [ ] **Step 1: Replace static output with policy evaluation**

Modify `src/scripts/promoteReviewedSetsToVerified.ts` to import:

```ts
import pilotPack from '../equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json';
import evidenceFixture from '../equinox/data-packs/competitive/champions-reg-mb-doubles/verified-evidence.fixture.json';
import { evaluateVerifiedReadiness, VerifiedEvidenceRecord } from '../equinox/competitive/VerifiedReadinessPolicy';
import { CompetitiveSetValidationInput } from '../equinox/data-validation/CompetitiveValidationTypes';
```

Keep:

```ts
const dryRun = process.argv.includes('--dry-run');

if (!dryRun) {
  throw new Error('Verified promotion requires a separate approved non-dry-run command.');
}
```

Then calculate:

```ts
const records = (pilotPack as { sets: CompetitiveSetValidationInput[] }).sets;
const evidenceRecords = (evidenceFixture as { records: VerifiedEvidenceRecord[] }).records;
const evaluation = evaluateVerifiedReadiness(records, evidenceRecords);
```

Print:

```ts
console.log(`recordsEligible: ${evaluation.promotionReady.length}`);
console.log(`recordsBlocked: ${evaluation.blocked.length}`);
console.log('recordsWritten: 0');
console.log('activeWritten: 0');
```

Do not import MongoDB or write files.

- [ ] **Step 2: Verify dry-run output**

Run:

```powershell
npm.cmd run sets:promote:verified:dry
```

Expected:

```text
recordsEligible: 4
recordsBlocked: 5
recordsWritten: 0
activeWritten: 0
```

- [ ] **Step 3: Verify non-dry-run still throws**

Run:

```powershell
npx ts-node src/scripts/promoteReviewedSetsToVerified.ts
```

Expected: FAIL with `Verified promotion requires a separate approved non-dry-run command.`

- [ ] **Step 4: Commit**

```powershell
git add src/scripts/promoteReviewedSetsToVerified.ts
git commit -m "test: make verified promotion dry-run data driven"
```

---

### Task 4: Add Transition Report

**Files:**
- Create: `docs/data-audit/verified-readiness-transition-report.md`
- Modify: `docs/data-audit/verified-evidence-matrix.md`

**Interfaces:**
- Consumes: readiness and dry-run outputs from Tasks 2 and 3.
- Produces: human-readable audit evidence for curator review.

- [ ] **Step 1: Create report**

Create `docs/data-audit/verified-readiness-transition-report.md` with sections:

```markdown
# Verified Readiness Transition Report

## Scope

## Eligible Curated Records

## Blocked Records

## Safety Confirmation

## Commands
```

It must include:

```text
Reviewed records: 9
Matchup-homologated records: 9
Promotion-ready records: 4
Blocked records: 5
Verified records: 0
Active records: 0
MongoDB writes: 0
Production writes: 0
```

List the four ready curated set IDs and the five blocked set IDs with reasons.

- [ ] **Step 2: Update evidence matrix**

Update `docs/data-audit/verified-evidence-matrix.md` so:

```text
The four selected curated records show Verified eligible = Dry-run only.
All other records keep Verified eligible = No.
Generated records explicitly state source freshness remains blocked.
```

- [ ] **Step 3: Verify documentation matches scripts**

Run:

```powershell
npm.cmd run sets:verified:readiness
npm.cmd run sets:promote:verified:dry
```

Expected counts match the report:

```text
promotionReady: 4
blocked: 5
recordsEligible: 4
recordsBlocked: 5
recordsWritten: 0
activeWritten: 0
```

- [ ] **Step 4: Commit**

```powershell
git add docs/data-audit/verified-readiness-transition-report.md docs/data-audit/verified-evidence-matrix.md
git commit -m "docs: report verified readiness transition"
```

---

### Task 5: Final Verification

**Files:**
- Read all modified files.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: final validation evidence for PR.

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

Expected final properties:

```text
Matchup evidence: 9/9
Promotion-ready records: 4 curated only
Blocked records: 5
Generated records: blocked
Verified records: 0
Active records: 0
recordsWritten: 0
activeWritten: 0
MongoDB writes: 0
Production writes: 0
```

- [ ] **Step 2: Confirm final Git state**

Run:

```powershell
git status --short
git --no-pager log --oneline --decorate -10
```

Expected: implementation files are committed. No production or secret files are staged.

- [ ] **Step 3: Final report**

Final response must include:

```text
Promotion-ready records: 4 curated only
Blocked records: 5
Generated source blockers preserved: yes
Verified records: 0
Active records: 0
MongoDB writes: 0
Production writes: 0
```
