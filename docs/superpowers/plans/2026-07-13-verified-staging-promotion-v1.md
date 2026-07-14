# Verified Staging Promotion V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a staging-only, idempotent verified promotion workflow for exactly four curated Champions M-B Doubles sets, with Mongo guardrails, rollback by run id, competitive payload hashes, and zero production writes.

**Architecture:** Reuse the existing verified readiness policy and dry-run promotion script, then add a focused staging promotion policy module that owns allowlist validation, payload hashing, run summaries, and collection guardrails. Scripts stay operationally explicit: dry-run by default, execute only with flags and `--execute`, rollback only with `--run-id`, and staging check reads Mongo directly.

**Tech Stack:** TypeScript, ts-node scripts, Mongoose/MongoDB, JSON fixtures, npm script gates, existing Equinox data mode and database write guards.

## Global Constraints

- Target collection for this phase is exactly `pokemonsets_v2_staging`.
- Production collection `pokemonsets` is literally blocked.
- Default promotion command is dry-run and exits 0 with `recordsWritten: 0`.
- Execute mode requires `EQUINOX_DATA_MODE=mongo`, `EQUINOX_ALLOW_DATABASE_WRITES=true`, `EQUINOX_TARGET_COLLECTION=pokemonsets_v2_staging`, `EQUINOX_ENABLE_VERIFIED_PROMOTION=true`, and `--execute`.
- Promote only the exact four allowlisted curated set IDs.
- Generated records stay blocked and unmodified.
- `active` remains false and is not promoted.
- Missing `active` is an integrity error for promotion candidates.
- Rollback execute mode requires `--run-id=<RUN_ID>`.
- Do not commit MongoDB URI, username, password, token, or any secret.
- Do not change Render production configuration.
- Keep ability, move, item, nature, and Pokemon names in canonical English.

---

## File Structure

- Create `src/equinox/competitive/VerifiedStagingPromotionPolicy.ts`: shared constants, allowlist validation, hash builder, collection guardrails, result types, and summary assertions.
- Modify `src/models/PokemonSet.ts`: add optional `active`, `verifiedAt`, and `verifiedRunId` fields to the Mongo model.
- Modify `src/equinox/data-validation/CompetitiveValidationTypes.ts`: add optional promotion metadata fields used by scripts and fixtures.
- Modify `src/equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json`: add `active: false` to all nine pilot records so staging documents can satisfy the promotion precondition.
- Modify `src/scripts/promoteReviewedSetsToVerified.ts`: keep dry-run default and add guarded Mongo execute mode with atomic filters, hashes, snapshots, and idempotency.
- Create `src/scripts/rollbackVerifiedStagingPromotion.ts`: dry-run and execute rollback of verified records by `verifiedRunId`.
- Create `src/scripts/validateVerifiedStagingPromotion.ts`: Mongo-backed staging check for allowlist, blocked records, generated records, duplicates, and production evidence.
- Modify `package.json`: add `sets:promote:verified`, `sets:rollback:verified:staging`, `sets:rollback:verified:staging:dry`, and `sets:verified:staging:check`.
- Create `docs/data-audit/verified-staging-promotion-v1-report.md`: operational report template and dry-run evidence.

---

### Task 1: Add Staging Promotion Policy Module

**Files:**
- Create: `src/equinox/competitive/VerifiedStagingPromotionPolicy.ts`

**Interfaces:**
- Consumes: `VerifiedReadinessEvaluation` from `src/equinox/competitive/VerifiedReadinessPolicy.ts` and `CompetitiveSetValidationInput` from `src/equinox/data-validation/CompetitiveValidationTypes.ts`.
- Produces: `VERIFIED_STAGING_PROMOTION_ALLOWLIST`, `assertVerifiedStagingTarget`, `buildCompetitivePayloadHash`, `validateVerifiedPromotionEligibility`, and result interfaces used by promotion, rollback, and staging check scripts.

- [ ] **Step 1: Create the policy file with constants and types**

Create `src/equinox/competitive/VerifiedStagingPromotionPolicy.ts` with this structure:

```ts
import crypto from 'crypto';
import { CompetitiveSetValidationInput } from '../data-validation/CompetitiveValidationTypes';
import { VerifiedReadinessEvaluation } from './VerifiedReadinessPolicy';

export const VERIFIED_STAGING_TARGET_COLLECTION = 'pokemonsets_v2_staging';
export const PRODUCTION_SET_COLLECTION = 'pokemonsets';

export const VERIFIED_STAGING_PROMOTION_ALLOWLIST = [
  'sinistcha-bulky-trick-room-setter-draft',
  'aggronmega-slow-physical-breaker-draft',
  'incineroar-bulky-slow-pivot-draft',
  'ursalunabloodmoon-slow-special-breaker-draft',
] as const;

export type VerifiedStagingPromotionSetId = typeof VERIFIED_STAGING_PROMOTION_ALLOWLIST[number];

export interface VerifiedPromotionValidationResult {
  eligibleSetIds: string[];
  blockedSetIds: string[];
  recordsEligible: number;
  recordsBlocked: number;
  recordsAlreadyVerified: number;
  recordsPromotedToVerified: number;
  recordsWritten: number;
  recordsActive: number;
  generatedPromoted: number;
  productionWrites: number;
}

export interface CompetitivePayloadHashRecord {
  setId: string;
  competitivePayloadHashBefore: string;
  competitivePayloadHashAfter: string;
  competitivePayloadChanged: boolean;
}
```

- [ ] **Step 2: Add target collection guard**

Add this function:

```ts
export function assertVerifiedStagingTarget(targetCollection: string | undefined): string {
  if (targetCollection === PRODUCTION_SET_COLLECTION) {
    throw new Error('Verified staging promotion blocked: production collection pokemonsets is not allowed.');
  }

  if (targetCollection !== VERIFIED_STAGING_TARGET_COLLECTION) {
    throw new Error(`Verified staging promotion requires EQUINOX_TARGET_COLLECTION=${VERIFIED_STAGING_TARGET_COLLECTION}.`);
  }

  return targetCollection;
}
```

- [ ] **Step 3: Add stable competitive payload hashing**

Add this function. It must intentionally exclude `status`, `verifiedAt`, `verifiedRunId`, `updatedAt`, and `active`:

```ts
export function buildCompetitivePayloadHash(record: CompetitiveSetValidationInput): string {
  const payload = {
    moves: record.moves ?? [],
    item: record.item ?? null,
    ability: record.ability ?? null,
    nature: record.nature ?? null,
    evs: record.evs ?? {},
    ivs: record.ivs ?? {},
    roles: {
      primaryRole: record.primaryRole ?? null,
      secondaryRoles: record.secondaryRoles ?? [],
      role: (record as { role?: string }).role ?? null,
    },
    sourceType: record.sourceType ?? null,
    sourceUpdatedAt: record.sourceUpdatedAt ?? null,
    confidence: record.confidence ?? null,
    coherenceScore: record.coherenceScore ?? null,
  };

  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
```

- [ ] **Step 4: Add eligibility invariant validation**

Add this function:

```ts
export function validateVerifiedPromotionEligibility(
  evaluation: VerifiedReadinessEvaluation,
  records: CompetitiveSetValidationInput[],
): VerifiedPromotionValidationResult {
  const allowlist = new Set<string>(VERIFIED_STAGING_PROMOTION_ALLOWLIST);
  const eligibleSetIds = evaluation.promotionReady.map(record => record.setId).sort();
  const expectedSetIds = [...VERIFIED_STAGING_PROMOTION_ALLOWLIST].sort();
  const blockedSetIds = evaluation.blocked.map(record => record.setId).sort();

  const failures: string[] = [];
  if (eligibleSetIds.length !== 4) failures.push(`eligibleCount must be 4, received ${eligibleSetIds.length}`);
  if (expectedSetIds.length !== 4) failures.push(`allowlistCount must be 4, received ${expectedSetIds.length}`);
  if (eligibleSetIds.join('|') !== expectedSetIds.join('|')) {
    failures.push(`eligibleIds must equal allowlistIds. eligible=${eligibleSetIds.join(',')} allowlist=${expectedSetIds.join(',')}`);
  }

  for (const record of records) {
    const setId = String(record.setId ?? 'unknown');
    const isEligible = allowlist.has(setId);
    if (isEligible && record.sourceType !== 'curated') failures.push(`${setId} must be curated.`);
    if (isEligible && record.status !== 'reviewed' && record.status !== 'verified') failures.push(`${setId} must be reviewed or already verified.`);
    if ((record as { active?: boolean }).active !== false) failures.push(`${setId} must have active === false.`);
    if (!isEligible && record.sourceType === 'generated' && evaluation.promotionReady.some(item => item.setId === setId)) {
      failures.push(`${setId} is generated and must not be eligible.`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Verified staging promotion eligibility failed:\n- ${failures.join('\n- ')}`);
  }

  return {
    eligibleSetIds,
    blockedSetIds,
    recordsEligible: eligibleSetIds.length,
    recordsBlocked: blockedSetIds.length,
    recordsAlreadyVerified: 0,
    recordsPromotedToVerified: 0,
    recordsWritten: 0,
    recordsActive: 0,
    generatedPromoted: 0,
    productionWrites: 0,
  };
}
```

- [ ] **Step 5: Run typecheck for the new module**

Run:

```powershell
npm.cmd run typecheck
```

Expected: PASS or only failures from later tasks not yet implemented if this task is executed in isolation after importing the module nowhere.

- [ ] **Step 6: Commit**

```powershell
git add src/equinox/competitive/VerifiedStagingPromotionPolicy.ts
git commit -m "feat: add verified staging promotion policy"
```

---

### Task 2: Add Active and Verification Metadata Support

**Files:**
- Modify: `src/models/PokemonSet.ts`
- Modify: `src/equinox/data-validation/CompetitiveValidationTypes.ts`
- Modify: `src/equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json`

**Interfaces:**
- Produces: Mongo documents and fixture records can carry `active: false`, `verifiedAt`, and `verifiedRunId` without losing type safety.
- Consumed by: atomic promotion filters and rollback filters in later tasks.

- [ ] **Step 1: Extend validation type**

Modify `CompetitiveSetValidationInput` in `src/equinox/data-validation/CompetitiveValidationTypes.ts` by adding:

```ts
  active?: boolean;
  verifiedAt?: string | Date;
  verifiedRunId?: string;
```

Place these fields near `status?: CompetitiveSetStatus;`.

- [ ] **Step 2: Extend Mongo interface**

Modify `IPokemonSet` in `src/models/PokemonSet.ts` by adding:

```ts
  active?: boolean;
  verifiedAt?: Date;
  verifiedRunId?: string;
```

Place these fields near `status?: ...`.

- [ ] **Step 3: Extend Mongo schema**

Modify `PokemonSetSchema` in `src/models/PokemonSet.ts` by adding:

```ts
  active: { type: Boolean, default: false, index: true },
  verifiedAt: { type: Date },
  verifiedRunId: { type: String, index: true },
```

Place these fields near the `status` and `dataVersion` fields.

- [ ] **Step 4: Add active false to all nine pilot fixture records**

Modify each object in `src/equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json` so every set contains:

```json
"active": false
```

Keep all existing competitive fields unchanged. Do not change `status`, `sourceType`, moves, item, ability, nature, EVs, IVs, roles, confidence, or coherence.

- [ ] **Step 5: Verify fixture structure and type safety**

Run:

```powershell
npm.cmd run sets:structure:check
npm.cmd run typecheck
```

Expected: PASS. If structure validation rejects `active`, update the validator schema to allow boolean `active` without using it as a promotion signal.

- [ ] **Step 6: Commit**

```powershell
git add src/models/PokemonSet.ts src/equinox/data-validation/CompetitiveValidationTypes.ts src/equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json
git commit -m "feat: add verified staging metadata fields"
```

---

### Task 3: Upgrade Verified Promotion Script

**Files:**
- Modify: `src/scripts/promoteReviewedSetsToVerified.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `evaluateVerifiedReadiness`, `validateVerifiedPromotionEligibility`, `assertVerifiedStagingTarget`, `buildCompetitivePayloadHash`, `connectDatabase`, and Mongoose collection access.
- Produces: dry-run by default, guarded execute mode, atomic update filters, snapshot logs, idempotency counters, and closed Mongo connections.

- [ ] **Step 1: Add npm script alias**

In `package.json`, add or update:

```json
"sets:promote:verified": "ts-node src/scripts/promoteReviewedSetsToVerified.ts",
"sets:promote:verified:dry": "ts-node src/scripts/promoteReviewedSetsToVerified.ts --dry-run"
```

Keep existing script names compatible.

- [ ] **Step 2: Replace top-level throw with mode parsing**

In `src/scripts/promoteReviewedSetsToVerified.ts`, replace the current `if (!dryRun) throw ...` with:

```ts
const execute = process.argv.includes('--execute');
const dryRun = process.argv.includes('--dry-run') || !execute;
```

Default command without `--execute` must be dry-run.

- [ ] **Step 3: Add authorization checks for execute mode**

Add function inside the script:

```ts
function assertExecuteAuthorized(): void {
  const targetCollection = process.env.EQUINOX_TARGET_COLLECTION;
  assertVerifiedStagingTarget(targetCollection);

  const failures = [
    process.env.EQUINOX_DATA_MODE === 'mongo' ? null : 'EQUINOX_DATA_MODE=mongo is required',
    process.env.EQUINOX_ALLOW_DATABASE_WRITES === 'true' ? null : 'EQUINOX_ALLOW_DATABASE_WRITES=true is required',
    process.env.EQUINOX_ENABLE_VERIFIED_PROMOTION === 'true' ? null : 'EQUINOX_ENABLE_VERIFIED_PROMOTION=true is required',
  ].filter(Boolean);

  if (failures.length > 0) {
    throw new Error(`Verified staging promotion execute refused:\n- ${failures.join('\n- ')}`);
  }
}
```

Call this only when `execute === true`.

- [ ] **Step 4: Build dry-run result from readiness policy**

Keep reading:

```ts
const records = (pilotPack as { sets: CompetitiveSetValidationInput[] }).sets;
const evidenceRecords = (evidenceFixture as { records: VerifiedEvidenceRecord[] }).records;
const evaluation = evaluateVerifiedReadiness(records, evidenceRecords);
const validation = validateVerifiedPromotionEligibility(evaluation, records);
```

For dry-run, print JSON plus stable summary lines:

```ts
console.log(JSON.stringify({ mode: 'dry-run', ...validation }, null, 2));
console.log(`recordsEligible: ${validation.recordsEligible}`);
console.log(`recordsBlocked: ${validation.recordsBlocked}`);
console.log('recordsWritten: 0');
console.log('productionWrites: 0');
```

- [ ] **Step 5: Implement execute flow with atomic update filters**

In execute mode:

```ts
const runId = `verified-staging-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const targetCollection = assertVerifiedStagingTarget(process.env.EQUINOX_TARGET_COLLECTION);
const collection = mongoose.connection.collection(targetCollection);
const now = new Date();
```

Read staging docs for the allowlist, compute hashes, then update only with this precondition:

```ts
const updateResult = await collection.updateMany(
  {
    setId: { $in: VERIFIED_STAGING_PROMOTION_ALLOWLIST },
    status: 'reviewed',
    active: false,
    sourceType: 'curated',
  },
  {
    $set: {
      status: 'verified',
      verifiedAt: now,
      verifiedRunId: runId,
      updatedAt: now,
    },
  },
);
```

Do not set `active` in the update.

- [ ] **Step 6: Assert write counts and idempotency**

After update, count already verified records by allowlist and compute:

```ts
const recordsAlreadyVerified = await collection.countDocuments({
  setId: { $in: VERIFIED_STAGING_PROMOTION_ALLOWLIST },
  status: 'verified',
  active: false,
});
```

Then assert:

```ts
const recordsPromotedToVerified = Number(updateResult.modifiedCount);
const matchedCount = Number(updateResult.matchedCount);
if (matchedCount + recordsAlreadyVerified !== 4) {
  throw new Error(`Verified staging promotion count mismatch after atomic update: matched=${matchedCount} alreadyVerified=${recordsAlreadyVerified}.`);
}
if (recordsPromotedToVerified < 0 || recordsPromotedToVerified > 4) {
  throw new Error(`Verified staging promotion modified count is invalid: ${recordsPromotedToVerified}.`);
}
```

- [ ] **Step 7: Close Mongo in finally**

Wrap Mongo work in:

```ts
try {
  await connectDatabase();
  // execute promotion
} finally {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
```

Do not use `process.exit(0)`.

- [ ] **Step 8: Verify dry-run stays safe**

Run:

```powershell
npm.cmd run sets:promote:verified
npm.cmd run sets:promote:verified:dry
```

Expected both show:

```text
mode: dry-run
recordsEligible: 4
recordsBlocked: 5
recordsWritten: 0
productionWrites: 0
```

- [ ] **Step 9: Verify execute refusal without flags**

Run:

```powershell
npm.cmd run sets:promote:verified -- --execute
```

Expected: FAIL before Mongo write with missing authorization flags and `recordsWritten: 0` or equivalent refusal output.

- [ ] **Step 10: Commit**

```powershell
git add src/scripts/promoteReviewedSetsToVerified.ts package.json
git commit -m "feat: implement guarded verified staging promotion"
```

---

### Task 4: Add Staging Rollback Script

**Files:**
- Create: `src/scripts/rollbackVerifiedStagingPromotion.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: allowlist and target collection guard from `VerifiedStagingPromotionPolicy.ts`.
- Produces: rollback dry-run and execute mode scoped to `verifiedRunId`.

- [ ] **Step 1: Add npm scripts**

In `package.json`, add:

```json
"sets:rollback:verified:staging": "ts-node src/scripts/rollbackVerifiedStagingPromotion.ts",
"sets:rollback:verified:staging:dry": "ts-node src/scripts/rollbackVerifiedStagingPromotion.ts --dry-run"
```

- [ ] **Step 2: Create rollback script with argument parsing**

Create `src/scripts/rollbackVerifiedStagingPromotion.ts` with:

```ts
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { assertVerifiedStagingTarget, VERIFIED_STAGING_PROMOTION_ALLOWLIST } from '../equinox/competitive/VerifiedStagingPromotionPolicy';

const execute = process.argv.includes('--execute');
const dryRun = process.argv.includes('--dry-run') || !execute;
const runIdArg = process.argv.find(arg => arg.startsWith('--run-id='));
const runId = runIdArg?.slice('--run-id='.length);
```

- [ ] **Step 3: Refuse execute without run id and flags**

Add:

```ts
function assertRollbackAuthorized(): void {
  assertVerifiedStagingTarget(process.env.EQUINOX_TARGET_COLLECTION);
  if (!runId) throw new Error('Verified staging rollback execute requires --run-id=<RUN_ID>.');
  if (process.env.EQUINOX_DATA_MODE !== 'mongo') throw new Error('EQUINOX_DATA_MODE=mongo is required.');
  if (process.env.EQUINOX_ALLOW_DATABASE_WRITES !== 'true') throw new Error('EQUINOX_ALLOW_DATABASE_WRITES=true is required.');
}
```

Call it only in execute mode.

- [ ] **Step 4: Implement rollback query and dry-run output**

Use this filter:

```ts
const filter = {
  setId: { $in: VERIFIED_STAGING_PROMOTION_ALLOWLIST },
  status: 'verified',
  active: false,
  verifiedRunId: runId,
};
```

Dry-run should read Mongo when data mode is mongo and target is configured; otherwise it should print:

```text
mode: dry-run
recordsEligibleForRollback: 0
recordsWritten: 0
productionWrites: 0
```

- [ ] **Step 5: Implement execute rollback**

Execute update:

```ts
const result = await collection.updateMany(filter, {
  $set: {
    status: 'reviewed',
    updatedAt: new Date(),
  },
  $unset: {
    verifiedAt: '',
    verifiedRunId: '',
  },
});
```

Do not promote generated records. Do not write production. Do not set `active` to true.

- [ ] **Step 6: Close Mongo in finally**

Use the same `try/finally` disconnect pattern as the promotion script.

- [ ] **Step 7: Verify rollback dry-run safe path**

Run:

```powershell
npm.cmd run sets:rollback:verified:staging:dry
```

Expected without Mongo flags:

```text
mode: dry-run
recordsEligibleForRollback: 0
recordsWritten: 0
productionWrites: 0
```

- [ ] **Step 8: Verify rollback execute refusal without run id**

Run:

```powershell
npm.cmd run sets:rollback:verified:staging -- --execute
```

Expected: FAIL before any write with `--run-id=<RUN_ID>` required.

- [ ] **Step 9: Commit**

```powershell
git add src/scripts/rollbackVerifiedStagingPromotion.ts package.json
git commit -m "feat: add verified staging rollback command"
```

---

### Task 5: Add Mongo-Backed Staging Check

**Files:**
- Create: `src/scripts/validateVerifiedStagingPromotion.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: allowlist and target guard from `VerifiedStagingPromotionPolicy.ts`.
- Produces: `sets:verified:staging:check`, which reads `pokemonsets_v2_staging` directly.

- [ ] **Step 1: Add npm script**

In `package.json`, add:

```json
"sets:verified:staging:check": "ts-node src/scripts/validateVerifiedStagingPromotion.ts"
```

- [ ] **Step 2: Create check script with filesystem fallback**

Create `src/scripts/validateVerifiedStagingPromotion.ts` with:

```ts
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { resolveDataMode } from '../config/dataMode';
import { assertVerifiedStagingTarget, VERIFIED_STAGING_PROMOTION_ALLOWLIST } from '../equinox/competitive/VerifiedStagingPromotionPolicy';

async function main(): Promise<void> {
  if (resolveDataMode() !== 'mongo') {
    console.log(JSON.stringify({ mode: resolveDataMode(), mongoRead: false, recordsWritten: 0 }, null, 2));
    return;
  }

  const targetCollection = assertVerifiedStagingTarget(process.env.EQUINOX_TARGET_COLLECTION);
  try {
    await connectDatabase();
    const collection = mongoose.connection.collection(targetCollection);
    const docs = await collection.find({ setId: { $in: VERIFIED_STAGING_PROMOTION_ALLOWLIST } }).toArray();
    // compute assertions here
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
```

- [ ] **Step 3: Implement required assertions**

The script must compute and assert:

```text
allowlistedVerified: 4
allowlistedActive: 0
generatedVerifiedByRun: 0
blockedRecordsStillReviewed: 5
duplicateSetIds: 0
productionWrites: 0
sameVerifiedRunIdForAllowlist: true
```

If the staging environment is still pre-promotion, allow the script to report `allowlistedVerified: 0` only when run without `--require-verified`. Add optional argument parsing:

```ts
const requireVerified = process.argv.includes('--require-verified');
```

When `--require-verified` is present, fail unless the exact promoted state is present.

- [ ] **Step 4: Verify safe non-Mongo behavior**

Run:

```powershell
npm.cmd run sets:verified:staging:check
```

Expected in filesystem mode:

```text
mongoRead: false
recordsWritten: 0
```

- [ ] **Step 5: Commit**

```powershell
git add src/scripts/validateVerifiedStagingPromotion.ts package.json
git commit -m "feat: add verified staging check"
```

---

### Task 6: Add Audit Report Template and Final Gates

**Files:**
- Create: `docs/data-audit/verified-staging-promotion-v1-report.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: outputs from promotion, rollback, and staging check scripts.
- Produces: evidence file for PR and later real staging execution.

- [ ] **Step 1: Create report template**

Create `docs/data-audit/verified-staging-promotion-v1-report.md` with:

```markdown
# Verified Staging Promotion V1 Report

## Scope

Staging-only verified promotion for four curated Champions M-B Doubles pilot sets.

## Eligible Set IDs

- sinistcha-bulky-trick-room-setter-draft
- aggronmega-slow-physical-breaker-draft
- incineroar-bulky-slow-pivot-draft
- ursalunabloodmoon-slow-special-breaker-draft

## Blocked Set IDs

Generated and non-ready records remain reviewed and blocked.

## Dry-Run Result

Record the actual command output from `npm.cmd run sets:promote:verified`; before real Mongo execution it must show `mode: dry-run`, `recordsEligible: 4`, `recordsBlocked: 5`, `recordsWritten: 0`, and `productionWrites: 0`.

## Execute Result

Not executed in this PR.

## Rollback Result

Rollback execute not executed in this PR.

## Safety Confirmation

- Target collection: `pokemonsets_v2_staging`
- Production collection `pokemonsets`: blocked
- Active records promoted: 0
- Generated records promoted: 0
- Production writes: 0
- Mongo credentials: not recorded
```

- [ ] **Step 2: Ensure preflight includes only safe dry-run commands**

If `package.json` preflight references this phase, include only:

```json
"sets:promote:verified:dry"
```

Do not add execute, rollback execute, or Mongo-only checks requiring credentials to `preflight`.

- [ ] **Step 3: Run full local validation**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run sets:verified:matchups
npm.cmd run sets:verified:readiness
npm.cmd run sets:promote:verified
npm.cmd run sets:promote:verified:dry
npm.cmd run sets:rollback:verified:staging:dry
npm.cmd run sets:verified:staging:check
npm.cmd run sets:structure:check
npm.cmd run sets:legality:check
npm.cmd run sets:coherence:check
npm.cmd run build
git diff --check
```

Expected:

```text
recordsEligible: 4
recordsBlocked: 5
recordsWritten: 0
productionWrites: 0
active promoted: 0
generated promoted: 0
```

- [ ] **Step 4: Commit**

```powershell
git add docs/data-audit/verified-staging-promotion-v1-report.md package.json
git commit -m "docs: report verified staging promotion workflow"
```

---

### Task 7: PR Handoff and Operational Execution Notes

**Files:**
- Read: `docs/superpowers/specs/2026-07-13-verified-staging-promotion-v1-design.md`
- Read: `docs/data-audit/verified-staging-promotion-v1-report.md`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: final branch ready for PR; real Mongo execution remains separate and approval-gated.

- [ ] **Step 1: Confirm branch state**

Run:

```powershell
git status --short
git --no-pager log --oneline --decorate -10
```

Expected: no uncommitted changes; commits show spec, hardening, and implementation tasks.

- [ ] **Step 2: Do not execute real Mongo promotion in PR implementation**

Do not run this during implementation unless explicitly approved after PR merge:

```powershell
$env:EQUINOX_DATA_MODE="mongo"
$env:EQUINOX_ALLOW_DATABASE_WRITES="true"
$env:EQUINOX_TARGET_COLLECTION="pokemonsets_v2_staging"
$env:EQUINOX_ENABLE_VERIFIED_PROMOTION="true"
npm.cmd run sets:promote:verified -- --execute
$env:EQUINOX_ALLOW_DATABASE_WRITES="false"
```

- [ ] **Step 3: Document post-merge sequence for the operator**

Final response must include the post-merge operational order:

```text
snapshot pre-promotion
dry-run with real Mongo
execute promotion
staging check
second idempotent execute
rollback dry-run
rollback execute
rollback validation
final promotion execute
final staging check
final report
```

- [ ] **Step 4: Final answer**

Final answer must state:

```text
Plan implemented locally only.
No production writes were performed.
No generated sets were promoted.
No active promotion was added.
Real staging execution remains approval-gated.
```

