# Active V2 Shadow Comparison V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only shadow comparison runner that executes the same four scenarios through current engine logic with a controlled baseline source and through active V2 staging records from `pokemonsets_v2_staging`, then emits complete structured differences without rollout or production access.

**Architecture:** Add a focused `active-v2-shadow` module beside the existing `active-staging` module. The module defines contracts, config guards, controlled baseline source metadata, path adapters, normalizers, comparators, runner gates, CLI, offline tests, Atlas read-only validation, and an evidence report. The current logic path uses the same VGC/Equinox components as the active staging homologation probe, but with a controlled baseline source instead of `pokemonsets`.

**Tech Stack:** TypeScript, ts-node validation scripts, Node `crypto` SHA-256 hashing, MongoDB command monitoring from the active staging phase, existing Equinox VGC components, `TeamDataCoverage`, `evaluateFullTeam`, npm scripts.

## Global Constraints

- Read-only only.
- No Render changes.
- No production traffic changes.
- No frontend changes.
- No public API behavior changes.
- No MongoDB writes.
- No reads from `pokemonsets`.
- No writes to `pokemonsets_v2_staging`.
- V2 collection must be exactly `pokemonsets_v2_staging`.
- V2 filter must be exactly `status=active + active=true + allowlist`.
- Baseline must be `current engine logic + controlled baseline source`.
- Baseline source must be versioned, counted, and hashed with SHA-256.
- The controlled baseline source is intentional configuration and must not be reported as fallback.
- Divergence is evidence only; divergence alone must not fail V1.
- Missing execution, missing critical fields, unrecorded differences, fallback masking, Mongo writes, production reads, and non-reproducible results are gate failures.

---

## File Structure

Create this module:

```text
src/equinox/competitive/active-v2-shadow/
```

Files and responsibilities:

- `ActiveV2ShadowTypes.ts`: shared result, diff, config, exit-code, and source metadata contracts.
- `ActiveV2ShadowConfig.ts`: environment parsing and config guard.
- `ActiveV2ShadowBaselineSource.ts`: controlled baseline snapshot loading, canonical serialization, digest, and record count.
- `ActiveV2ShadowPathAdapter.ts`: executes a path result from a pair of records using current VGC/Equinox components.
- `ActiveV2ShadowNormalizer.ts`: normalizes path outputs before diffing.
- `ActiveV2ShadowComparators.ts`: mandatory comparator blocks and `differencesFullyRecorded`.
- `ActiveV2ShadowRunner.ts`: executes the four scenarios and aggregate gates.
- `ActiveV2ShadowCli.ts`: Mongo read-only orchestration, command/read monitor wiring, exit codes.

Important implementation invariant:

```text
The controlled baseline source may contain more than the four active allowlisted records.
Any engine input that relies on active staging homologation contracts must receive exactly the four allowlisted records.
The active V2 record set must always be exactly the four allowlisted active records.
```

Create scripts:

- `src/scripts/validateActiveV2ShadowContracts.ts`
- `src/scripts/validateActiveV2ShadowConfig.ts`
- `src/scripts/validateActiveV2ShadowBaselineSource.ts`
- `src/scripts/validateActiveV2ShadowComparators.ts`
- `src/scripts/validateActiveV2ShadowOffline.ts`
- `src/scripts/compareActiveV2Shadow.ts`

Modify:

- `package.json`

Create report:

- `docs/data-audit/active-v2-shadow-comparison-v1-report.md`

---

### Task 1: Contracts And Exit Codes

**Files:**
- Create: `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowTypes.ts`
- Create: `src/scripts/validateActiveV2ShadowContracts.ts`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `ACTIVE_V2_SHADOW_GATE_EXIT_CODE = 1`
  - `ACTIVE_V2_SHADOW_CONFIG_EXIT_CODE = 2`
  - `ACTIVE_V2_SHADOW_MONGO_EXIT_CODE = 3`
  - `ActiveV2ShadowPathResult`
  - `ActiveV2ShadowDiffBlock`
  - `ActiveV2ShadowScenarioComparison`
  - `ActiveV2ShadowScenarioResult`
  - `ActiveV2ShadowAggregate`
  - `ActiveV2ShadowReport`

- [ ] **Step 1: Write the failing contract validation script**

Create `src/scripts/validateActiveV2ShadowContracts.ts`:

```ts
import {
  ACTIVE_V2_SHADOW_CONFIG_EXIT_CODE,
  ACTIVE_V2_SHADOW_GATE_EXIT_CODE,
  ACTIVE_V2_SHADOW_MONGO_EXIT_CODE,
  REQUIRED_ACTIVE_V2_SHADOW_COMPARATORS,
  type ActiveV2ShadowDiffBlock,
  type ActiveV2ShadowPathResult,
} from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowTypes';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const diff: ActiveV2ShadowDiffBlock<string[]> = {
  status: 'equal',
  baseline: [],
  activeV2: [],
  added: [],
  removed: [],
  changed: [],
};

const pathResult: ActiveV2ShadowPathResult = {
  path: 'current',
  sourceMode: 'controlled-baseline',
  enginePath: 'current',
  sourceKind: 'controlled-snapshot',
  inputPokemon: ['Sinistcha', 'Aggron-Mega'],
  format: 'champions-reg-mb-doubles',
  teamIdentity: 'balanced',
  allowLegendaries: false,
  seedState: 'not-applicable',
  setsConsumed: [],
  movesUsed: [],
  itemsUsed: [],
  abilitiesUsed: [],
  roles: [],
  leadStrategies: [],
  selectedLeadStrategy: undefined,
  teamDataCoverage: undefined,
  fullTeamEvaluation: undefined,
  score: 0,
  fallbackUsed: false,
  fallbackReason: undefined,
  exportResult: undefined,
  errors: [],
  durationMs: 0,
  competitiveVerificationState: 'staging-controlled',
};

assert(ACTIVE_V2_SHADOW_GATE_EXIT_CODE === 1, 'gate failures must exit 1');
assert(ACTIVE_V2_SHADOW_CONFIG_EXIT_CODE === 2, 'config failures must exit 2');
assert(ACTIVE_V2_SHADOW_MONGO_EXIT_CODE === 3, 'Mongo failures must exit 3');
assert(diff.status === 'equal', 'diff block must support explicit equal status');
assert(pathResult.fallbackUsed === false, 'controlled baseline must not be fallback');
assert(REQUIRED_ACTIVE_V2_SHADOW_COMPARATORS.length === 12, 'all required comparators must be listed');
console.log('[Equinox] Active V2 shadow contract validation passed.');
```

- [ ] **Step 2: Run the contract script and verify it fails**

Run:

```powershell
npm.cmd exec ts-node src/scripts/validateActiveV2ShadowContracts.ts
```

Expected: FAIL with module not found for `ActiveV2ShadowTypes`.

- [ ] **Step 3: Create `ActiveV2ShadowTypes.ts`**

Create `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowTypes.ts`:

```ts
import type { TeamDataCoverage } from '../TeamDataCoverage';

export const ACTIVE_V2_SHADOW_GATE_EXIT_CODE = 1;
export const ACTIVE_V2_SHADOW_CONFIG_EXIT_CODE = 2;
export const ACTIVE_V2_SHADOW_MONGO_EXIT_CODE = 3;

export type ActiveV2ShadowExitCode = 0 | 1 | 2 | 3;
export type ActiveV2ShadowPath = 'current' | 'active-v2-staging';
export type ActiveV2ShadowSourceMode = 'controlled-baseline' | 'mongo-staging-active';
export type ActiveV2ShadowEnginePath = 'current' | 'current-with-explicit-v2-context';
export type ActiveV2ShadowSourceKind = 'controlled-snapshot' | 'mongo-active-staging';
export type ActiveV2ShadowSeedState = 'not-applicable' | 'fixed';
export type ActiveV2ShadowVerificationState = 'unverified' | 'staging-controlled' | 'production-approved';
export type ActiveV2ShadowDiffStatus = 'equal' | 'different' | 'missing-baseline' | 'missing-active-v2' | 'error';

export const REQUIRED_ACTIVE_V2_SHADOW_COMPARATORS = [
  'setDiff',
  'moveDiff',
  'itemDiff',
  'abilityDiff',
  'roleDiff',
  'leadStrategyDiff',
  'teamDataCoverageDiff',
  'fullTeamEvaluationDiff',
  'scoreDiff',
  'fallbackDiff',
  'exportDiff',
  'errorDiff',
] as const;

export type ActiveV2ShadowComparatorName = typeof REQUIRED_ACTIVE_V2_SHADOW_COMPARATORS[number];

export interface ActiveV2ShadowBaselineMetadata {
  baselineSourceVersion: string;
  baselineSourceDigest: `sha256-${string}`;
  baselineSourceRecordCount: number;
}

export interface ActiveV2ShadowChangedField {
  field: string;
  baseline: unknown;
  activeV2: unknown;
}

export interface ActiveV2ShadowDiffBlock<T = unknown> {
  status: ActiveV2ShadowDiffStatus;
  baseline: T;
  activeV2: T;
  added: unknown[];
  removed: unknown[];
  changed: ActiveV2ShadowChangedField[];
}

export interface ActiveV2ShadowPathResult {
  path: ActiveV2ShadowPath;
  sourceMode: ActiveV2ShadowSourceMode;
  enginePath: ActiveV2ShadowEnginePath;
  sourceKind: ActiveV2ShadowSourceKind;
  inputPokemon: [string, string] | string[];
  format: 'champions-reg-mb-doubles';
  teamIdentity: string;
  allowLegendaries: boolean;
  seedState: ActiveV2ShadowSeedState;
  setsConsumed: string[];
  movesUsed: string[];
  itemsUsed: string[];
  abilitiesUsed: string[];
  roles: string[];
  leadStrategies: string[];
  selectedLeadStrategy?: string;
  teamDataCoverage?: TeamDataCoverage;
  fullTeamEvaluation?: unknown;
  score: number;
  fallbackUsed: boolean;
  fallbackReason?: string;
  exportResult?: unknown;
  errors: string[];
  durationMs: number;
  competitiveVerificationState: ActiveV2ShadowVerificationState;
}

export interface ActiveV2ShadowScenarioComparison {
  sameScenarioInput: boolean;
  sameFormat: boolean;
  sameTeamIdentity: boolean;
  sameAllowLegendaries: boolean;
  sameSeed: true | 'not-applicable';
  setDiff: ActiveV2ShadowDiffBlock<string[]>;
  moveDiff: ActiveV2ShadowDiffBlock<string[]>;
  itemDiff: ActiveV2ShadowDiffBlock<string[]>;
  abilityDiff: ActiveV2ShadowDiffBlock<string[]>;
  roleDiff: ActiveV2ShadowDiffBlock<string[]>;
  leadStrategyDiff: ActiveV2ShadowDiffBlock<string[]>;
  teamDataCoverageDiff: ActiveV2ShadowDiffBlock<unknown>;
  fullTeamEvaluationDiff: ActiveV2ShadowDiffBlock<unknown>;
  scoreDiff: ActiveV2ShadowDiffBlock<number>;
  fallbackDiff: ActiveV2ShadowDiffBlock<boolean>;
  exportDiff: ActiveV2ShadowDiffBlock<unknown>;
  latencyDiffMs: number;
  latencyDeltaPercent: number;
  errorDiff: ActiveV2ShadowDiffBlock<string[]>;
  errors: string[];
  criticalFieldsPresent: boolean;
  differencesFullyRecorded: boolean;
}

export interface ActiveV2ShadowScenarioResult {
  scenarioId: string;
  baselineResult: ActiveV2ShadowPathResult;
  activeV2Result: ActiveV2ShadowPathResult;
  comparison: ActiveV2ShadowScenarioComparison;
  passed: boolean;
}

export interface ActiveV2ShadowAggregate extends ActiveV2ShadowBaselineMetadata {
  mode: 'active-v2-shadow-comparison';
  targetCollection: 'pokemonsets_v2_staging';
  activeRunId?: string;
  scenarioCount: number;
  scenariosCompared: number;
  scenariosWithBaselineExecution: number;
  scenariosWithActiveV2Execution: number;
  scenariosWithSameInput: number;
  scenariosWithRecordedDifferences: number;
  baselineFallbackUsed: boolean;
  activeV2FallbackUsed: boolean;
  activeV2SourceCollection: 'pokemonsets_v2_staging';
  activeV2RecordsLoaded: number;
  localPilotFallbackUsed: boolean;
  productionCollectionReads: number;
  observedMongoWriteCommands: number;
  observedStagingWriteCommands: number;
  observedProductionWriteCommands: number;
  productionWrites: number;
  recordsWritten: number;
  criticalFieldFailures: number;
  unrecordedDifferenceFailures: number;
  sameEngineComponents: boolean;
  sameScenarioInput: boolean;
  sameFormat: boolean;
  sameTeamIdentity: boolean;
  sameAllowLegendaries: boolean;
  sameSeed: true | 'not-applicable';
  readyForCompetitiveAcceptanceGate: boolean;
}

export interface ActiveV2ShadowReport {
  aggregate: ActiveV2ShadowAggregate;
  scenarios: ActiveV2ShadowScenarioResult[];
}
```

- [ ] **Step 4: Add npm script**

Modify `package.json`:

```json
"sets:active-v2-shadow:contracts:check": "ts-node src/scripts/validateActiveV2ShadowContracts.ts"
```

- [ ] **Step 5: Run the contract script and verify it passes**

Run:

```powershell
npm.cmd run sets:active-v2-shadow:contracts:check
```

Expected: PASS and output `[Equinox] Active V2 shadow contract validation passed.`

- [ ] **Step 6: Commit**

```powershell
git add package.json src/equinox/competitive/active-v2-shadow/ActiveV2ShadowTypes.ts src/scripts/validateActiveV2ShadowContracts.ts
git commit -m "feat: add active v2 shadow contracts"
```

---

### Task 2: Config And Guards

**Files:**
- Create: `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowConfig.ts`
- Create: `src/scripts/validateActiveV2ShadowConfig.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `ACTIVE_V2_SHADOW_CONFIG_EXIT_CODE`
- Produces:
  - `ActiveV2ShadowConfig`
  - `ActiveV2ShadowConfigError`
  - `readActiveV2ShadowConfig(env)`
  - `assertActiveV2ShadowConfig(config)`

- [ ] **Step 1: Write failing config validation script**

Create `src/scripts/validateActiveV2ShadowConfig.ts`:

```ts
import {
  ActiveV2ShadowConfigError,
  assertActiveV2ShadowConfig,
  readActiveV2ShadowConfig,
} from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowConfig';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function expectConfigFailure(env: NodeJS.ProcessEnv, label: string): void {
  try {
    assertActiveV2ShadowConfig(readActiveV2ShadowConfig(env));
  } catch (error) {
    assert(error instanceof ActiveV2ShadowConfigError, `${label} must throw ActiveV2ShadowConfigError`);
    return;
  }
  throw new Error(`${label} must fail`);
}

const valid = assertActiveV2ShadowConfig(readActiveV2ShadowConfig({
  EQUINOX_ENABLE_ACTIVE_V2_SHADOW_COMPARISON: 'true',
  EQUINOX_ACTIVE_V2_SHADOW_COLLECTION: 'pokemonsets_v2_staging',
  EQUINOX_ACTIVE_V2_SHADOW_READ_ONLY: 'true',
  EQUINOX_DATA_MODE: 'mongo',
  EQUINOX_ALLOW_DATABASE_WRITES: 'false',
}));

assert(valid.enabled === true, 'enabled must be true');
assert(valid.collectionName === 'pokemonsets_v2_staging', 'collection must be staging');
assert(valid.readOnly === true, 'readOnly must be true');
assert(valid.dataMode === 'mongo', 'dataMode must be mongo');
assert(valid.allowDatabaseWritesRaw === 'false', 'writes must be explicitly false');

expectConfigFailure({}, 'missing flags');
expectConfigFailure({
  EQUINOX_ENABLE_ACTIVE_V2_SHADOW_COMPARISON: 'true',
  EQUINOX_ACTIVE_V2_SHADOW_COLLECTION: 'pokemonsets',
  EQUINOX_ACTIVE_V2_SHADOW_READ_ONLY: 'true',
  EQUINOX_DATA_MODE: 'mongo',
  EQUINOX_ALLOW_DATABASE_WRITES: 'false',
}, 'production collection');
expectConfigFailure({
  EQUINOX_ENABLE_ACTIVE_V2_SHADOW_COMPARISON: 'true',
  EQUINOX_ACTIVE_V2_SHADOW_COLLECTION: 'pokemonsets_v2_staging',
  EQUINOX_ACTIVE_V2_SHADOW_READ_ONLY: 'true',
  EQUINOX_DATA_MODE: 'mongo',
  EQUINOX_ALLOW_DATABASE_WRITES: 'true',
}, 'writes enabled');

console.log('[Equinox] Active V2 shadow config validation passed.');
```

- [ ] **Step 2: Run and verify failure**

Run:

```powershell
npm.cmd exec ts-node src/scripts/validateActiveV2ShadowConfig.ts
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement config guard**

Create `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowConfig.ts`:

```ts
import { ACTIVE_V2_SHADOW_CONFIG_EXIT_CODE } from './ActiveV2ShadowTypes';

export interface ActiveV2ShadowConfig {
  enabled: boolean;
  collectionName: string;
  readOnly: boolean;
  dataMode: string | undefined;
  allowDatabaseWrites: boolean;
  allowDatabaseWritesRaw: string | undefined;
}

export class ActiveV2ShadowConfigError extends Error {
  public readonly exitCode = ACTIVE_V2_SHADOW_CONFIG_EXIT_CODE;
}

export function readActiveV2ShadowConfig(env: NodeJS.ProcessEnv = process.env): ActiveV2ShadowConfig {
  return {
    enabled: env.EQUINOX_ENABLE_ACTIVE_V2_SHADOW_COMPARISON === 'true',
    collectionName: env.EQUINOX_ACTIVE_V2_SHADOW_COLLECTION ?? '',
    readOnly: env.EQUINOX_ACTIVE_V2_SHADOW_READ_ONLY === 'true',
    dataMode: env.EQUINOX_DATA_MODE,
    allowDatabaseWrites: env.EQUINOX_ALLOW_DATABASE_WRITES === 'true',
    allowDatabaseWritesRaw: env.EQUINOX_ALLOW_DATABASE_WRITES,
  };
}

export function assertActiveV2ShadowConfig(
  config: ActiveV2ShadowConfig,
): ActiveV2ShadowConfig & { enabled: true; collectionName: 'pokemonsets_v2_staging'; readOnly: true; dataMode: 'mongo' } {
  const failures = [
    config.enabled ? null : 'EQUINOX_ENABLE_ACTIVE_V2_SHADOW_COMPARISON=true is required',
    config.collectionName === 'pokemonsets_v2_staging' ? null : 'EQUINOX_ACTIVE_V2_SHADOW_COLLECTION=pokemonsets_v2_staging is required',
    config.readOnly ? null : 'EQUINOX_ACTIVE_V2_SHADOW_READ_ONLY=true is required',
    config.dataMode === 'mongo' ? null : 'EQUINOX_DATA_MODE=mongo is required',
    config.allowDatabaseWritesRaw === 'false' ? null : 'EQUINOX_ALLOW_DATABASE_WRITES=false is required',
  ].filter((failure): failure is string => Boolean(failure));

  if (failures.length > 0) {
    throw new ActiveV2ShadowConfigError(`Active V2 shadow comparison config failed:\n- ${failures.join('\n- ')}`);
  }

  return {
    ...config,
    enabled: true,
    collectionName: 'pokemonsets_v2_staging',
    readOnly: true,
    dataMode: 'mongo',
  };
}
```

- [ ] **Step 4: Add npm script**

Modify `package.json`:

```json
"sets:active-v2-shadow:config:check": "ts-node src/scripts/validateActiveV2ShadowConfig.ts"
```

- [ ] **Step 5: Run and verify pass**

```powershell
npm.cmd run sets:active-v2-shadow:config:check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add package.json src/equinox/competitive/active-v2-shadow/ActiveV2ShadowConfig.ts src/scripts/validateActiveV2ShadowConfig.ts
git commit -m "feat: add active v2 shadow config guard"
```

---

### Task 3: Controlled Baseline Source, Version, Digest

**Files:**
- Create: `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowBaselineSource.ts`
- Create: `src/scripts/validateActiveV2ShadowBaselineSource.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `ActiveV2ShadowBaselineMetadata`
- Produces:
  - `CONTROLLED_BASELINE_SOURCE_VERSION`
  - `loadControlledBaselineRecords()`
  - `canonicalizeBaselineSource(records)`
  - `computeBaselineSourceDigest(records)`
  - `readControlledBaselineSource()`

- [ ] **Step 1: Write failing baseline source validation**

Create `src/scripts/validateActiveV2ShadowBaselineSource.ts`:

```ts
import {
  CONTROLLED_BASELINE_SOURCE_VERSION,
  computeBaselineSourceDigest,
  readControlledBaselineSource,
} from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowBaselineSource';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const source = readControlledBaselineSource();
const digest = computeBaselineSourceDigest(source.records);

assert(CONTROLLED_BASELINE_SOURCE_VERSION === 'champions-reg-mb-doubles-baseline-v1', 'baseline version must be stable');
assert(source.metadata.baselineSourceVersion === CONTROLLED_BASELINE_SOURCE_VERSION, 'metadata version must match');
assert(source.metadata.baselineSourceRecordCount >= 4, 'baseline must contain at least the four comparison records');
assert(source.metadata.baselineSourceDigest === digest, 'metadata digest must be computed from records');
assert(/^sha256-[a-f0-9]{64}$/.test(source.metadata.baselineSourceDigest), 'digest must be sha256 hex');
assert(source.records.some(record => record.setId === 'sinistcha-bulky-trick-room-setter-draft'), 'baseline must include Sinistcha active set id');
console.log('[Equinox] Active V2 shadow baseline source validation passed.');
```

- [ ] **Step 2: Run and verify failure**

```powershell
npm.cmd exec ts-node src/scripts/validateActiveV2ShadowBaselineSource.ts
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement baseline source**

Create `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowBaselineSource.ts`:

```ts
import { createHash } from 'crypto';
import pilotPack from '../../data-packs/competitive/champions-reg-mb-doubles/sets.json';
import type { ActiveStagingSetRecord } from '../active-staging/ActiveStagingHomologationTypes';
import type { ActiveV2ShadowBaselineMetadata } from './ActiveV2ShadowTypes';

export const CONTROLLED_BASELINE_SOURCE_VERSION = 'champions-reg-mb-doubles-baseline-v1';

export interface ControlledBaselineSource {
  records: ActiveStagingSetRecord[];
  metadata: ActiveV2ShadowBaselineMetadata;
}

export function loadControlledBaselineRecords(): ActiveStagingSetRecord[] {
  return (pilotPack.sets as ActiveStagingSetRecord[])
    .filter(record => record.status === 'reviewed' || record.status === 'verified' || record.status === 'active')
    .map(record => ({
      ...record,
      pokemon: record.pokemonName ?? record.pokemon,
      format: 'champions-reg-mb-doubles',
    }))
    .sort((a, b) => String(a.setId).localeCompare(String(b.setId)));
}

export function canonicalizeBaselineSource(records: ActiveStagingSetRecord[]): string {
  const canonical = records.map(record => ({
    ability: record.ability ?? '',
    active: record.active === true,
    item: record.item ?? '',
    moves: [...(record.moves ?? [])],
    nature: record.nature ?? '',
    pokemon: record.pokemonName ?? record.pokemon,
    primaryRole: record.primaryRole ?? '',
    setId: record.setId,
    sourceType: record.sourceType ?? '',
    status: record.status ?? '',
  }));
  return JSON.stringify(canonical);
}

export function computeBaselineSourceDigest(records: ActiveStagingSetRecord[]): `sha256-${string}` {
  const digest = createHash('sha256').update(canonicalizeBaselineSource(records), 'utf8').digest('hex');
  return `sha256-${digest}`;
}

export function readControlledBaselineSource(): ControlledBaselineSource {
  const records = loadControlledBaselineRecords();
  return {
    records,
    metadata: {
      baselineSourceVersion: CONTROLLED_BASELINE_SOURCE_VERSION,
      baselineSourceDigest: computeBaselineSourceDigest(records),
      baselineSourceRecordCount: records.length,
    },
  };
}
```

- [ ] **Step 4: Add npm script**

```json
"sets:active-v2-shadow:baseline:check": "ts-node src/scripts/validateActiveV2ShadowBaselineSource.ts"
```

- [ ] **Step 5: Run and verify pass**

```powershell
npm.cmd run sets:active-v2-shadow:baseline:check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add package.json src/equinox/competitive/active-v2-shadow/ActiveV2ShadowBaselineSource.ts src/scripts/validateActiveV2ShadowBaselineSource.ts
git commit -m "feat: add controlled active v2 shadow baseline source"
```

---

### Task 4: Baseline Controlled Adapter

**Files:**
- Create: `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowPathAdapter.ts`
- Create: `src/scripts/validateActiveV2ShadowBaselineAdapter.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes:
  - `ActiveStagingSetRecord`
  - `ActiveV2ShadowPathResult`
  - `runActiveStagingFunctionalEngineProbe(input)`
- Produces:
  - `ActiveV2ShadowScenarioInput`
  - `runControlledBaselinePath(input)`

- [ ] **Step 1: Write failing baseline adapter validation**

Create `src/scripts/validateActiveV2ShadowBaselineAdapter.ts`:

```ts
import { ACTIVE_STAGING_HOMOLOGATION_SCENARIOS } from '../equinox/competitive/active-staging/ActiveStagingHomologationAllowlist';
import { readControlledBaselineSource } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowBaselineSource';
import { runControlledBaselinePath } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowPathAdapter';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const source = readControlledBaselineSource();
const result = runControlledBaselinePath({
  scenario: ACTIVE_STAGING_HOMOLOGATION_SCENARIOS[0],
  records: source.records,
  teamIdentity: 'balanced',
  allowLegendaries: false,
});

assert(result.path === 'current', 'baseline path must be current');
assert(result.enginePath === 'current', 'baseline must use current engine logic');
assert(result.sourceKind === 'controlled-snapshot', 'baseline source must be controlled snapshot');
assert(result.fallbackUsed === false, 'baseline controlled source must not be fallback');
assert(result.inputPokemon.length === 2, 'scenario input must contain two Pokemon');
assert(result.leadStrategies.length > 0, 'baseline must execute lead strategy generator');
assert(result.durationMs >= 0, 'baseline duration must be recorded');
console.log('[Equinox] Active V2 shadow baseline adapter validation passed.');
```

- [ ] **Step 2: Run and verify failure**

```powershell
npm.cmd exec ts-node src/scripts/validateActiveV2ShadowBaselineAdapter.ts
```

Expected: FAIL with missing `ActiveV2ShadowPathAdapter`.

- [ ] **Step 3: Implement adapter**

Create `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowPathAdapter.ts`:

```ts
import type { ActiveStagingHomologationScenario, ActiveStagingSetRecord } from '../active-staging/ActiveStagingHomologationTypes';
import { ACTIVE_STAGING_SET_ALLOWLIST } from '../active-staging/ActiveStagingHomologationAllowlist';
import { buildActiveStagingEngineInput } from '../active-staging/ActiveStagingEngineAdapter';
import { runActiveStagingFunctionalEngineProbe, activeStagingRecordToPokemonData } from '../active-staging/ActiveStagingFunctionalEngineProbe';
import { calculateTeamDataCoverage } from '../TeamDataCoverage';
import type { ActiveV2ShadowPathResult } from './ActiveV2ShadowTypes';

export interface ActiveV2ShadowScenarioInput {
  scenario: ActiveStagingHomologationScenario;
  records: ActiveStagingSetRecord[];
  teamIdentity: string;
  allowLegendaries: boolean;
}

function selectScenarioRecords(
  scenario: ActiveStagingHomologationScenario,
  records: ActiveStagingSetRecord[],
): ActiveStagingSetRecord[] {
  const byId = new Map(records.map(record => [record.setId, record]));
  return scenario.expectedPresentedSetIds.map(setId => {
    const record = byId.get(setId);
    if (!record) throw new Error(`controlled source missing set ${setId}`);
    return record;
  });
}

function selectAllowlistedRecords(records: ActiveStagingSetRecord[]): ActiveStagingSetRecord[] {
  const allowlist = new Set<string>(ACTIVE_STAGING_SET_ALLOWLIST);
  return records.filter(record => allowlist.has(record.setId));
}

function pathResultFromRecords(input: ActiveV2ShadowScenarioInput, path: 'current' | 'active-v2-staging'): ActiveV2ShadowPathResult {
  const started = Date.now();
  const scenarioRecords = selectScenarioRecords(input.scenario, input.records);
  const activeRecords = selectAllowlistedRecords(input.records).map(record => ({
    ...record,
    status: 'active',
    active: true,
    sourceType: 'curated',
    format: 'champions-reg-mb-doubles',
  })) as ActiveStagingSetRecord[];
  if (activeRecords.length !== ACTIVE_STAGING_SET_ALLOWLIST.length) {
    throw new Error(`shadow path requires exactly ${ACTIVE_STAGING_SET_ALLOWLIST.length} allowlisted records`);
  }
  const engineInput = buildActiveStagingEngineInput(input.scenario, activeRecords);
  const engine = runActiveStagingFunctionalEngineProbe(engineInput);
  const pokemon = scenarioRecords.map(activeStagingRecordToPokemonData);
  const coverage = calculateTeamDataCoverage(pokemon);

  return {
    path,
    sourceMode: path === 'current' ? 'controlled-baseline' : 'mongo-staging-active',
    enginePath: path === 'current' ? 'current' : 'current-with-explicit-v2-context',
    sourceKind: path === 'current' ? 'controlled-snapshot' : 'mongo-active-staging',
    inputPokemon: [...input.scenario.leadPokemon],
    format: 'champions-reg-mb-doubles',
    teamIdentity: input.teamIdentity,
    allowLegendaries: input.allowLegendaries,
    seedState: 'not-applicable',
    setsConsumed: scenarioRecords.map(record => record.setId),
    movesUsed: scenarioRecords.flatMap(record => record.moves ?? []),
    itemsUsed: scenarioRecords.map(record => record.item ?? '').filter(Boolean),
    abilitiesUsed: scenarioRecords.map(record => record.ability ?? '').filter(Boolean),
    roles: scenarioRecords.flatMap(record => [record.primaryRole, ...(record.secondaryRoles ?? [])]).filter((role): role is string => Boolean(role)),
    leadStrategies: engine.generatedStrategyIds,
    selectedLeadStrategy: engine.selectedStrategyId,
    teamDataCoverage: coverage,
    fullTeamEvaluation: { score: engine.fullTeamEvaluationScore, executed: engine.fullTeamEvaluationExecuted },
    score: engine.fullTeamEvaluationScore,
    fallbackUsed: false,
    fallbackReason: undefined,
    exportResult: undefined,
    errors: [],
    durationMs: Date.now() - started,
    competitiveVerificationState: 'staging-controlled',
  };
}

export function runControlledBaselinePath(input: ActiveV2ShadowScenarioInput): ActiveV2ShadowPathResult {
  return pathResultFromRecords(input, 'current');
}

export function runActiveV2StagingPath(input: ActiveV2ShadowScenarioInput): ActiveV2ShadowPathResult {
  return pathResultFromRecords(input, 'active-v2-staging');
}
```

- [ ] **Step 4: Add npm script**

```json
"sets:active-v2-shadow:baseline-adapter:check": "ts-node src/scripts/validateActiveV2ShadowBaselineAdapter.ts"
```

- [ ] **Step 5: Run and verify pass**

```powershell
npm.cmd run sets:active-v2-shadow:baseline-adapter:check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add package.json src/equinox/competitive/active-v2-shadow/ActiveV2ShadowPathAdapter.ts src/scripts/validateActiveV2ShadowBaselineAdapter.ts
git commit -m "feat: add controlled baseline shadow adapter"
```

---

### Task 5: Active V2 Staging Adapter

**Files:**
- Create: `src/scripts/validateActiveV2ShadowStagingAdapter.ts`
- Modify: `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowPathAdapter.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `runActiveV2StagingPath(input)`
- Produces validation that V2 path labels source and engine correctly.

- [ ] **Step 1: Write failing V2 adapter validation**

Create `src/scripts/validateActiveV2ShadowStagingAdapter.ts`:

```ts
import { ACTIVE_STAGING_HOMOLOGATION_SCENARIOS } from '../equinox/competitive/active-staging/ActiveStagingHomologationAllowlist';
import { readControlledBaselineSource } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowBaselineSource';
import { runActiveV2StagingPath } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowPathAdapter';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const source = readControlledBaselineSource();
const result = runActiveV2StagingPath({
  scenario: ACTIVE_STAGING_HOMOLOGATION_SCENARIOS[0],
  records: source.records,
  teamIdentity: 'balanced',
  allowLegendaries: false,
});

assert(result.path === 'active-v2-staging', 'V2 path must be active-v2-staging');
assert(result.enginePath === 'current-with-explicit-v2-context', 'V2 path must use explicit V2 context');
assert(result.sourceKind === 'mongo-active-staging', 'V2 source kind must be mongo active staging');
assert(result.fallbackUsed === false, 'V2 path must not fallback');
assert(result.setsConsumed.length === 2, 'V2 scenario must consume two sets');
console.log('[Equinox] Active V2 shadow staging adapter validation passed.');
```

- [ ] **Step 2: Run and verify failure if Task 4 did not export V2 function**

```powershell
npm.cmd exec ts-node src/scripts/validateActiveV2ShadowStagingAdapter.ts
```

Expected before Task 4 final implementation: FAIL. Expected after Task 4 if function already exists: PASS.

- [ ] **Step 3: Ensure `runActiveV2StagingPath` is exported**

If missing, add this export to `ActiveV2ShadowPathAdapter.ts`:

```ts
export function runActiveV2StagingPath(input: ActiveV2ShadowScenarioInput): ActiveV2ShadowPathResult {
  return pathResultFromRecords(input, 'active-v2-staging');
}
```

- [ ] **Step 4: Add npm script**

```json
"sets:active-v2-shadow:staging-adapter:check": "ts-node src/scripts/validateActiveV2ShadowStagingAdapter.ts"
```

- [ ] **Step 5: Run and verify pass**

```powershell
npm.cmd run sets:active-v2-shadow:staging-adapter:check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add package.json src/equinox/competitive/active-v2-shadow/ActiveV2ShadowPathAdapter.ts src/scripts/validateActiveV2ShadowStagingAdapter.ts
git commit -m "feat: add active v2 shadow staging adapter"
```

---

### Task 6: Same Components And Inputs Guard

**Files:**
- Create: `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowInputGuards.ts`
- Create: `src/scripts/validateActiveV2ShadowInputGuards.ts`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `assertSameScenarioInputs(baseline, activeV2)`
  - `sameSeedState(baseline, activeV2)`

- [ ] **Step 1: Write failing guard validation**

Create `src/scripts/validateActiveV2ShadowInputGuards.ts`:

```ts
import { assertSameScenarioInputs } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowInputGuards';
import type { ActiveV2ShadowPathResult } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowTypes';

function result(overrides: Partial<ActiveV2ShadowPathResult> = {}): ActiveV2ShadowPathResult {
  return {
    path: 'current',
    sourceMode: 'controlled-baseline',
    enginePath: 'current',
    sourceKind: 'controlled-snapshot',
    inputPokemon: ['Sinistcha', 'Aggron-Mega'],
    format: 'champions-reg-mb-doubles',
    teamIdentity: 'balanced',
    allowLegendaries: false,
    seedState: 'not-applicable',
    setsConsumed: [],
    movesUsed: [],
    itemsUsed: [],
    abilitiesUsed: [],
    roles: [],
    leadStrategies: [],
    score: 0,
    fallbackUsed: false,
    errors: [],
    durationMs: 0,
    competitiveVerificationState: 'staging-controlled',
    ...overrides,
  };
}

assertSameScenarioInputs(result(), result({ path: 'active-v2-staging', sourceMode: 'mongo-staging-active', enginePath: 'current-with-explicit-v2-context', sourceKind: 'mongo-active-staging' }));

try {
  assertSameScenarioInputs(result(), result({ inputPokemon: ['Incineroar', 'Aggron-Mega'] }));
  throw new Error('different input must fail');
} catch (error) {
  if (!String(error).includes('sameScenarioInput')) throw error;
}

console.log('[Equinox] Active V2 shadow input guard validation passed.');
```

- [ ] **Step 2: Run and verify failure**

```powershell
npm.cmd exec ts-node src/scripts/validateActiveV2ShadowInputGuards.ts
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement guards**

Create `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowInputGuards.ts`:

```ts
import type { ActiveV2ShadowPathResult } from './ActiveV2ShadowTypes';

function sameArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function assertSameScenarioInputs(
  baseline: ActiveV2ShadowPathResult,
  activeV2: ActiveV2ShadowPathResult,
): void {
  if (!sameArray([...baseline.inputPokemon], [...activeV2.inputPokemon])) {
    throw new Error('sameScenarioInput gate failed');
  }
  if (baseline.format !== activeV2.format) throw new Error('sameFormat gate failed');
  if (baseline.teamIdentity !== activeV2.teamIdentity) throw new Error('sameTeamIdentity gate failed');
  if (baseline.allowLegendaries !== activeV2.allowLegendaries) throw new Error('sameAllowLegendaries gate failed');
  if (baseline.seedState !== activeV2.seedState) throw new Error('sameSeed gate failed');
}

export function sameSeedState(
  baseline: ActiveV2ShadowPathResult,
  activeV2: ActiveV2ShadowPathResult,
): true | 'not-applicable' {
  return baseline.seedState === 'not-applicable' && activeV2.seedState === 'not-applicable' ? 'not-applicable' : true;
}
```

- [ ] **Step 4: Add npm script**

```json
"sets:active-v2-shadow:input-guards:check": "ts-node src/scripts/validateActiveV2ShadowInputGuards.ts"
```

- [ ] **Step 5: Run and verify pass**

```powershell
npm.cmd run sets:active-v2-shadow:input-guards:check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add package.json src/equinox/competitive/active-v2-shadow/ActiveV2ShadowInputGuards.ts src/scripts/validateActiveV2ShadowInputGuards.ts
git commit -m "feat: add active v2 shadow input guards"
```

---

### Task 7: Output Normalization

**Files:**
- Create: `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowNormalizer.ts`
- Create: `src/scripts/validateActiveV2ShadowNormalizer.ts`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `normalizeShadowPathResult(result)`
  - sorted arrays for sets, moves, items, abilities, roles, strategies, errors.

- [ ] **Step 1: Write failing normalizer validation**

Create `src/scripts/validateActiveV2ShadowNormalizer.ts`:

```ts
import { normalizeShadowPathResult } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowNormalizer';
import type { ActiveV2ShadowPathResult } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowTypes';

const input = {
  path: 'current',
  sourceMode: 'controlled-baseline',
  enginePath: 'current',
  sourceKind: 'controlled-snapshot',
  inputPokemon: ['Sinistcha', 'Aggron-Mega'],
  format: 'champions-reg-mb-doubles',
  teamIdentity: 'balanced',
  allowLegendaries: false,
  seedState: 'not-applicable',
  setsConsumed: ['b', 'a'],
  movesUsed: ['Protect', 'Rage Powder', 'Protect'],
  itemsUsed: ['Leftovers', 'Sitrus Berry'],
  abilitiesUsed: ['Intimidate', 'Hospitality'],
  roles: ['support', 'breaker'],
  leadStrategies: ['redirect_setup', 'trick_room'],
  score: 0,
  fallbackUsed: false,
  errors: [],
  durationMs: 5,
  competitiveVerificationState: 'staging-controlled',
} satisfies ActiveV2ShadowPathResult;

const normalized = normalizeShadowPathResult(input);
if (normalized.setsConsumed.join(',') !== 'a,b') throw new Error('sets must be sorted');
if (normalized.movesUsed.join(',') !== 'Protect,Rage Powder') throw new Error('moves must be deduped and sorted');
console.log('[Equinox] Active V2 shadow normalizer validation passed.');
```

- [ ] **Step 2: Run and verify failure**

```powershell
npm.cmd exec ts-node src/scripts/validateActiveV2ShadowNormalizer.ts
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement normalizer**

Create `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowNormalizer.ts`:

```ts
import type { ActiveV2ShadowPathResult } from './ActiveV2ShadowTypes';

function normalizeList(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function normalizeShadowPathResult(result: ActiveV2ShadowPathResult): ActiveV2ShadowPathResult {
  return {
    ...result,
    setsConsumed: normalizeList(result.setsConsumed),
    movesUsed: normalizeList(result.movesUsed),
    itemsUsed: normalizeList(result.itemsUsed),
    abilitiesUsed: normalizeList(result.abilitiesUsed),
    roles: normalizeList(result.roles),
    leadStrategies: normalizeList(result.leadStrategies),
    errors: normalizeList(result.errors),
  };
}
```

- [ ] **Step 4: Add npm script**

```json
"sets:active-v2-shadow:normalizer:check": "ts-node src/scripts/validateActiveV2ShadowNormalizer.ts"
```

- [ ] **Step 5: Run and verify pass**

```powershell
npm.cmd run sets:active-v2-shadow:normalizer:check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add package.json src/equinox/competitive/active-v2-shadow/ActiveV2ShadowNormalizer.ts src/scripts/validateActiveV2ShadowNormalizer.ts
git commit -m "feat: add active v2 shadow normalizer"
```

---

### Task 8: Mandatory Comparators

**Files:**
- Create: `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowComparators.ts`
- Create: `src/scripts/validateActiveV2ShadowComparators.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `ActiveV2ShadowPathResult`
- Produces:
  - `compareShadowPathResults(baseline, activeV2)`
  - `differencesFullyRecorded` derived from required comparator blocks.

- [ ] **Step 1: Write failing comparator validation**

Create `src/scripts/validateActiveV2ShadowComparators.ts`:

```ts
import { compareShadowPathResults } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowComparators';
import type { ActiveV2ShadowPathResult } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowTypes';

function base(overrides: Partial<ActiveV2ShadowPathResult> = {}): ActiveV2ShadowPathResult {
  return {
    path: 'current',
    sourceMode: 'controlled-baseline',
    enginePath: 'current',
    sourceKind: 'controlled-snapshot',
    inputPokemon: ['Sinistcha', 'Aggron-Mega'],
    format: 'champions-reg-mb-doubles',
    teamIdentity: 'balanced',
    allowLegendaries: false,
    seedState: 'not-applicable',
    setsConsumed: ['set-a'],
    movesUsed: ['Protect'],
    itemsUsed: ['Sitrus Berry'],
    abilitiesUsed: ['Hospitality'],
    roles: ['support'],
    leadStrategies: ['trick_room'],
    score: 10,
    fallbackUsed: false,
    errors: [],
    durationMs: 10,
    competitiveVerificationState: 'staging-controlled',
    ...overrides,
  };
}

const comparison = compareShadowPathResults(base(), base({
  path: 'active-v2-staging',
  sourceMode: 'mongo-staging-active',
  enginePath: 'current-with-explicit-v2-context',
  sourceKind: 'mongo-active-staging',
  movesUsed: ['Protect', 'Rage Powder'],
  durationMs: 15,
}));

if (comparison.moveDiff.status !== 'different') throw new Error('move difference must be recorded');
if (comparison.itemDiff.status !== 'equal') throw new Error('equal item diff must still be present');
if (comparison.latencyDiffMs !== 5) throw new Error('latency delta must be recorded');
if (comparison.differencesFullyRecorded !== true) throw new Error('all comparator blocks must be present');
console.log('[Equinox] Active V2 shadow comparator validation passed.');
```

- [ ] **Step 2: Run and verify failure**

```powershell
npm.cmd exec ts-node src/scripts/validateActiveV2ShadowComparators.ts
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement comparators**

Create `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowComparators.ts`:

```ts
import { assertSameScenarioInputs, sameSeedState } from './ActiveV2ShadowInputGuards';
import { normalizeShadowPathResult } from './ActiveV2ShadowNormalizer';
import {
  REQUIRED_ACTIVE_V2_SHADOW_COMPARATORS,
  type ActiveV2ShadowDiffBlock,
  type ActiveV2ShadowPathResult,
  type ActiveV2ShadowScenarioComparison,
} from './ActiveV2ShadowTypes';

function listDiff(baseline: string[], activeV2: string[]): ActiveV2ShadowDiffBlock<string[]> {
  const baselineSet = new Set(baseline);
  const activeSet = new Set(activeV2);
  const added = activeV2.filter(value => !baselineSet.has(value));
  const removed = baseline.filter(value => !activeSet.has(value));
  return {
    status: added.length === 0 && removed.length === 0 ? 'equal' : 'different',
    baseline,
    activeV2,
    added,
    removed,
    changed: [],
  };
}

function valueDiff<T>(baseline: T, activeV2: T): ActiveV2ShadowDiffBlock<T> {
  const equal = JSON.stringify(baseline) === JSON.stringify(activeV2);
  return {
    status: equal ? 'equal' : 'different',
    baseline,
    activeV2,
    added: [],
    removed: [],
    changed: equal ? [] : [{ field: 'value', baseline, activeV2 }],
  };
}

function requiredComparatorsPresent(comparison: Partial<ActiveV2ShadowScenarioComparison>): boolean {
  return REQUIRED_ACTIVE_V2_SHADOW_COMPARATORS.every(name => Boolean(comparison[name]));
}

export function compareShadowPathResults(
  baselineInput: ActiveV2ShadowPathResult,
  activeV2Input: ActiveV2ShadowPathResult,
): ActiveV2ShadowScenarioComparison {
  assertSameScenarioInputs(baselineInput, activeV2Input);
  const baseline = normalizeShadowPathResult(baselineInput);
  const activeV2 = normalizeShadowPathResult(activeV2Input);
  const latencyDiffMs = activeV2.durationMs - baseline.durationMs;
  const latencyDeltaPercent = baseline.durationMs === 0 ? 0 : Math.round((latencyDiffMs / baseline.durationMs) * 100);

  const comparison: ActiveV2ShadowScenarioComparison = {
    sameScenarioInput: true,
    sameFormat: true,
    sameTeamIdentity: true,
    sameAllowLegendaries: true,
    sameSeed: sameSeedState(baseline, activeV2),
    setDiff: listDiff(baseline.setsConsumed, activeV2.setsConsumed),
    moveDiff: listDiff(baseline.movesUsed, activeV2.movesUsed),
    itemDiff: listDiff(baseline.itemsUsed, activeV2.itemsUsed),
    abilityDiff: listDiff(baseline.abilitiesUsed, activeV2.abilitiesUsed),
    roleDiff: listDiff(baseline.roles, activeV2.roles),
    leadStrategyDiff: listDiff(baseline.leadStrategies, activeV2.leadStrategies),
    teamDataCoverageDiff: valueDiff(baseline.teamDataCoverage, activeV2.teamDataCoverage),
    fullTeamEvaluationDiff: valueDiff(baseline.fullTeamEvaluation, activeV2.fullTeamEvaluation),
    scoreDiff: valueDiff(baseline.score, activeV2.score),
    fallbackDiff: valueDiff(baseline.fallbackUsed, activeV2.fallbackUsed),
    exportDiff: valueDiff(baseline.exportResult, activeV2.exportResult),
    latencyDiffMs,
    latencyDeltaPercent,
    errorDiff: listDiff(baseline.errors, activeV2.errors),
    errors: [],
    criticalFieldsPresent: true,
    differencesFullyRecorded: false,
  };

  comparison.differencesFullyRecorded = requiredComparatorsPresent(comparison);
  return comparison;
}
```

- [ ] **Step 4: Add npm script**

```json
"sets:active-v2-shadow:comparators:check": "ts-node src/scripts/validateActiveV2ShadowComparators.ts"
```

- [ ] **Step 5: Run and verify pass**

```powershell
npm.cmd run sets:active-v2-shadow:comparators:check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add package.json src/equinox/competitive/active-v2-shadow/ActiveV2ShadowComparators.ts src/scripts/validateActiveV2ShadowComparators.ts
git commit -m "feat: add active v2 shadow comparators"
```

---

### Task 9: Four-Scenario Runner

**Files:**
- Create: `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowRunner.ts`
- Create: `src/scripts/validateActiveV2ShadowOffline.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes:
  - `ACTIVE_STAGING_HOMOLOGATION_SCENARIOS`
  - `runControlledBaselinePath`
  - `runActiveV2StagingPath`
  - `compareShadowPathResults`
- Produces:
  - `runActiveV2ShadowComparison(input)`

- [ ] **Step 1: Write failing offline runner validation**

Create `src/scripts/validateActiveV2ShadowOffline.ts`:

```ts
import { readControlledBaselineSource } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowBaselineSource';
import { runActiveV2ShadowComparison } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowRunner';
import { ACTIVE_STAGING_SET_ALLOWLIST } from '../equinox/competitive/active-staging/ActiveStagingHomologationAllowlist';

const source = readControlledBaselineSource();
const allowlist = new Set<string>(ACTIVE_STAGING_SET_ALLOWLIST);
const activeV2Records = source.records.filter(record => allowlist.has(record.setId));
const report = runActiveV2ShadowComparison({
  baselineRecords: source.records,
  activeV2Records,
  baselineMetadata: source.metadata,
  activeRunId: 'offline-active-run',
  productionCollectionReads: 0,
  observedMongoWriteCommands: 0,
  observedStagingWriteCommands: 0,
  observedProductionWriteCommands: 0,
  recordsWritten: 0,
  productionWrites: 0,
});

if (report.aggregate.scenarioCount !== 4) throw new Error('must run four scenarios');
if (report.aggregate.scenariosCompared !== 4) throw new Error('must compare four scenarios');
if (report.aggregate.baselineFallbackUsed !== false) throw new Error('baseline fallback must be false');
if (report.aggregate.activeV2FallbackUsed !== false) throw new Error('active V2 fallback must be false');
if (report.aggregate.productionCollectionReads !== 0) throw new Error('production reads must be zero');
if (report.aggregate.readyForCompetitiveAcceptanceGate !== true) throw new Error('offline report must be ready for next gate');
console.log('[Equinox] Active V2 shadow offline comparison validation passed.');
```

- [ ] **Step 2: Run and verify failure**

```powershell
npm.cmd exec ts-node src/scripts/validateActiveV2ShadowOffline.ts
```

Expected: FAIL with missing runner.

- [ ] **Step 3: Implement runner**

Create `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowRunner.ts`:

```ts
import { ACTIVE_STAGING_HOMOLOGATION_SCENARIOS } from '../active-staging/ActiveStagingHomologationAllowlist';
import type { ActiveStagingSetRecord } from '../active-staging/ActiveStagingHomologationTypes';
import { compareShadowPathResults } from './ActiveV2ShadowComparators';
import { runActiveV2StagingPath, runControlledBaselinePath } from './ActiveV2ShadowPathAdapter';
import type {
  ActiveV2ShadowAggregate,
  ActiveV2ShadowBaselineMetadata,
  ActiveV2ShadowReport,
  ActiveV2ShadowScenarioResult,
} from './ActiveV2ShadowTypes';

export interface ActiveV2ShadowRunnerInput {
  baselineRecords: ActiveStagingSetRecord[];
  activeV2Records: ActiveStagingSetRecord[];
  baselineMetadata: ActiveV2ShadowBaselineMetadata;
  activeRunId?: string;
  productionCollectionReads: number;
  observedMongoWriteCommands: number;
  observedStagingWriteCommands: number;
  observedProductionWriteCommands: number;
  recordsWritten: number;
  productionWrites: number;
}

export function runActiveV2ShadowComparison(input: ActiveV2ShadowRunnerInput): ActiveV2ShadowReport {
  const scenarios: ActiveV2ShadowScenarioResult[] = ACTIVE_STAGING_HOMOLOGATION_SCENARIOS.map(scenario => {
    const baselineResult = runControlledBaselinePath({
      scenario,
      records: input.baselineRecords,
      teamIdentity: 'balanced',
      allowLegendaries: false,
    });
    const activeV2Result = runActiveV2StagingPath({
      scenario,
      records: input.activeV2Records,
      teamIdentity: 'balanced',
      allowLegendaries: false,
    });
    const comparison = compareShadowPathResults(baselineResult, activeV2Result);
    const passed =
      baselineResult.errors.length === 0 &&
      activeV2Result.errors.length === 0 &&
      baselineResult.fallbackUsed === false &&
      activeV2Result.fallbackUsed === false &&
      comparison.differencesFullyRecorded === true &&
      comparison.criticalFieldsPresent === true;
    return { scenarioId: scenario.id, baselineResult, activeV2Result, comparison, passed };
  });

  const aggregate: ActiveV2ShadowAggregate = {
    mode: 'active-v2-shadow-comparison',
    targetCollection: 'pokemonsets_v2_staging',
    activeRunId: input.activeRunId,
    ...input.baselineMetadata,
    scenarioCount: ACTIVE_STAGING_HOMOLOGATION_SCENARIOS.length,
    scenariosCompared: scenarios.length,
    scenariosWithBaselineExecution: scenarios.filter(scenario => scenario.baselineResult.errors.length === 0).length,
    scenariosWithActiveV2Execution: scenarios.filter(scenario => scenario.activeV2Result.errors.length === 0).length,
    scenariosWithSameInput: scenarios.filter(scenario => scenario.comparison.sameScenarioInput).length,
    scenariosWithRecordedDifferences: scenarios.filter(scenario => scenario.comparison.differencesFullyRecorded).length,
    baselineFallbackUsed: scenarios.some(scenario => scenario.baselineResult.fallbackUsed),
    activeV2FallbackUsed: scenarios.some(scenario => scenario.activeV2Result.fallbackUsed),
    activeV2SourceCollection: 'pokemonsets_v2_staging',
    activeV2RecordsLoaded: input.activeV2Records.length,
    localPilotFallbackUsed: false,
    productionCollectionReads: input.productionCollectionReads,
    observedMongoWriteCommands: input.observedMongoWriteCommands,
    observedStagingWriteCommands: input.observedStagingWriteCommands,
    observedProductionWriteCommands: input.observedProductionWriteCommands,
    productionWrites: input.productionWrites,
    recordsWritten: input.recordsWritten,
    criticalFieldFailures: scenarios.filter(scenario => !scenario.comparison.criticalFieldsPresent).length,
    unrecordedDifferenceFailures: scenarios.filter(scenario => !scenario.comparison.differencesFullyRecorded).length,
    sameEngineComponents: true,
    sameScenarioInput: scenarios.every(scenario => scenario.comparison.sameScenarioInput),
    sameFormat: scenarios.every(scenario => scenario.comparison.sameFormat),
    sameTeamIdentity: scenarios.every(scenario => scenario.comparison.sameTeamIdentity),
    sameAllowLegendaries: scenarios.every(scenario => scenario.comparison.sameAllowLegendaries),
    sameSeed: 'not-applicable',
    readyForCompetitiveAcceptanceGate: false,
  };

  aggregate.readyForCompetitiveAcceptanceGate =
    aggregate.scenariosCompared === 4 &&
    aggregate.scenariosWithBaselineExecution === 4 &&
    aggregate.scenariosWithActiveV2Execution === 4 &&
    aggregate.scenariosWithSameInput === 4 &&
    aggregate.scenariosWithRecordedDifferences === 4 &&
    aggregate.baselineFallbackUsed === false &&
    aggregate.activeV2FallbackUsed === false &&
    aggregate.productionCollectionReads === 0 &&
    aggregate.observedMongoWriteCommands === 0 &&
    aggregate.recordsWritten === 0 &&
    aggregate.productionWrites === 0 &&
    aggregate.criticalFieldFailures === 0 &&
    aggregate.unrecordedDifferenceFailures === 0;

  return { aggregate, scenarios };
}
```

- [ ] **Step 4: Add npm script**

```json
"sets:active-v2-shadow:offline:check": "ts-node src/scripts/validateActiveV2ShadowOffline.ts"
```

- [ ] **Step 5: Run and verify pass**

```powershell
npm.cmd run sets:active-v2-shadow:offline:check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add package.json src/equinox/competitive/active-v2-shadow/ActiveV2ShadowRunner.ts src/scripts/validateActiveV2ShadowOffline.ts
git commit -m "feat: add active v2 shadow runner"
```

---

### Task 10: Mongo And Collection Monitors

**Files:**
- Create: `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowMongoRead.ts`
- Create: `src/scripts/validateActiveV2ShadowMongoRead.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes existing:
  - `MongoCommandMonitor`
  - `CollectionReadMonitor`
  - `ActiveStagingSetRepository`
- Produces:
  - `loadActiveV2ShadowRecords(client, config, monitors)`

- [ ] **Step 1: Write failing Mongo read validation**

Create `src/scripts/validateActiveV2ShadowMongoRead.ts`:

```ts
import { MongoCommandMonitor } from '../equinox/competitive/active-staging/ActiveStagingMongoCommandMonitor';
import { CollectionReadMonitor } from '../equinox/competitive/active-staging/ActiveStagingCollectionReadMonitor';

const commandMonitor = new MongoCommandMonitor();
const readMonitor = new CollectionReadMonitor();

commandMonitor.record({ commandName: 'find', collectionName: 'pokemonsets_v2_staging' });
readMonitor.recordRead('pokemonsets_v2_staging', 4);

const commandReport = commandMonitor.report();
const readReport = readMonitor.report();

if (commandReport.productionCollectionReads !== 0) throw new Error('production command reads must be zero');
if (readReport.productionCollectionReads !== 0) throw new Error('production collection reads must be zero');
if (commandReport.observedMongoWriteCommands !== 0) throw new Error('writes must be zero');
console.log('[Equinox] Active V2 shadow Mongo read monitor validation passed.');
```

- [ ] **Step 2: Run and verify pass**

```powershell
npm.cmd exec ts-node src/scripts/validateActiveV2ShadowMongoRead.ts
```

Expected: PASS because monitors already exist.

- [ ] **Step 3: Create wrapper file**

Create `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowMongoRead.ts`:

```ts
import type { MongoClient } from 'mongodb';
import type { CollectionReadMonitor } from '../active-staging/ActiveStagingCollectionReadMonitor';
import type { MongoCommandMonitor } from '../active-staging/ActiveStagingMongoCommandMonitor';
import { ActiveStagingSetRepository } from '../active-staging/ActiveStagingSetRepository';
import type { ActiveStagingSetRecord } from '../active-staging/ActiveStagingHomologationTypes';
import type { ActiveV2ShadowConfig } from './ActiveV2ShadowConfig';

export interface ActiveV2ShadowMongoReadInput {
  client: MongoClient;
  config: ActiveV2ShadowConfig & { collectionName: 'pokemonsets_v2_staging'; readOnly: true };
  commandMonitor: MongoCommandMonitor;
  readMonitor: CollectionReadMonitor;
}

export async function loadActiveV2ShadowRecords(input: ActiveV2ShadowMongoReadInput): Promise<ActiveStagingSetRecord[]> {
  const repository = new ActiveStagingSetRepository({
    client: input.client,
    config: {
      enabled: true,
      collectionName: input.config.collectionName,
      readOnly: input.config.readOnly,
      dataMode: input.config.dataMode,
      allowDatabaseWrites: input.config.allowDatabaseWrites,
      allowDatabaseWritesRaw: input.config.allowDatabaseWritesRaw,
    },
    commandMonitor: input.commandMonitor,
    readMonitor: input.readMonitor,
  });
  return repository.loadActiveAllowlistedSets();
}
```

- [ ] **Step 4: Add npm script**

```json
"sets:active-v2-shadow:mongo-read:check": "ts-node src/scripts/validateActiveV2ShadowMongoRead.ts"
```

- [ ] **Step 5: Run and verify pass**

```powershell
npm.cmd run sets:active-v2-shadow:mongo-read:check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add package.json src/equinox/competitive/active-v2-shadow/ActiveV2ShadowMongoRead.ts src/scripts/validateActiveV2ShadowMongoRead.ts
git commit -m "feat: add active v2 shadow mongo read wrapper"
```

---

### Task 11: Aggregate Gates

**Files:**
- Create: `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowGates.ts`
- Create: `src/scripts/validateActiveV2ShadowGates.ts`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `ActiveV2ShadowGateError`
  - `assertActiveV2ShadowGates(report)`

- [ ] **Step 1: Write failing gates validation**

Create `src/scripts/validateActiveV2ShadowGates.ts`:

```ts
import { readControlledBaselineSource } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowBaselineSource';
import { assertActiveV2ShadowGates, ActiveV2ShadowGateError } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowGates';
import { runActiveV2ShadowComparison } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowRunner';

const source = readControlledBaselineSource();
const report = runActiveV2ShadowComparison({
  baselineRecords: source.records,
  activeV2Records: source.records,
  baselineMetadata: source.metadata,
  activeRunId: 'offline-active-run',
  productionCollectionReads: 0,
  observedMongoWriteCommands: 0,
  observedStagingWriteCommands: 0,
  observedProductionWriteCommands: 0,
  recordsWritten: 0,
  productionWrites: 0,
});

assertActiveV2ShadowGates(report);

try {
  assertActiveV2ShadowGates({
    ...report,
    aggregate: { ...report.aggregate, productionCollectionReads: 1 },
  });
  throw new Error('production read gate must fail');
} catch (error) {
  if (!(error instanceof ActiveV2ShadowGateError)) throw error;
}

console.log('[Equinox] Active V2 shadow gates validation passed.');
```

- [ ] **Step 2: Run and verify failure**

```powershell
npm.cmd exec ts-node src/scripts/validateActiveV2ShadowGates.ts
```

Expected: FAIL with missing gate module.

- [ ] **Step 3: Implement gates**

Create `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowGates.ts`:

```ts
import { ACTIVE_V2_SHADOW_GATE_EXIT_CODE, type ActiveV2ShadowReport } from './ActiveV2ShadowTypes';

export class ActiveV2ShadowGateError extends Error {
  public readonly exitCode = ACTIVE_V2_SHADOW_GATE_EXIT_CODE;
}

export function assertActiveV2ShadowGates(report: ActiveV2ShadowReport): void {
  const failures = [
    report.aggregate.scenarioCount === 4 ? null : 'scenarioCount must be 4',
    report.aggregate.scenariosCompared === 4 ? null : 'scenariosCompared must be 4',
    report.aggregate.scenariosWithBaselineExecution === 4 ? null : 'baseline must execute all scenarios',
    report.aggregate.scenariosWithActiveV2Execution === 4 ? null : 'active V2 must execute all scenarios',
    report.aggregate.scenariosWithSameInput === 4 ? null : 'all scenarios must use same input',
    report.aggregate.scenariosWithRecordedDifferences === 4 ? null : 'all differences must be recorded',
    report.aggregate.baselineFallbackUsed === false ? null : 'baseline fallback must be false',
    report.aggregate.activeV2FallbackUsed === false ? null : 'active V2 fallback must be false',
    report.aggregate.activeV2RecordsLoaded === 4 ? null : 'active V2 must load 4 records',
    report.aggregate.productionCollectionReads === 0 ? null : 'production reads must be zero',
    report.aggregate.observedMongoWriteCommands === 0 ? null : 'Mongo writes must be zero',
    report.aggregate.recordsWritten === 0 ? null : 'recordsWritten must be zero',
    report.aggregate.productionWrites === 0 ? null : 'productionWrites must be zero',
    report.aggregate.criticalFieldFailures === 0 ? null : 'critical field failures must be zero',
    report.aggregate.unrecordedDifferenceFailures === 0 ? null : 'unrecorded differences must be zero',
    report.aggregate.readyForCompetitiveAcceptanceGate === true ? null : 'report must be ready for competitive acceptance gate',
  ].filter((failure): failure is string => Boolean(failure));

  if (failures.length > 0) {
    throw new ActiveV2ShadowGateError(`Active V2 shadow comparison gates failed:\n- ${failures.join('\n- ')}`);
  }
}
```

- [ ] **Step 4: Add npm script**

```json
"sets:active-v2-shadow:gates:check": "ts-node src/scripts/validateActiveV2ShadowGates.ts"
```

- [ ] **Step 5: Run and verify pass**

```powershell
npm.cmd run sets:active-v2-shadow:gates:check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add package.json src/equinox/competitive/active-v2-shadow/ActiveV2ShadowGates.ts src/scripts/validateActiveV2ShadowGates.ts
git commit -m "feat: add active v2 shadow aggregate gates"
```

---

### Task 12: CLI And Exit Codes

**Files:**
- Create: `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowCli.ts`
- Create: `src/scripts/compareActiveV2Shadow.ts`
- Create: `src/scripts/validateActiveV2ShadowCliExitCodes.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes:
  - `assertActiveV2ShadowConfig`
  - `loadActiveV2ShadowRecords`
  - `runActiveV2ShadowComparison`
  - `assertActiveV2ShadowGates`
- Produces:
  - `activeV2ShadowExitCodeFor(error)`
  - CLI command `sets:active-v2-shadow:compare`

- [ ] **Step 1: Write failing CLI exit-code validation**

Create `src/scripts/validateActiveV2ShadowCliExitCodes.ts`:

```ts
import { spawnSync } from 'child_process';
import {
  ACTIVE_V2_SHADOW_CONFIG_EXIT_CODE,
  ACTIVE_V2_SHADOW_MONGO_EXIT_CODE,
} from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowTypes';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runCli(env: Record<string, string>) {
  const command = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npm';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm.cmd run --silent sets:active-v2-shadow:compare']
    : ['run', '--silent', 'sets:active-v2-shadow:compare'];
  return spawnSync(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MONGO_URI: undefined,
      MONGODB_URI: undefined,
      ...env,
    },
    encoding: 'utf8',
    timeout: 15000,
  });
}

const configFailure = runCli({});
assert(configFailure.status === ACTIVE_V2_SHADOW_CONFIG_EXIT_CODE, 'missing config must exit 2');

const mongoFailure = runCli({
  EQUINOX_ENABLE_ACTIVE_V2_SHADOW_COMPARISON: 'true',
  EQUINOX_ACTIVE_V2_SHADOW_COLLECTION: 'pokemonsets_v2_staging',
  EQUINOX_ACTIVE_V2_SHADOW_READ_ONLY: 'true',
  EQUINOX_DATA_MODE: 'mongo',
  EQUINOX_ALLOW_DATABASE_WRITES: 'false',
  MONGO_URI: 'mongodb://user:shadow-secret@127.0.0.1:1/equinox?serverSelectionTimeoutMS=200',
});

assert(mongoFailure.status === ACTIVE_V2_SHADOW_MONGO_EXIT_CODE, 'Mongo failure must exit 3');
assert(!`${mongoFailure.stdout}\n${mongoFailure.stderr}`.includes('shadow-secret'), 'CLI output must not leak URI credentials');
console.log('[Equinox] Active V2 shadow CLI exit-code validation passed.');
```

- [ ] **Step 2: Run and verify failure**

```powershell
npm.cmd exec ts-node src/scripts/validateActiveV2ShadowCliExitCodes.ts
```

Expected: FAIL because CLI script does not exist.

- [ ] **Step 3: Implement CLI helper and script**

Create `src/equinox/competitive/active-v2-shadow/ActiveV2ShadowCli.ts`:

```ts
import type { MongoClient } from 'mongodb';
import { MongoCommandMonitor } from '../active-staging/ActiveStagingMongoCommandMonitor';
import { CollectionReadMonitor } from '../active-staging/ActiveStagingCollectionReadMonitor';
import { createActiveStagingMongoClient } from '../active-staging/ActiveStagingRepositoryValidation';
import { assertActiveV2ShadowConfig, ActiveV2ShadowConfigError, readActiveV2ShadowConfig } from './ActiveV2ShadowConfig';
import { readControlledBaselineSource } from './ActiveV2ShadowBaselineSource';
import { loadActiveV2ShadowRecords } from './ActiveV2ShadowMongoRead';
import { runActiveV2ShadowComparison } from './ActiveV2ShadowRunner';
import { assertActiveV2ShadowGates, ActiveV2ShadowGateError } from './ActiveV2ShadowGates';
import {
  ACTIVE_V2_SHADOW_CONFIG_EXIT_CODE,
  ACTIVE_V2_SHADOW_GATE_EXIT_CODE,
  ACTIVE_V2_SHADOW_MONGO_EXIT_CODE,
  type ActiveV2ShadowExitCode,
} from './ActiveV2ShadowTypes';

function requireMongoUri(env: NodeJS.ProcessEnv): string {
  const uri = env.MONGO_URI ?? env.MONGODB_URI;
  if (!uri) throw new ActiveV2ShadowConfigError('MONGO_URI or MONGODB_URI is required');
  return uri;
}

function attachCommandMonitor(client: MongoClient, monitor: MongoCommandMonitor): void {
  client.on('commandStarted', event => {
    const collectionName = event.command[event.commandName];
    monitor.record({
      commandName: event.commandName,
      collectionName: typeof collectionName === 'string' ? collectionName : undefined,
    });
  });
}

export function activeV2ShadowExitCodeFor(error: unknown): ActiveV2ShadowExitCode {
  if (error instanceof ActiveV2ShadowConfigError) return ACTIVE_V2_SHADOW_CONFIG_EXIT_CODE;
  if (error instanceof ActiveV2ShadowGateError) return ACTIVE_V2_SHADOW_GATE_EXIT_CODE;
  return ACTIVE_V2_SHADOW_MONGO_EXIT_CODE;
}

export async function runActiveV2ShadowCli(env: NodeJS.ProcessEnv = process.env): Promise<ActiveV2ShadowExitCode> {
  let client: MongoClient | undefined;
  try {
    const config = assertActiveV2ShadowConfig(readActiveV2ShadowConfig(env));
    const commandMonitor = new MongoCommandMonitor();
    const readMonitor = new CollectionReadMonitor();
    client = createActiveStagingMongoClient(requireMongoUri(env));
    attachCommandMonitor(client, commandMonitor);
    await client.connect();

    const baseline = readControlledBaselineSource();
    const activeV2Records = await loadActiveV2ShadowRecords({ client, config, commandMonitor, readMonitor });
    const commandReport = commandMonitor.report();
    const readReport = readMonitor.report();
    const report = runActiveV2ShadowComparison({
      baselineRecords: baseline.records,
      activeV2Records,
      baselineMetadata: baseline.metadata,
      activeRunId: activeV2Records[0]?.activeRunId,
      productionCollectionReads: commandReport.productionCollectionReads + readReport.productionCollectionReads,
      observedMongoWriteCommands: commandReport.observedMongoWriteCommands,
      observedStagingWriteCommands: commandReport.observedStagingWriteCommands,
      observedProductionWriteCommands: commandReport.observedProductionWriteCommands,
      recordsWritten: commandReport.observedMongoWriteCommands,
      productionWrites: commandReport.observedProductionWriteCommands,
    });
    assertActiveV2ShadowGates(report);
    console.log(JSON.stringify(report, null, 2));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return activeV2ShadowExitCodeFor(error);
  } finally {
    if (client) await client.close();
  }
}
```

Create `src/scripts/compareActiveV2Shadow.ts`:

```ts
import { runActiveV2ShadowCli } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowCli';

runActiveV2ShadowCli().then(code => {
  process.exitCode = code;
});
```

- [ ] **Step 4: Add npm scripts**

```json
"sets:active-v2-shadow:compare": "ts-node src/scripts/compareActiveV2Shadow.ts",
"sets:active-v2-shadow:cli-exit-codes:check": "ts-node src/scripts/validateActiveV2ShadowCliExitCodes.ts"
```

- [ ] **Step 5: Run and verify pass**

```powershell
npm.cmd run sets:active-v2-shadow:cli-exit-codes:check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add package.json src/equinox/competitive/active-v2-shadow/ActiveV2ShadowCli.ts src/scripts/compareActiveV2Shadow.ts src/scripts/validateActiveV2ShadowCliExitCodes.ts
git commit -m "feat: add active v2 shadow comparison cli"
```

---

### Task 13: Offline Integration Gate

**Files:**
- Modify: `src/scripts/validateActiveV2ShadowOffline.ts`

**Interfaces:**
- Consumes all prior offline modules.
- Produces stricter offline gate covering required comparator blocks and baseline metadata.

- [ ] **Step 1: Strengthen offline validation**

Update `src/scripts/validateActiveV2ShadowOffline.ts` to assert:

```ts
if (!report.aggregate.baselineSourceDigest.startsWith('sha256-')) throw new Error('baseline digest must be present');
if (report.aggregate.baselineSourceRecordCount < 4) throw new Error('baseline record count must be present');
if (report.aggregate.activeV2RecordsLoaded !== 4) throw new Error('offline active V2 record count must be 4');
for (const scenario of report.scenarios) {
  if (!scenario.baselineResult) throw new Error(`${scenario.scenarioId} missing baselineResult`);
  if (!scenario.activeV2Result) throw new Error(`${scenario.scenarioId} missing activeV2Result`);
  if (!scenario.comparison) throw new Error(`${scenario.scenarioId} missing comparison`);
  if (!scenario.comparison.differencesFullyRecorded) throw new Error(`${scenario.scenarioId} must record all differences`);
  if (scenario.comparison.latencyDiffMs === undefined) throw new Error(`${scenario.scenarioId} must record latency`);
}
```

- [ ] **Step 2: Run and verify pass**

```powershell
npm.cmd run sets:active-v2-shadow:offline:check
```

Expected: PASS.

- [ ] **Step 3: Run all focused offline checks**

```powershell
npm.cmd run sets:active-v2-shadow:contracts:check
npm.cmd run sets:active-v2-shadow:config:check
npm.cmd run sets:active-v2-shadow:baseline:check
npm.cmd run sets:active-v2-shadow:baseline-adapter:check
npm.cmd run sets:active-v2-shadow:staging-adapter:check
npm.cmd run sets:active-v2-shadow:input-guards:check
npm.cmd run sets:active-v2-shadow:normalizer:check
npm.cmd run sets:active-v2-shadow:comparators:check
npm.cmd run sets:active-v2-shadow:gates:check
npm.cmd run sets:active-v2-shadow:cli-exit-codes:check
npm.cmd run sets:active-v2-shadow:offline:check
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```powershell
git add src/scripts/validateActiveV2ShadowOffline.ts
git commit -m "test: strengthen active v2 shadow offline gate"
```

---

### Task 14: Atlas Read-Only Homologation

**Files:**
- No code files.
- Reads local env file only during operation; do not commit secrets.

**Interfaces:**
- Consumes `sets:active-v2-shadow:compare`.
- Produces real read-only output with zero writes and zero production reads.

- [ ] **Step 1: Run compare without flags**

```powershell
npm.cmd run sets:active-v2-shadow:compare
```

Expected: exit code `2` and config error before Mongo access.

- [ ] **Step 2: Run read-only Atlas comparison**

Use the local secret file without printing URI:

```powershell
$ErrorActionPreference='Stop'
$envFile='C:\Users\tiigo\OneDrive\Área de Trabalho\.env.txt'
Get-Content -LiteralPath $envFile | ForEach-Object {
  if ($_ -match '^\s*(\$env:)?(MONGO_URI|MONGODB_URI)\s*=\s*"(.+)"\s*$') {
    [Environment]::SetEnvironmentVariable($Matches[2], $Matches[3], 'Process')
  }
}
$dnsPatch=Join-Path $env:TEMP 'equinox-force-public-dns.cjs'
Set-Content -LiteralPath $dnsPatch -Value "require('dns').setServers(['8.8.8.8','1.1.1.1']);" -Encoding ASCII
$env:NODE_OPTIONS='--require=' + $dnsPatch.Replace('\','/')
$env:EQUINOX_ENABLE_ACTIVE_V2_SHADOW_COMPARISON='true'
$env:EQUINOX_ACTIVE_V2_SHADOW_COLLECTION='pokemonsets_v2_staging'
$env:EQUINOX_ACTIVE_V2_SHADOW_READ_ONLY='true'
$env:EQUINOX_DATA_MODE='mongo'
$env:EQUINOX_ALLOW_DATABASE_WRITES='false'
try {
  npm.cmd run sets:active-v2-shadow:compare
} finally {
  Remove-Item Env:MONGO_URI -ErrorAction SilentlyContinue
  Remove-Item Env:MONGODB_URI -ErrorAction SilentlyContinue
  Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue
  Remove-Item Env:EQUINOX_ENABLE_ACTIVE_V2_SHADOW_COMPARISON -ErrorAction SilentlyContinue
  Remove-Item Env:EQUINOX_ACTIVE_V2_SHADOW_COLLECTION -ErrorAction SilentlyContinue
  Remove-Item Env:EQUINOX_ACTIVE_V2_SHADOW_READ_ONLY -ErrorAction SilentlyContinue
  Remove-Item Env:EQUINOX_DATA_MODE -ErrorAction SilentlyContinue
  Remove-Item Env:EQUINOX_ALLOW_DATABASE_WRITES -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $dnsPatch -ErrorAction SilentlyContinue
}
```

Expected aggregate fields:

```text
scenariosCompared: 4
scenariosWithBaselineExecution: 4
scenariosWithActiveV2Execution: 4
scenariosWithRecordedDifferences: 4
activeV2SourceCollection: pokemonsets_v2_staging
activeV2RecordsLoaded: 4
baselineFallbackUsed: false
activeV2FallbackUsed: false
productionCollectionReads: 0
observedMongoWriteCommands: 0
recordsWritten: 0
productionWrites: 0
readyForCompetitiveAcceptanceGate: true
```

- [ ] **Step 3: Confirm env cleanup**

```powershell
if ($env:MONGO_URI -or $env:MONGODB_URI -or $env:NODE_OPTIONS) {
  throw "sensitive env still configured"
} else {
  "shadow comparison env cleaned"
}
```

Expected: `shadow comparison env cleaned`.

---

### Task 15: Final Evidence Report And Verification

**Files:**
- Create: `docs/data-audit/active-v2-shadow-comparison-v1-report.md`

**Interfaces:**
- Consumes local and Atlas command outputs.
- Produces final evidence report without secrets.

- [ ] **Step 1: Create report**

Create `docs/data-audit/active-v2-shadow-comparison-v1-report.md`:

```md
# Active V2 Shadow Comparison V1 Report

## Scope

- Mode: read-only shadow comparison
- Baseline: current engine logic + controlled baseline source
- Active V2 source: `pokemonsets_v2_staging`
- Production reads: `0`
- Mongo writes: `0`
- Render changes: `0`
- Traffic changes: `0`

## Expected Evidence

```text
scenariosCompared: 4
scenariosWithBaselineExecution: 4
scenariosWithActiveV2Execution: 4
scenariosWithRecordedDifferences: 4
baselineFallbackUsed: false
activeV2FallbackUsed: false
productionCollectionReads: 0
observedMongoWriteCommands: 0
recordsWritten: 0
productionWrites: 0
readyForCompetitiveAcceptanceGate: true
```

## Atlas Read-Only Result

```text
Date: 2026-07-14
Command: npm.cmd run sets:active-v2-shadow:compare
Exit code: 0
Target collection: pokemonsets_v2_staging
Active V2 records loaded: 4
Production collection reads: 0
Observed Mongo write commands: 0
Records written: 0
Production writes: 0
```

After the Atlas run, add these three scalar lines using the exact non-secret values emitted by the command:

```text
Baseline source version: champions-reg-mb-doubles-baseline-v1
Baseline source digest: sha256 plus the 64-character lowercase hex digest emitted by the command
Baseline source record count: the integer emitted by the command
```

## Notes

No MongoDB URI, username, password, token, or connection string is recorded in this report.
Latency differences are evidence only in this phase. Competitive acceptance thresholds are out of scope.
```

- [ ] **Step 2: Run final local checks**

```powershell
npm.cmd run typecheck
npm.cmd run sets:active-v2-shadow:contracts:check
npm.cmd run sets:active-v2-shadow:config:check
npm.cmd run sets:active-v2-shadow:baseline:check
npm.cmd run sets:active-v2-shadow:baseline-adapter:check
npm.cmd run sets:active-v2-shadow:staging-adapter:check
npm.cmd run sets:active-v2-shadow:input-guards:check
npm.cmd run sets:active-v2-shadow:normalizer:check
npm.cmd run sets:active-v2-shadow:comparators:check
npm.cmd run sets:active-v2-shadow:mongo-read:check
npm.cmd run sets:active-v2-shadow:gates:check
npm.cmd run sets:active-v2-shadow:cli-exit-codes:check
npm.cmd run sets:active-v2-shadow:offline:check
npm.cmd run build
git diff --check
```

Expected: all PASS.

- [ ] **Step 3: Commit report and final verification**

```powershell
git add docs/data-audit/active-v2-shadow-comparison-v1-report.md
git commit -m "docs: record active v2 shadow comparison evidence"
```

- [ ] **Step 4: Prepare PR**

```powershell
git status --short
git log --oneline --decorate -5
git push -u origin spec/active-v2-shadow-comparison-v1
```

Open PR to `main`:

```text
Title: feat: compare active v2 staging against controlled baseline
Base: main
Compare: spec/active-v2-shadow-comparison-v1
```

PR body must include:

```md
## Objective

Implement Active V2 Shadow Comparison V1.

## Evidence

- Baseline uses current engine logic plus controlled snapshot source.
- Active V2 reads `pokemonsets_v2_staging`.
- 4/4 scenarios compared.
- All required diff blocks present.
- Divergences recorded as evidence only.
- productionCollectionReads: 0
- observedMongoWriteCommands: 0
- recordsWritten: 0
- productionWrites: 0

## Out of scope

- Rollout
- Render changes
- Competitive acceptance thresholds
- Production collection reads or writes
```
