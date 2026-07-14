# Verified To Active Staging Promotion V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote only the four currently verified curated staging records from `verified` to `active` in `pokemonsets_v2_staging`, with dry-run by default, transaction-backed execution, rollback by `activeRunId`, and one active version per logical set.

**Architecture:** Introduce a dedicated activation allowlist and a stable logical identity `setKey`, then build three operational scripts: activation, rollback, and active-state validation. Activation and rollback read/write only `pokemonsets_v2_staging`, block `pokemonsets`, require explicit env flags plus `--execute`, and use Mongo transactions so the operation updates exactly four records or zero.

**Tech Stack:** TypeScript, ts-node, Mongoose/MongoDB Atlas transactions, existing Equinox data mode/write guards, JSON data pack fixtures, npm script gates.

## Global Constraints

- Target collection is exactly `pokemonsets_v2_staging`.
- Production collection `pokemonsets` is forbidden.
- Allowed state transition is `verified -> active` only.
- Do not edit reviewed, draft, generated blocked, deprecated, quarantined, or non-allowlisted documents during activation.
- Activation allowlist is independent from the reviewed-to-verified allowlist.
- Dry-run is default and writes zero records.
- Execute requires `EQUINOX_DATA_MODE=mongo`, `EQUINOX_TARGET_COLLECTION=pokemonsets_v2_staging`, `EQUINOX_ALLOW_DATABASE_WRITES=true`, `EQUINOX_ENABLE_STAGING_ACTIVATION=true`, and `--execute`.
- Rollback execute requires `--run-id=<ACTIVE_RUN_ID>` and the same write safeguards.
- Four updates or zero updates. Never allow partial activation or partial rollback.
- Preserve `verifiedRunId` during activation and rollback.
- No generated record can become active.
- Final staging state must be 4 active allowlisted records, 5 reviewed blocked records, 0 generated active, 0 active conflicts, and 0 production writes.
- Do not commit MongoDB URI, credentials, `.env`, tokens, or DNS hook files.

---

## Confirmed Architecture Decision

Current code does not contain a `setKey`, `logicalKey`, `activeRunId`, `activatedAt`, or `activationMetadata` field. This phase must introduce `setKey` as the active-version uniqueness key.

Initial `setKey` values should be derived from the stable non-status identity of the four curated sets:

```text
sinistcha-bulky-trick-room-setter
aggronmega-slow-physical-breaker
incineroar-bulky-slow-pivot
ursalunabloodmoon-slow-special-breaker
```

The activation script must reject an allowlisted record whose computed or stored `setKey` is empty. During activation it may set `setKey` on the four active records as part of the same transaction. It must not normalize the five blocked records during this phase.

---

## File Structure

- Create `src/config/verifiedToActiveStagingAllowlist.ts`: independent active promotion allowlist and setKey mapping.
- Modify `src/equinox/data-validation/CompetitiveValidationTypes.ts`: add optional `setKey`, `activeRunId`, `activatedAt`, `activatedFromStatus`, `previousVerifiedRunId`, `activationMetadata`, `rolledBackAt`, and `rolledBackFromActiveRunId` fields.
- Modify `src/models/PokemonSet.ts`: add matching Mongo fields and indexes for `setKey`, `activeRunId`, and `activatedAt`.
- Create `src/equinox/competitive/VerifiedToActiveStagingPolicy.ts`: shared guards, state classifiers, setKey resolver, summary types, and invariant helpers.
- Create `src/scripts/promoteVerifiedSetsToActive.ts`: dry-run and transaction-backed activation command.
- Create `src/scripts/rollbackActiveStagingPromotion.ts`: dry-run and transaction-backed rollback command.
- Create `src/scripts/validateActiveStagingPromotion.ts`: Mongo-backed active staging validator.
- Modify `package.json`: add `sets:activate:staging`, `sets:activate:staging:dry`, `sets:activate:staging:check`, and `sets:activate:staging:rollback`.
- Create `docs/data-audit/verified-to-active-staging-promotion-v1-report.md`: dry-run and operational evidence template.
- Create `docs/data-audit/verified-to-active-staging-runbook.md`: post-merge execution sequence.

---

### Task 1: Add Dedicated Active Allowlist And Metadata Types

**Files:**
- Create: `src/config/verifiedToActiveStagingAllowlist.ts`
- Modify: `src/equinox/data-validation/CompetitiveValidationTypes.ts`
- Modify: `src/models/PokemonSet.ts`

**Interfaces:**
- Produces: `VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST`, `VERIFIED_TO_ACTIVE_STAGING_SET_KEYS`, and metadata fields consumed by scripts.
- Consumed by: activation, rollback, active validator, future active-set selectors.

- [ ] **Step 1: Create active allowlist config**

Create `src/config/verifiedToActiveStagingAllowlist.ts`:

```ts
export const VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST = [
  'sinistcha-bulky-trick-room-setter-draft',
  'aggronmega-slow-physical-breaker-draft',
  'incineroar-bulky-slow-pivot-draft',
  'ursalunabloodmoon-slow-special-breaker-draft',
] as const;

export type VerifiedToActiveStagingSetId = typeof VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST[number];

export const VERIFIED_TO_ACTIVE_STAGING_SET_KEYS: Record<VerifiedToActiveStagingSetId, string> = {
  'sinistcha-bulky-trick-room-setter-draft': 'sinistcha-bulky-trick-room-setter',
  'aggronmega-slow-physical-breaker-draft': 'aggronmega-slow-physical-breaker',
  'incineroar-bulky-slow-pivot-draft': 'incineroar-bulky-slow-pivot',
  'ursalunabloodmoon-slow-special-breaker-draft': 'ursalunabloodmoon-slow-special-breaker',
};
```

- [ ] **Step 2: Extend validation type**

Add these fields to `CompetitiveSetValidationInput` in `src/equinox/data-validation/CompetitiveValidationTypes.ts` near the active/verified metadata:

```ts
  setKey?: string;
  activeRunId?: string;
  activatedAt?: string | Date;
  activatedFromStatus?: 'verified';
  previousVerifiedRunId?: string;
  activationMetadata?: {
    runId: string;
    executedAt: string | Date;
    targetCollection: 'pokemonsets_v2_staging';
    sourceStatus: 'verified';
    actor: 'verified-to-active-staging-script';
  };
  rolledBackAt?: string | Date;
  rolledBackFromActiveRunId?: string;
```

- [ ] **Step 3: Extend Mongo model interface**

Add matching fields to `IPokemonSet` in `src/models/PokemonSet.ts`:

```ts
  setKey?: string;
  activeRunId?: string;
  activatedAt?: Date;
  activatedFromStatus?: 'verified';
  previousVerifiedRunId?: string;
  activationMetadata?: {
    runId: string;
    executedAt: Date;
    targetCollection: 'pokemonsets_v2_staging';
    sourceStatus: 'verified';
    actor: 'verified-to-active-staging-script';
  };
  rolledBackAt?: Date;
  rolledBackFromActiveRunId?: string;
```

- [ ] **Step 4: Extend Mongo schema**

Add schema fields near `active`, `verifiedAt`, and `verifiedRunId`:

```ts
  setKey: { type: String, index: true },
  activeRunId: { type: String, index: true },
  activatedAt: { type: Date },
  activatedFromStatus: { type: String, enum: ['verified'] },
  previousVerifiedRunId: { type: String },
  activationMetadata: {
    runId: { type: String },
    executedAt: { type: Date },
    targetCollection: { type: String },
    sourceStatus: { type: String },
    actor: { type: String },
  },
  rolledBackAt: { type: Date },
  rolledBackFromActiveRunId: { type: String },
```

Add a non-unique index for local schema awareness:

```ts
PokemonSetSchema.index({ setKey: 1, active: 1 });
```

The unique partial index is created operationally on `pokemonsets_v2_staging`, not by this model declaration.

- [ ] **Step 5: Run typecheck**

Run:

```powershell
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/config/verifiedToActiveStagingAllowlist.ts src/equinox/data-validation/CompetitiveValidationTypes.ts src/models/PokemonSet.ts
git commit -m "feat: add active staging metadata contract"
```

---

### Task 2: Add Shared Verified-To-Active Policy

**Files:**
- Create: `src/equinox/competitive/VerifiedToActiveStagingPolicy.ts`

**Interfaces:**
- Consumes: active allowlist from `src/config/verifiedToActiveStagingAllowlist.ts`.
- Produces: target guard, environment guard, setKey resolver, document classifier, summary types, and conflict detection helper.

- [ ] **Step 1: Create constants and types**

Create `src/equinox/competitive/VerifiedToActiveStagingPolicy.ts`:

```ts
import { VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST, VERIFIED_TO_ACTIVE_STAGING_SET_KEYS } from '../../config/verifiedToActiveStagingAllowlist';

export const ACTIVE_STAGING_TARGET_COLLECTION = 'pokemonsets_v2_staging';
export const ACTIVE_STAGING_PRODUCTION_COLLECTION = 'pokemonsets';

export interface ActiveStagingDocument {
  setId?: string;
  setKey?: string;
  status?: string;
  active?: boolean;
  sourceType?: string;
  verifiedRunId?: string;
  activeRunId?: string;
  activatedAt?: Date | string;
}

export interface ActivePromotionSummary {
  mode: 'dry-run' | 'execute';
  activeRunId?: string;
  targetCollection: string;
  recordsAllowlisted: number;
  recordsFound: number;
  recordsEligible: number;
  recordsAlreadyActive: number;
  recordsBlocked: number;
  activeConflicts: number;
  recordsActivated: number;
  recordsWritten: number;
  generatedActivated: number;
  productionWrites: 0;
}
```

- [ ] **Step 2: Add target and execute guards**

Implement:

```ts
export function assertActiveStagingTarget(targetCollection: string | undefined): string {
  if (targetCollection === ACTIVE_STAGING_PRODUCTION_COLLECTION) {
    throw new Error('Active staging promotion blocked: production collection pokemonsets is not allowed.');
  }
  if (targetCollection !== ACTIVE_STAGING_TARGET_COLLECTION) {
    throw new Error(`Active staging promotion requires EQUINOX_TARGET_COLLECTION=${ACTIVE_STAGING_TARGET_COLLECTION}.`);
  }
  return targetCollection;
}

export function assertActiveExecuteAuthorized(): string {
  const targetCollection = process.env.EQUINOX_TARGET_COLLECTION;
  const failures = [
    targetCollection === ACTIVE_STAGING_PRODUCTION_COLLECTION ? 'production collection pokemonsets is not allowed' : null,
    targetCollection === ACTIVE_STAGING_TARGET_COLLECTION ? null : `EQUINOX_TARGET_COLLECTION=${ACTIVE_STAGING_TARGET_COLLECTION} is required`,
    process.env.EQUINOX_DATA_MODE === 'mongo' ? null : 'EQUINOX_DATA_MODE=mongo is required',
    process.env.EQUINOX_ALLOW_DATABASE_WRITES === 'true' ? null : 'EQUINOX_ALLOW_DATABASE_WRITES=true is required',
    process.env.EQUINOX_ENABLE_STAGING_ACTIVATION === 'true' ? null : 'EQUINOX_ENABLE_STAGING_ACTIVATION=true is required',
  ].filter((failure): failure is string => Boolean(failure));

  if (failures.length > 0) {
    console.log('recordsWritten: 0');
    console.log('productionWrites: 0');
    throw new Error(`Active staging execute refused:\n- ${failures.join('\n- ')}`);
  }

  return assertActiveStagingTarget(targetCollection);
}
```

- [ ] **Step 3: Add setKey resolver**

Implement:

```ts
export function resolveActivationSetKey(document: ActiveStagingDocument): string {
  const setId = String(document.setId ?? '');
  const mapped = VERIFIED_TO_ACTIVE_STAGING_SET_KEYS[setId as keyof typeof VERIFIED_TO_ACTIVE_STAGING_SET_KEYS];
  const setKey = String(document.setKey ?? mapped ?? '').trim();
  if (!setKey) throw new Error(`Active staging promotion requires setKey for ${setId || 'unknown setId'}.`);
  return setKey;
}
```

- [ ] **Step 4: Add state guards**

Implement:

```ts
export function assertNoInconsistentActiveState(document: ActiveStagingDocument): void {
  const setId = String(document.setId ?? 'unknown');
  if (document.status === 'active' && document.active !== true) {
    throw new Error(`${setId} is inconsistent: status active requires active true.`);
  }
  if (document.status === 'verified' && document.active === true) {
    throw new Error(`${setId} is inconsistent: status verified cannot have active true.`);
  }
}

export function isAllowlistedForActivation(setId: string): boolean {
  return VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST.includes(setId as never);
}
```

- [ ] **Step 5: Run typecheck**

Run:

```powershell
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/equinox/competitive/VerifiedToActiveStagingPolicy.ts
git commit -m "feat: add verified to active staging policy"
```

---

### Task 3: Add Active Staging Validator

**Files:**
- Create: `src/scripts/validateActiveStagingPromotion.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `VerifiedToActiveStagingPolicy` and active allowlist.
- Produces: `sets:activate:staging:check`.

- [ ] **Step 1: Add package script**

Add to `package.json` scripts:

```json
"sets:activate:staging:check": "ts-node src/scripts/validateActiveStagingPromotion.ts"
```

- [ ] **Step 2: Create validator script**

Create `src/scripts/validateActiveStagingPromotion.ts` with:

```ts
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { resolveDataMode } from '../config/dataMode';
import { VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST } from '../config/verifiedToActiveStagingAllowlist';
import {
  ACTIVE_STAGING_TARGET_COLLECTION,
  assertActiveStagingTarget,
  isAllowlistedForActivation,
  resolveActivationSetKey,
} from '../equinox/competitive/VerifiedToActiveStagingPolicy';

interface ActiveStagingCheckSummary {
  mode: 'filesystem' | 'mongo' | 'shadow';
  mongoRead: boolean;
  targetCollection: string;
  pilotRecordsFound: number;
  allowlistedRecordsFound: number;
  allowlistedVerified: number;
  allowlistedActive: number;
  blockedRecordsFound: number;
  blockedRecordsStillReviewed: number;
  blockedRecordsActive: number;
  generatedActive: number;
  activeConflicts: number;
  duplicateSetIds: number;
  activeRunIds: string[];
  sameActiveRunIdForAllowlist: boolean;
  productionWrites: 0;
  recordsWritten: 0;
}
```

- [ ] **Step 3: Implement filesystem-safe path**

When `resolveDataMode() !== 'mongo'`, print:

```ts
{
  mode: resolveDataMode(),
  mongoRead: false,
  targetCollection: process.env.EQUINOX_TARGET_COLLECTION ?? 'not-configured',
  pilotRecordsFound: 0,
  allowlistedRecordsFound: 0,
  allowlistedVerified: 0,
  allowlistedActive: 0,
  blockedRecordsFound: 0,
  blockedRecordsStillReviewed: 0,
  blockedRecordsActive: 0,
  generatedActive: 0,
  activeConflicts: 0,
  duplicateSetIds: 0,
  activeRunIds: [],
  sameActiveRunIdForAllowlist: false,
  productionWrites: 0,
  recordsWritten: 0,
}
```

- [ ] **Step 4: Implement Mongo read path**

Read only from:

```ts
const targetCollection = assertActiveStagingTarget(process.env.EQUINOX_TARGET_COLLECTION);
const collection = mongoose.connection.collection(targetCollection);
const docs = await collection.find({}).toArray();
```

Compute:

```ts
const allowlistedDocs = docs.filter(doc => isAllowlistedForActivation(String(doc.setId)));
const blockedDocs = docs.filter(doc => !isAllowlistedForActivation(String(doc.setId)));
const activeDocs = docs.filter(doc => doc.active === true || doc.status === 'active');
const activeRunIds = [...new Set(allowlistedDocs.filter(doc => doc.status === 'active' && doc.active === true).map(doc => String(doc.activeRunId ?? 'missing')))];
```

For conflicts, group active docs by resolved setKey and count groups with more than one active document:

```ts
const activeSetKeys = new Map<string, number>();
for (const doc of activeDocs) {
  const setKey = resolveActivationSetKey(doc);
  activeSetKeys.set(setKey, (activeSetKeys.get(setKey) ?? 0) + 1);
}
const activeConflicts = [...activeSetKeys.values()].filter(count => count > 1).length;
```

- [ ] **Step 5: Add validator assertions**

The script must pass before activation and after activation. It must fail only on safety violations:

```ts
if (summary.targetCollection !== ACTIVE_STAGING_TARGET_COLLECTION) throw new Error('wrong target collection');
if (summary.pilotRecordsFound !== 9) throw new Error('expected 9 pilot records');
if (summary.allowlistedRecordsFound !== 4) throw new Error('expected 4 allowlisted records');
if (summary.blockedRecordsFound !== 5) throw new Error('expected 5 blocked records');
if (summary.blockedRecordsActive !== 0) throw new Error('blocked records must not be active');
if (summary.generatedActive !== 0) throw new Error('generated records must not be active');
if (summary.activeConflicts !== 0) throw new Error('active conflicts must be 0');
if (summary.duplicateSetIds !== 0) throw new Error('duplicate setIds must be 0');
if (summary.productionWrites !== 0 || summary.recordsWritten !== 0) throw new Error('validator must not write');
```

- [ ] **Step 6: Close Mongo in finally**

Use:

```ts
finally {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
```

- [ ] **Step 7: Verify local safe mode**

Run:

```powershell
npm.cmd run sets:activate:staging:check
npm.cmd run typecheck
```

Expected in filesystem mode: PASS with `mongoRead: false` and `recordsWritten: 0`.

- [ ] **Step 8: Commit**

```powershell
git add src/scripts/validateActiveStagingPromotion.ts package.json
git commit -m "feat: add active staging validator"
```

---

### Task 4: Implement Dry-Run Activation Command

**Files:**
- Create: `src/scripts/promoteVerifiedSetsToActive.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: active policy and allowlist.
- Produces: `sets:activate:staging` and `sets:activate:staging:dry` with zero writes by default.

- [ ] **Step 1: Add package scripts**

Add:

```json
"sets:activate:staging": "ts-node src/scripts/promoteVerifiedSetsToActive.ts",
"sets:activate:staging:dry": "ts-node src/scripts/promoteVerifiedSetsToActive.ts --dry-run"
```

- [ ] **Step 2: Create script shell**

Create `src/scripts/promoteVerifiedSetsToActive.ts`:

```ts
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { resolveDataMode } from '../config/dataMode';
import { VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST } from '../config/verifiedToActiveStagingAllowlist';
import {
  ActivePromotionSummary,
  assertActiveExecuteAuthorized,
  assertActiveStagingTarget,
  assertNoInconsistentActiveState,
  isAllowlistedForActivation,
  resolveActivationSetKey,
} from '../equinox/competitive/VerifiedToActiveStagingPolicy';

const execute = process.argv.includes('--execute');
const dryRun = process.argv.includes('--dry-run') || !execute;
```

- [ ] **Step 3: Add summary printer**

Implement:

```ts
function printSummary(summary: ActivePromotionSummary): void {
  console.log(JSON.stringify(summary, null, 2));
  console.log(`recordsAllowlisted: ${summary.recordsAllowlisted}`);
  console.log(`recordsFound: ${summary.recordsFound}`);
  console.log(`recordsEligible: ${summary.recordsEligible}`);
  console.log(`recordsAlreadyActive: ${summary.recordsAlreadyActive}`);
  console.log(`recordsBlocked: ${summary.recordsBlocked}`);
  console.log(`activeConflicts: ${summary.activeConflicts}`);
  console.log(`recordsActivated: ${summary.recordsActivated}`);
  console.log(`recordsWritten: ${summary.recordsWritten}`);
  console.log(`generatedActivated: ${summary.generatedActivated}`);
  console.log(`productionWrites: ${summary.productionWrites}`);
}
```

- [ ] **Step 4: Implement Mongo read analysis**

Create `buildActivationSummary(collection, targetCollection, mode)` that reads all docs, filters allowlist, validates inconsistent states, resolves setKeys, and computes:

```text
recordsAllowlisted = 4
recordsFound = allowlistedDocs.length
recordsEligible = allowlisted verified, active !== true, sourceType curated, verifiedRunId present
recordsAlreadyActive = allowlisted active true and status active
recordsBlocked = non-allowlisted docs count
activeConflicts = active setKey conflicts
recordsActivated = 0 for dry-run
recordsWritten = 0 for dry-run
generatedActivated = active generated count
productionWrites = 0
```

- [ ] **Step 5: Implement dry-run behavior**

If `dryRun` and `resolveDataMode() !== 'mongo'`, print a safe zero-write summary with `targetCollection` from env or `not-configured`.

If `dryRun` and `resolveDataMode() === 'mongo'`, require target collection to be staging, connect, compute real summary, print it, disconnect.

- [ ] **Step 6: Verify dry-run**

Run:

```powershell
npm.cmd run sets:activate:staging
npm.cmd run sets:activate:staging:dry
npm.cmd run typecheck
```

Expected local filesystem: zero writes. Expected Mongo staging before activation: 4 eligible, 0 active, 0 conflicts.

- [ ] **Step 7: Commit**

```powershell
git add src/scripts/promoteVerifiedSetsToActive.ts package.json
git commit -m "feat: add verified to active dry run"
```

---

### Task 5: Add Transactional Activation Execute Mode

**Files:**
- Modify: `src/scripts/promoteVerifiedSetsToActive.ts`

**Interfaces:**
- Consumes: dry-run analysis from Task 4.
- Produces: transaction-backed active promotion with four writes or zero writes.

- [ ] **Step 1: Add execute authorization**

When `execute === true`, call:

```ts
const targetCollection = assertActiveExecuteAuthorized();
```

If any flag is missing, print `recordsWritten: 0` and fail before `connectDatabase()`.

- [ ] **Step 2: Add transaction wrapper**

Implement:

```ts
const session = await mongoose.connection.startSession();
try {
  await session.withTransaction(async () => {
    // re-read allowlisted docs with session
    // re-run all preconditions
    // create partial index if absent
    // update exactly 4 docs
    // validate post-write counts
  });
} finally {
  await session.endSession();
}
```

- [ ] **Step 3: Create partial unique index inside execute path**

Before update, create the staging-only partial index on the target collection:

```ts
await collection.createIndex(
  { setKey: 1 },
  {
    unique: true,
    partialFilterExpression: { active: true },
    name: 'uq_staging_one_active_per_set_key',
    session,
  } as never,
);
```

If the driver rejects `session` for `createIndex`, create the index before the transaction after all prechecks pass, then re-run prechecks inside the transaction.

- [ ] **Step 4: Re-run preconditions in transaction**

Inside the transaction, require:

```text
recordsFound === 4
recordsEligible === 4
recordsAlreadyActive === 0
activeConflicts === 0
generatedActivated === 0
all four sourceType === curated
all four status === verified
all four active !== true
all four verifiedRunId present
```

- [ ] **Step 5: Update exactly four documents**

Use a single `updateMany` with session:

```ts
const activeRunId = `active-staging-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const now = new Date();
const result = await collection.updateMany(
  {
    setId: { $in: VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST },
    status: 'verified',
    active: { $ne: true },
    sourceType: 'curated',
    verifiedRunId: { $exists: true, $type: 'string' },
  },
  {
    $set: {
      status: 'active',
      active: true,
      activeRunId,
      activatedAt: now,
      activatedFromStatus: 'verified',
      activationMetadata: {
        runId: activeRunId,
        executedAt: now,
        targetCollection: 'pokemonsets_v2_staging',
        sourceStatus: 'verified',
        actor: 'verified-to-active-staging-script',
      },
    },
  },
  { session },
);
```

Because each set has a specific setKey, if `updateMany` cannot assign individual setKey values, use `bulkWrite` with four `updateOne` operations inside the transaction. The operation is still all-or-zero because it is inside one transaction.

Each update must set:

```ts
setKey: resolvedSetKey
previousVerifiedRunId: original verifiedRunId
```

- [ ] **Step 6: Enforce exact write count**

After write inside transaction:

```ts
if (result.modifiedCount !== 4) throw new Error(`Active staging activation must write exactly 4 records, wrote ${result.modifiedCount}.`);
```

Then re-read allowlisted docs with session and require:

```text
allowlistedActive === 4
same activeRunId on all four
activeConflicts === 0
generatedActive === 0
```

- [ ] **Step 7: Verify execute refusal and dry-run**

Run without flags:

```powershell
npm.cmd run sets:activate:staging -- --execute
```

Expected: FAIL before Mongo write with `recordsWritten: 0`.

Run:

```powershell
npm.cmd run sets:activate:staging:dry
npm.cmd run typecheck
npm.cmd run build
git diff --check
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/scripts/promoteVerifiedSetsToActive.ts
git commit -m "feat: add transactional staging activation"
```

---

### Task 6: Add Active Rollback Command

**Files:**
- Create: `src/scripts/rollbackActiveStagingPromotion.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: active policy and allowlist.
- Produces: rollback by `activeRunId` with dry-run default and transaction-backed execute.

- [ ] **Step 1: Add package script**

Add:

```json
"sets:activate:staging:rollback": "ts-node src/scripts/rollbackActiveStagingPromotion.ts"
```

- [ ] **Step 2: Create rollback script**

Create argument parsing:

```ts
const execute = process.argv.includes('--execute');
const dryRun = process.argv.includes('--dry-run') || !execute;
const runId = process.argv.find(arg => arg.startsWith('--run-id='))?.slice('--run-id='.length);
```

- [ ] **Step 3: Authorize execute**

Rollback execute must require:

```text
--run-id present
EQUINOX_DATA_MODE=mongo
EQUINOX_TARGET_COLLECTION=pokemonsets_v2_staging
EQUINOX_ALLOW_DATABASE_WRITES=true
EQUINOX_ENABLE_STAGING_ACTIVATION=true
```

Missing any condition prints `recordsWritten: 0` and fails before write.

- [ ] **Step 4: Implement rollback dry-run**

Filter:

```ts
{
  setId: { $in: VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST },
  activeRunId: runId,
  status: 'active',
  active: true,
}
```

Dry-run summary:

```text
recordsEligibleForRollback
recordsRolledBack: 0
recordsWritten: 0
recordsStillActive
productionWrites: 0
```

- [ ] **Step 5: Implement transaction-backed rollback**

Inside a transaction, update:

```ts
{
  $set: {
    status: 'verified',
    active: false,
    rolledBackAt: new Date(),
    rolledBackFromActiveRunId: runId,
  },
  $unset: {
    activeRunId: '',
    activatedAt: '',
    activatedFromStatus: '',
    previousVerifiedRunId: '',
    activationMetadata: '',
  },
}
```

Preserve `verifiedRunId`.

Require `modifiedCount === 4` for the first real rollback and allow `0` only in dry-run or second rollback mode. In execute mode, if `recordsEligibleForRollback` is `0`, print idempotent zero-write summary and exit 0.

- [ ] **Step 6: Verify safe paths**

Run:

```powershell
npm.cmd run sets:activate:staging:rollback
npm.cmd run sets:activate:staging:rollback -- --execute
npm.cmd run typecheck
npm.cmd run build
git diff --check
```

Expected: dry-run writes zero; execute without run ID fails before write; typecheck/build pass.

- [ ] **Step 7: Commit**

```powershell
git add src/scripts/rollbackActiveStagingPromotion.ts package.json
git commit -m "feat: add active staging rollback"
```

---

### Task 7: Add Runbook And Evidence Report

**Files:**
- Create: `docs/data-audit/verified-to-active-staging-promotion-v1-report.md`
- Create: `docs/data-audit/verified-to-active-staging-runbook.md`

**Interfaces:**
- Consumes: command outputs from Tasks 3-6.
- Produces: human-readable operator evidence and post-merge operational order.

- [ ] **Step 1: Create report template**

Create `docs/data-audit/verified-to-active-staging-promotion-v1-report.md` with sections:

```markdown
# Verified To Active Staging Promotion V1 Report

## Scope

## Allowlist

## Pre-Activation Check

## Dry-Run Result

## Execute Result

## Idempotency Result

## Rollback Dry-Run Result

## Rollback Execute Result

## Final Activation Result

## Final State

## Safety Confirmation
```

Include the expected final state:

```text
allowlistedActive: 4
allowlistedVerified: 0
blockedRecordsStillReviewed: 5
blockedRecordsActive: 0
generatedActive: 0
activeConflicts: 0
productionWrites: 0
```

- [ ] **Step 2: Create runbook**

Create `docs/data-audit/verified-to-active-staging-runbook.md` with exact commands from the spec:

```powershell
$env:EQUINOX_DATA_MODE="mongo"
$env:EQUINOX_TARGET_COLLECTION="pokemonsets_v2_staging"
$env:EQUINOX_ALLOW_DATABASE_WRITES="false"
$env:EQUINOX_ENABLE_STAGING_ACTIVATION="false"

npm.cmd run mongo:snapshot
npm.cmd run sets:activate:staging:check
npm.cmd run sets:activate:staging:dry
```

Add execute blocks that always close flags in `finally`.

- [ ] **Step 3: Commit**

```powershell
git add docs/data-audit/verified-to-active-staging-promotion-v1-report.md docs/data-audit/verified-to-active-staging-runbook.md
git commit -m "docs: add active staging operation runbook"
```

---

### Task 8: Final Local Verification And PR Handoff

**Files:**
- Read all changed files.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: branch ready for PR. Real activation remains post-merge and approval-gated.

- [ ] **Step 1: Run local validations**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run sets:activate:staging
npm.cmd run sets:activate:staging:dry
npm.cmd run sets:activate:staging:check
npm.cmd run sets:activate:staging:rollback
npm.cmd run build
git diff --check
```

Expected in filesystem mode: all commands write zero records and do not require Mongo.

- [ ] **Step 2: Verify execute refusal**

Run:

```powershell
npm.cmd run sets:activate:staging -- --execute
npm.cmd run sets:activate:staging:rollback -- --execute
```

Expected: both fail before any Mongo write with `recordsWritten: 0`.

- [ ] **Step 3: Confirm branch state**

Run:

```powershell
git status --short
git --no-pager log --oneline --decorate -12
```

Expected: no uncommitted changes.

- [ ] **Step 4: Push branch and open PR**

Use:

```powershell
git push -u origin feature/verified-to-active-staging-promotion-v1
```

PR target:

```text
Base: develop
Compare: feature/verified-to-active-staging-promotion-v1
```

Recommended title:

```text
feat: add verified to active staging promotion workflow
```

- [ ] **Step 5: Do not run real activation in implementation PR**

Real activation starts only after merge and explicit approval. Final operational sequence:

```text
snapshot pre-operation
active staging check
dry-run
execute activation
post-check
idempotency execute
rollback dry-run
rollback execute
rollback validation
final activation
final validation
```

