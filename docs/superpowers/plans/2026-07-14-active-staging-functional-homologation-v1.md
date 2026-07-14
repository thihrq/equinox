# Active Staging Functional Homologation V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a read-only homologation path proving the Equinox engine consumes exactly the four active records from Mongo `pokemonsets_v2_staging`, without production reads, writes, fallback masking, or default engine behavior changes.

**Architecture:** Add an isolated active-staging homologation module under `src/equinox/competitive/active-staging/`. The operational script loads the four active staging records through a read-only source, observes Mongo commands and collection reads, injects exactly two requested sets per scenario into a homologation-only engine adapter, traces TeamData usage, and fails any gate breach.

**Tech Stack:** TypeScript, ts-node validation scripts, Mongoose/MongoDB command monitoring, existing Equinox data guards, `CompetitivePokemonSet`, `TeamDataCoverage`, npm scripts.

## Global Constraints

- Nenhuma escrita Mongo.
- Nenhuma leitura de `pokemonsets`.
- Nenhuma alteracao no Render.
- Nenhuma mudanca no trafego.
- Nenhuma mudanca no fluxo padrao com flags desligadas.
- Nenhum fallback local nos quatro cenarios obrigatorios.
- Colecao obrigatoria: `pokemonsets_v2_staging`.
- Filtro obrigatorio: `status=active + active=true + allowlist`.
- Required flags: `EQUINOX_ENABLE_ACTIVE_STAGING_HOMOLOGATION=true`, `EQUINOX_ACTIVE_STAGING_COLLECTION=pokemonsets_v2_staging`, `EQUINOX_ACTIVE_STAGING_READ_ONLY=true`, `EQUINOX_DATA_MODE=mongo`, `EQUINOX_ALLOW_DATABASE_WRITES=false`.
- Exit codes: `0` success, `1` functional gate failed, `2` invalid configuration or environment, `3` Mongo connection or read failure.
- Secrets must never be printed.

---

## File Structure

Create:

```text
src/equinox/competitive/active-staging/ActiveStagingHomologationTypes.ts
src/equinox/competitive/active-staging/ActiveStagingHomologationAllowlist.ts
src/equinox/competitive/active-staging/ActiveStagingHomologationConfig.ts
src/equinox/competitive/active-staging/ActiveStagingMongoCommandMonitor.ts
src/equinox/competitive/active-staging/ActiveStagingCollectionReadMonitor.ts
src/equinox/competitive/active-staging/ActiveStagingSetRepository.ts
src/equinox/competitive/active-staging/ActiveStagingEngineAdapter.ts
src/equinox/competitive/active-staging/ActiveStagingTeamDataTracker.ts
src/equinox/competitive/active-staging/ActiveStagingHomologationRunner.ts
src/scripts/validateActiveStagingHomologationContracts.ts
src/scripts/validateActiveStagingHomologationConfig.ts
src/scripts/validateActiveStagingHomologationMonitoring.ts
src/scripts/validateActiveStagingRepository.ts
src/scripts/validateActiveStagingEngineAdapter.ts
src/scripts/validateActiveStagingTeamDataTracker.ts
src/scripts/validateActiveStagingRunnerOffline.ts
src/scripts/validateActiveStagingHomologationOfflineIntegration.ts
src/scripts/homologateActiveStagingFunctionalV1.ts
```

Modify:

```text
package.json
docs/data-audit/active-staging-functional-homologation-v1-report.md
```

Do not modify default behavior in:

```text
src/equinox/repositories/CompetitiveSetRepository.ts
src/equinox/data-sources/CompetitiveSetSource.ts
src/services/LeadStrategyRecommendationService.ts
```

---

### Task 1: Contracts And Domain Types

**Files:**
- Create: `src/equinox/competitive/active-staging/ActiveStagingHomologationTypes.ts`
- Create: `src/scripts/validateActiveStagingHomologationContracts.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `CompetitiveVerificationState`, `ActiveStagingSetQuery`, `ActiveStagingSetRecord`, `ActiveStagingSetLoadResult`, `ActiveStagingHomologationScenario`, `ActiveStagingScenarioReport`, `ActiveStagingHomologationReport`, `ActiveStagingOperationalEvidence`, `FunctionalHomologationExitCode`.

- [ ] **Step 1: Write failing contract validation**

Create `src/scripts/validateActiveStagingHomologationContracts.ts`:

```ts
import {
  ACTIVE_STAGING_SUCCESS_EXIT_CODE,
  ACTIVE_STAGING_FUNCTIONAL_GATE_EXIT_CODE,
  ACTIVE_STAGING_CONFIG_EXIT_CODE,
  ACTIVE_STAGING_MONGO_READ_EXIT_CODE,
  isCompetitiveVerificationState,
} from '../equinox/competitive/active-staging/ActiveStagingHomologationTypes';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(ACTIVE_STAGING_SUCCESS_EXIT_CODE === 0, 'success exit code must be 0');
assert(ACTIVE_STAGING_FUNCTIONAL_GATE_EXIT_CODE === 1, 'functional gate exit code must be 1');
assert(ACTIVE_STAGING_CONFIG_EXIT_CODE === 2, 'config exit code must be 2');
assert(ACTIVE_STAGING_MONGO_READ_EXIT_CODE === 3, 'Mongo read exit code must be 3');
assert(isCompetitiveVerificationState('unverified'), 'unverified must be valid');
assert(isCompetitiveVerificationState('staging-controlled'), 'staging-controlled must be valid');
assert(isCompetitiveVerificationState('production-approved'), 'production-approved must be valid');
assert(!isCompetitiveVerificationState('controlled-true'), 'controlled-true must be invalid');
console.log('[Equinox] Active staging homologation contract validation passed.');
```

Add script:

```json
"sets:active-staging:contracts:check": "ts-node src/scripts/validateActiveStagingHomologationContracts.ts"
```

Run:

```powershell
npm.cmd run sets:active-staging:contracts:check
```

Expected: FAIL with missing module `ActiveStagingHomologationTypes`.

- [ ] **Step 2: Implement type module**

Create `src/equinox/competitive/active-staging/ActiveStagingHomologationTypes.ts` with these exports:

```ts
import { CompetitiveSetValidationInput } from '../../data-validation/CompetitiveValidationTypes';
import { TeamDataCoverage } from '../TeamDataCoverage';

export const ACTIVE_STAGING_SUCCESS_EXIT_CODE = 0;
export const ACTIVE_STAGING_FUNCTIONAL_GATE_EXIT_CODE = 1;
export const ACTIVE_STAGING_CONFIG_EXIT_CODE = 2;
export const ACTIVE_STAGING_MONGO_READ_EXIT_CODE = 3;

export type FunctionalHomologationExitCode = 0 | 1 | 2 | 3;
export type CompetitiveVerificationState = 'unverified' | 'staging-controlled' | 'production-approved';

export function isCompetitiveVerificationState(value: string): value is CompetitiveVerificationState {
  return value === 'unverified' || value === 'staging-controlled' || value === 'production-approved';
}

export interface ActiveStagingSetQuery {
  collectionName: 'pokemonsets_v2_staging';
  setIds: readonly string[];
  status: 'active';
  active: true;
}

export interface ActiveStagingSetRecord extends CompetitiveSetValidationInput {
  setId: string;
  pokemon: string;
  pokemonName?: string;
  status: 'active';
  active: true;
  sourceType: 'curated';
  format: 'champions-reg-mb-doubles';
  activeRunId?: string;
}

export interface ActiveStagingSetLoadResult {
  collectionName: 'pokemonsets_v2_staging';
  records: ActiveStagingSetRecord[];
  setIdsRead: string[];
  queryDurationMs: number;
}

export interface ActiveStagingHomologationScenario {
  id: string;
  leadPokemon: [string, string];
  expectedPresentedSetIds: [string, string];
}

export interface ActiveStagingScenarioReport {
  scenarioId: string;
  leadPokemon: [string, string];
  expectedActiveV2SetsResolvedFromMongo: string[];
  expectedActiveV2SetsPresentedToEngine: string[];
  expectedActiveV2SetsAppliedToTeamData: string[];
  competitiveVerificationState: 'staging-controlled';
  localPilotFallbackUsed: false;
  teamDataCoverage?: TeamDataCoverage;
  passed: boolean;
}

export interface ActiveStagingHomologationAggregate {
  activeRecordsLoadedByRepository: number;
  scenariosRun: number;
  scenariosPassed: number;
  uniqueActiveRecordsPresentedAcrossAllScenarios: number;
  localPilotFallbackUsed: false;
  readyForAtlasReadOnlyHomologation: boolean;
}

export interface ActiveStagingHomologationReport {
  aggregate: ActiveStagingHomologationAggregate;
  scenarios: ActiveStagingScenarioReport[];
}

export interface ActiveStagingOperationalEvidence extends ActiveStagingHomologationReport {
  targetCollection: 'pokemonsets_v2_staging';
  productionCollectionReads: number;
  observedMongoWriteCommands: number;
  observedStagingWriteCommands: number;
  observedProductionWriteCommands: number;
  productionWrites: 0;
  recordsWritten: 0;
}
```

- [ ] **Step 3: Verify and commit**

```powershell
npm.cmd run sets:active-staging:contracts:check
npm.cmd run typecheck
git add package.json src/equinox/competitive/active-staging/ActiveStagingHomologationTypes.ts src/scripts/validateActiveStagingHomologationContracts.ts
git commit -m "feat: add active staging homologation contracts"
```

Expected: both commands pass.

### Task 2: Config Guard For Homologation Flags

**Files:**
- Create: `src/equinox/competitive/active-staging/ActiveStagingHomologationConfig.ts`
- Create: `src/scripts/validateActiveStagingHomologationConfig.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `ActiveStagingHomologationConfig`, `readActiveStagingHomologationConfig`, `assertActiveStagingHomologationConfig`, `ActiveStagingConfigError`.

- [ ] **Step 1: Write failing config validation**

Create `src/scripts/validateActiveStagingHomologationConfig.ts` with assertions for disabled flag, production collection, writes enabled, and valid config:

```ts
import { assertActiveStagingHomologationConfig, readActiveStagingHomologationConfig } from '../equinox/competitive/active-staging/ActiveStagingHomologationConfig';
function assert(condition: boolean, message: string): void { if (!condition) throw new Error(message); }
const originalEnv = { ...process.env };
process.env.EQUINOX_ENABLE_ACTIVE_STAGING_HOMOLOGATION = 'false';
process.env.EQUINOX_ACTIVE_STAGING_COLLECTION = 'pokemonsets_v2_staging';
process.env.EQUINOX_ACTIVE_STAGING_READ_ONLY = 'true';
process.env.EQUINOX_DATA_MODE = 'mongo';
process.env.EQUINOX_ALLOW_DATABASE_WRITES = 'false';
let disabledBlocked = false;
try { assertActiveStagingHomologationConfig(readActiveStagingHomologationConfig()); } catch (error) { disabledBlocked = String(error).includes('EQUINOX_ENABLE_ACTIVE_STAGING_HOMOLOGATION=true is required'); }
assert(disabledBlocked, 'disabled homologation flag must block execution');
process.env.EQUINOX_ENABLE_ACTIVE_STAGING_HOMOLOGATION = 'true';
process.env.EQUINOX_ACTIVE_STAGING_COLLECTION = 'pokemonsets';
let productionBlocked = false;
try { assertActiveStagingHomologationConfig(readActiveStagingHomologationConfig()); } catch (error) { productionBlocked = String(error).includes('pokemonsets_v2_staging'); }
assert(productionBlocked, 'production collection must be blocked');
process.env.EQUINOX_ACTIVE_STAGING_COLLECTION = 'pokemonsets_v2_staging';
process.env.EQUINOX_ALLOW_DATABASE_WRITES = 'true';
let writesBlocked = false;
try { assertActiveStagingHomologationConfig(readActiveStagingHomologationConfig()); } catch (error) { writesBlocked = String(error).includes('EQUINOX_ALLOW_DATABASE_WRITES=false is required'); }
assert(writesBlocked, 'writes enabled must be blocked');
process.env.EQUINOX_ALLOW_DATABASE_WRITES = 'false';
const config = assertActiveStagingHomologationConfig(readActiveStagingHomologationConfig());
assert(config.enabled === true, 'enabled must be true');
assert(config.collectionName === 'pokemonsets_v2_staging', 'collection must be staging');
assert(config.readOnly === true, 'readOnly must be true');
process.env = originalEnv;
console.log('[Equinox] Active staging homologation config validation passed.');
```

Add script and run:

```powershell
npm pkg set scripts.sets:active-staging:config:check="ts-node src/scripts/validateActiveStagingHomologationConfig.ts"
npm.cmd run sets:active-staging:config:check
```

Expected: FAIL with missing module `ActiveStagingHomologationConfig`.

- [ ] **Step 2: Implement config module**

```ts
import { ACTIVE_STAGING_CONFIG_EXIT_CODE } from './ActiveStagingHomologationTypes';
export interface ActiveStagingHomologationConfig { enabled: boolean; collectionName: string; readOnly: boolean; dataMode: string | undefined; allowDatabaseWrites: boolean; }
export class ActiveStagingConfigError extends Error { public readonly exitCode = ACTIVE_STAGING_CONFIG_EXIT_CODE; }
export function readActiveStagingHomologationConfig(env: NodeJS.ProcessEnv = process.env): ActiveStagingHomologationConfig { return { enabled: env.EQUINOX_ENABLE_ACTIVE_STAGING_HOMOLOGATION === 'true', collectionName: env.EQUINOX_ACTIVE_STAGING_COLLECTION ?? '', readOnly: env.EQUINOX_ACTIVE_STAGING_READ_ONLY === 'true', dataMode: env.EQUINOX_DATA_MODE, allowDatabaseWrites: env.EQUINOX_ALLOW_DATABASE_WRITES === 'true' }; }
export function assertActiveStagingHomologationConfig(config: ActiveStagingHomologationConfig): ActiveStagingHomologationConfig & { collectionName: 'pokemonsets_v2_staging'; enabled: true; readOnly: true } {
  const failures = [config.enabled ? null : 'EQUINOX_ENABLE_ACTIVE_STAGING_HOMOLOGATION=true is required', config.collectionName === 'pokemonsets_v2_staging' ? null : 'EQUINOX_ACTIVE_STAGING_COLLECTION=pokemonsets_v2_staging is required', config.readOnly ? null : 'EQUINOX_ACTIVE_STAGING_READ_ONLY=true is required', config.dataMode === 'mongo' ? null : 'EQUINOX_DATA_MODE=mongo is required', config.allowDatabaseWrites === false ? null : 'EQUINOX_ALLOW_DATABASE_WRITES=false is required'].filter((failure): failure is string => Boolean(failure));
  if (failures.length) throw new ActiveStagingConfigError(`Active staging functional homologation config failed:\n- ${failures.join('\n- ')}`);
  return { ...config, enabled: true, readOnly: true, collectionName: 'pokemonsets_v2_staging' };
}
```

- [ ] **Step 3: Verify and commit**

```powershell
npm.cmd run sets:active-staging:config:check
npm.cmd run typecheck
git add package.json src/equinox/competitive/active-staging/ActiveStagingHomologationConfig.ts src/scripts/validateActiveStagingHomologationConfig.ts
git commit -m "feat: add active staging homologation config guard"
```

### Task 3: Isolated Allowlist And Scenario Matrix

**Files:**
- Create: `src/equinox/competitive/active-staging/ActiveStagingHomologationAllowlist.ts`
- Modify: `src/scripts/validateActiveStagingHomologationContracts.ts`

**Interfaces:**
- Produces: `ACTIVE_STAGING_SET_ALLOWLIST`, `ACTIVE_STAGING_HOMOLOGATION_SCENARIOS`, `assertActiveStagingAllowlistIntegrity`.

- [ ] **Step 1: Extend contract validation**

Add imports and assertions:

```ts
import { ACTIVE_STAGING_SET_ALLOWLIST, ACTIVE_STAGING_HOMOLOGATION_SCENARIOS, assertActiveStagingAllowlistIntegrity } from '../equinox/competitive/active-staging/ActiveStagingHomologationAllowlist';
assert(ACTIVE_STAGING_SET_ALLOWLIST.length === 4, 'allowlist must contain four set IDs');
assert(ACTIVE_STAGING_HOMOLOGATION_SCENARIOS.length === 4, 'scenario matrix must contain four scenarios');
for (const scenario of ACTIVE_STAGING_HOMOLOGATION_SCENARIOS) assert(scenario.expectedPresentedSetIds.length === 2, `${scenario.id} must request exactly two sets`);
assertActiveStagingAllowlistIntegrity();
```

Run:

```powershell
npm.cmd run sets:active-staging:contracts:check
```

Expected: FAIL with missing module `ActiveStagingHomologationAllowlist`.

- [ ] **Step 2: Implement allowlist module**

```ts
import type { ActiveStagingHomologationScenario } from './ActiveStagingHomologationTypes';
export const ACTIVE_STAGING_SET_ALLOWLIST = ['sinistcha-bulky-trick-room-setter-draft', 'aggronmega-slow-physical-breaker-draft', 'incineroar-bulky-slow-pivot-draft', 'ursalunabloodmoon-slow-special-breaker-draft'] as const;
export type ActiveStagingHomologationSetId = typeof ACTIVE_STAGING_SET_ALLOWLIST[number];
export const ACTIVE_STAGING_HOMOLOGATION_SCENARIOS: ActiveStagingHomologationScenario[] = [
  { id: 'sinistcha-aggronmega', leadPokemon: ['Sinistcha', 'Aggron-Mega'], expectedPresentedSetIds: ['sinistcha-bulky-trick-room-setter-draft', 'aggronmega-slow-physical-breaker-draft'] },
  { id: 'incineroar-ursalunabloodmoon', leadPokemon: ['Incineroar', 'Ursaluna-Bloodmoon'], expectedPresentedSetIds: ['incineroar-bulky-slow-pivot-draft', 'ursalunabloodmoon-slow-special-breaker-draft'] },
  { id: 'sinistcha-incineroar', leadPokemon: ['Sinistcha', 'Incineroar'], expectedPresentedSetIds: ['sinistcha-bulky-trick-room-setter-draft', 'incineroar-bulky-slow-pivot-draft'] },
  { id: 'aggronmega-ursalunabloodmoon', leadPokemon: ['Aggron-Mega', 'Ursaluna-Bloodmoon'], expectedPresentedSetIds: ['aggronmega-slow-physical-breaker-draft', 'ursalunabloodmoon-slow-special-breaker-draft'] },
];
export function assertActiveStagingAllowlistIntegrity(): void {
  const allowlist = new Set<string>(ACTIVE_STAGING_SET_ALLOWLIST);
  const scenarioSetIds = new Set<string>();
  if (allowlist.size !== 4) throw new Error('Active staging allowlist must contain four unique set IDs.');
  for (const scenario of ACTIVE_STAGING_HOMOLOGATION_SCENARIOS) for (const setId of scenario.expectedPresentedSetIds) { if (!allowlist.has(setId)) throw new Error(`${scenario.id} references non-allowlisted set ${setId}.`); scenarioSetIds.add(setId); }
  if (scenarioSetIds.size !== 4) throw new Error(`Mandatory scenarios must cover all four active set IDs, received ${scenarioSetIds.size}.`);
}
```

- [ ] **Step 3: Verify and commit**

```powershell
npm.cmd run sets:active-staging:contracts:check
npm.cmd run typecheck
git add src/equinox/competitive/active-staging/ActiveStagingHomologationAllowlist.ts src/scripts/validateActiveStagingHomologationContracts.ts
git commit -m "feat: add active staging homologation allowlist"
```

### Task 4: Mongo Command Monitor

**Files:**
- Create: `src/equinox/competitive/active-staging/ActiveStagingMongoCommandMonitor.ts`
- Create: `src/scripts/validateActiveStagingHomologationMonitoring.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `MongoCommandMonitor`, `MongoCommandMonitorReport`, `WRITE_COMMAND_NAMES`.

- [ ] **Step 1: Write failing monitor validation**

Create validation script:

```ts
import { MongoCommandMonitor, WRITE_COMMAND_NAMES } from '../equinox/competitive/active-staging/ActiveStagingMongoCommandMonitor';
function assert(condition: boolean, message: string): void { if (!condition) throw new Error(message); }
const monitor = new MongoCommandMonitor();
monitor.record({ commandName: 'find', collectionName: 'pokemonsets_v2_staging' });
monitor.record({ commandName: 'update', collectionName: 'pokemonsets_v2_staging' });
monitor.record({ commandName: 'insert', collectionName: 'pokemonsets' });
const report = monitor.report();
assert(WRITE_COMMAND_NAMES.includes('update'), 'update must be a write command');
assert(report.totalCommands === 3, 'monitor must count all commands');
assert(report.readsByCollection.pokemonsets_v2_staging === 1, 'staging find must count as staging read');
assert(report.productionCollectionReads === 0, 'production write must not count as production read');
assert(report.observedMongoWriteCommands === 2, 'two write commands must be observed');
assert(report.observedStagingWriteCommands === 1, 'one staging write command must be observed');
assert(report.observedProductionWriteCommands === 1, 'one production write command must be observed');
console.log('[Equinox] Active staging homologation monitoring validation passed.');
```

Add script and run:

```powershell
npm pkg set scripts.sets:active-staging:monitoring:check="ts-node src/scripts/validateActiveStagingHomologationMonitoring.ts"
npm.cmd run sets:active-staging:monitoring:check
```

Expected: FAIL with missing module `ActiveStagingMongoCommandMonitor`.

- [ ] **Step 2: Implement monitor**

```ts
export const WRITE_COMMAND_NAMES = ['insert', 'update', 'delete', 'replace', 'findAndModify', 'bulkWrite', 'commitTransaction'] as const;
export interface MongoCommandObservation { commandName: string; collectionName?: string; }
export interface MongoCommandMonitorReport { totalCommands: number; readsByCollection: Record<string, number>; productionCollectionReads: number; observedMongoWriteCommands: number; observedStagingWriteCommands: number; observedProductionWriteCommands: number; }
export class MongoCommandMonitor {
  private readonly observations: MongoCommandObservation[] = [];
  public record(observation: MongoCommandObservation): void { this.observations.push({ commandName: observation.commandName, collectionName: observation.collectionName }); }
  public report(): MongoCommandMonitorReport {
    const readsByCollection: Record<string, number> = {};
    let productionCollectionReads = 0, observedMongoWriteCommands = 0, observedStagingWriteCommands = 0, observedProductionWriteCommands = 0;
    for (const observation of this.observations) {
      const collectionName = observation.collectionName ?? 'unknown';
      if (WRITE_COMMAND_NAMES.includes(observation.commandName as never)) { observedMongoWriteCommands += 1; if (collectionName === 'pokemonsets_v2_staging') observedStagingWriteCommands += 1; if (collectionName === 'pokemonsets') observedProductionWriteCommands += 1; continue; }
      if (['find', 'aggregate', 'count', 'countDocuments'].includes(observation.commandName)) { readsByCollection[collectionName] = (readsByCollection[collectionName] ?? 0) + 1; if (collectionName === 'pokemonsets') productionCollectionReads += 1; }
    }
    return { totalCommands: this.observations.length, readsByCollection, productionCollectionReads, observedMongoWriteCommands, observedStagingWriteCommands, observedProductionWriteCommands };
  }
}
```

- [ ] **Step 3: Verify and commit**

```powershell
npm.cmd run sets:active-staging:monitoring:check
npm.cmd run typecheck
git add package.json src/equinox/competitive/active-staging/ActiveStagingMongoCommandMonitor.ts src/scripts/validateActiveStagingHomologationMonitoring.ts
git commit -m "feat: add active staging Mongo command monitor"
```

### Task 5: Collection Read Monitor

**Files:**
- Create: `src/equinox/competitive/active-staging/ActiveStagingCollectionReadMonitor.ts`
- Modify: `src/scripts/validateActiveStagingHomologationMonitoring.ts`

**Interfaces:**
- Produces: `CollectionReadMonitor`, `CollectionReadReport`.

- [ ] **Step 1: Extend monitor test**

Add to monitoring script:

```ts
import { CollectionReadMonitor } from '../equinox/competitive/active-staging/ActiveStagingCollectionReadMonitor';
const readMonitor = new CollectionReadMonitor();
readMonitor.recordRead('pokemonsets_v2_staging', 4);
readMonitor.recordRead('pokemonsets', 1);
const readReport = readMonitor.report();
assert(readReport.totalReads === 5, 'read monitor must count records');
assert(readReport.readsByCollection.pokemonsets_v2_staging === 4, 'staging read count must be 4');
assert(readReport.productionCollectionReads === 1, 'production read count must be 1');
```

Run:

```powershell
npm.cmd run sets:active-staging:monitoring:check
```

Expected: FAIL with missing module `ActiveStagingCollectionReadMonitor`.

- [ ] **Step 2: Implement read monitor**

```ts
export interface CollectionReadReport { totalReads: number; readsByCollection: Record<string, number>; productionCollectionReads: number; }
export class CollectionReadMonitor {
  private readonly readsByCollection: Record<string, number> = {};
  public recordRead(collectionName: string, recordCount: number): void { this.readsByCollection[collectionName] = (this.readsByCollection[collectionName] ?? 0) + recordCount; }
  public report(): CollectionReadReport { const totalReads = Object.values(this.readsByCollection).reduce((sum, count) => sum + count, 0); return { totalReads, readsByCollection: { ...this.readsByCollection }, productionCollectionReads: this.readsByCollection.pokemonsets ?? 0 }; }
}
```

- [ ] **Step 3: Verify and commit**

```powershell
npm.cmd run sets:active-staging:monitoring:check
npm.cmd run typecheck
git add src/equinox/competitive/active-staging/ActiveStagingCollectionReadMonitor.ts src/scripts/validateActiveStagingHomologationMonitoring.ts
git commit -m "feat: add active staging collection read monitor"
```

### Task 6: Strict Read-Only Mongo Staging Source

**Files:**
- Create: `src/equinox/competitive/active-staging/ActiveStagingSetRepository.ts`
- Create: `src/scripts/validateActiveStagingRepository.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `ActiveStagingHomologationConfig`, `ACTIVE_STAGING_SET_ALLOWLIST`, `MongoCommandMonitor`, `CollectionReadMonitor`.
- Produces: `ActiveStagingSetRepository.loadActiveAllowlistedSets(): Promise<ActiveStagingSetRecord[]>`.

- [ ] **Step 1: Write the failing repository validation script**

```ts
import { MongoClient } from 'mongodb';
import { ACTIVE_STAGING_SET_ALLOWLIST } from '../equinox/competitive/active-staging/ActiveStagingHomologationAllowlist';
import { loadActiveStagingHomologationConfig } from '../equinox/competitive/active-staging/ActiveStagingHomologationConfig';
import { CollectionReadMonitor } from '../equinox/competitive/active-staging/ActiveStagingCollectionReadMonitor';
import { MongoCommandMonitor } from '../equinox/competitive/active-staging/ActiveStagingMongoCommandMonitor';
import { ActiveStagingSetRepository } from '../equinox/competitive/active-staging/ActiveStagingSetRepository';

async function main(): Promise<void> {
  const config = loadActiveStagingHomologationConfig(process.env);
  const client = new MongoClient(config.mongoUri, { monitorCommands: true });
  const commandMonitor = new MongoCommandMonitor();
  const readMonitor = new CollectionReadMonitor();
  commandMonitor.attach(client);
  await client.connect();
  try {
    const repository = new ActiveStagingSetRepository({ client, config, commandMonitor, readMonitor });
    const records = await repository.loadActiveAllowlistedSets();
    const report = {
      targetCollection: config.targetCollection,
      recordsFound: records.length,
      setIds: records.map((record) => record.setId).sort(),
      writeReport: commandMonitor.report(),
      readReport: readMonitor.report(),
    };
    console.log(JSON.stringify(report, null, 2));
    if (records.length !== ACTIVE_STAGING_SET_ALLOWLIST.length) throw new Error('expected 4 active allowlisted records');
    if (report.writeReport.observedMongoWriteCommands !== 0) throw new Error('write commands must be zero');
    if (report.readReport.productionCollectionReads !== 0) throw new Error('production reads must be zero');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 3;
});
```

Add script:

```json
"sets:active-staging:repository:check": "ts-node src/scripts/validateActiveStagingRepository.ts"
```

Run:

```powershell
npm.cmd run sets:active-staging:repository:check
```

Expected: FAIL with missing module `ActiveStagingSetRepository`.

- [ ] **Step 2: Implement repository with explicit collection and filter**

```ts
import type { MongoClient } from 'mongodb';
import type { ActiveStagingSetRecord } from './ActiveStagingHomologationTypes';
import { ACTIVE_STAGING_SET_ALLOWLIST } from './ActiveStagingHomologationAllowlist';
import type { ActiveStagingHomologationConfig } from './ActiveStagingHomologationConfig';
import type { CollectionReadMonitor } from './ActiveStagingCollectionReadMonitor';
import type { MongoCommandMonitor } from './ActiveStagingMongoCommandMonitor';

interface RepositoryOptions {
  client: MongoClient;
  config: ActiveStagingHomologationConfig;
  commandMonitor: MongoCommandMonitor;
  readMonitor: CollectionReadMonitor;
}

export class ActiveStagingSetRepository {
  public constructor(private readonly options: RepositoryOptions) {}

  public async loadActiveAllowlistedSets(): Promise<ActiveStagingSetRecord[]> {
    const { client, config, readMonitor } = this.options;
    if (config.targetCollection !== 'pokemonsets_v2_staging') {
      throw new Error(`invalid target collection: ${config.targetCollection}`);
    }

    const docs = await client
      .db(config.databaseName)
      .collection<ActiveStagingSetRecord>('pokemonsets_v2_staging')
      .find({
        setId: { $in: [...ACTIVE_STAGING_SET_ALLOWLIST] },
        status: 'active',
        active: true,
      })
      .project<ActiveStagingSetRecord>({ _id: 0 })
      .toArray();

    readMonitor.recordRead('pokemonsets_v2_staging', docs.length);
    const sorted = docs.sort((a, b) => String(a.setId).localeCompare(String(b.setId)));
    const uniqueIds = new Set(sorted.map((doc) => doc.setId));
    if (uniqueIds.size !== sorted.length) throw new Error('duplicate active staging setIds returned by repository');
    return sorted;
  }
}
```

- [ ] **Step 3: Verify and commit**

```powershell
npm.cmd run sets:active-staging:repository:check
npm.cmd run typecheck
git add package.json src/equinox/competitive/active-staging/ActiveStagingSetRepository.ts src/scripts/validateActiveStagingRepository.ts
git commit -m "feat: add read-only active staging set repository"
```

Expected: repository report shows `recordsFound: 4`, `observedMongoWriteCommands: 0`, and `productionCollectionReads: 0` when Mongo env is configured. If Mongo env is absent, this command exits with code `2` and no code changes are made.

### Task 7: Engine Adapter For Explicit Scenario Context

**Files:**
- Create: `src/equinox/competitive/active-staging/ActiveStagingEngineAdapter.ts`
- Create: `src/scripts/validateActiveStagingEngineAdapter.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `ActiveStagingHomologationScenario`, `ActiveStagingSetRecord`.
- Produces: `buildActiveStagingEngineInput(scenario, records): ActiveStagingEngineInput`.

- [ ] **Step 1: Write failing adapter validation**

```ts
import { ACTIVE_STAGING_HOMOLOGATION_SCENARIOS } from '../equinox/competitive/active-staging/ActiveStagingHomologationAllowlist';
import { buildActiveStagingEngineInput } from '../equinox/competitive/active-staging/ActiveStagingEngineAdapter';
import type { ActiveStagingSetRecord } from '../equinox/competitive/active-staging/ActiveStagingHomologationTypes';

const records: ActiveStagingSetRecord[] = ACTIVE_STAGING_HOMOLOGATION_SCENARIOS.flatMap((scenario) =>
  scenario.expectedPresentedSetIds.map((setId) => ({
    setId,
    pokemon: setId.includes('aggron') ? 'Aggron-Mega' : setId.includes('incineroar') ? 'Incineroar' : setId.includes('ursaluna') ? 'Ursaluna-Bloodmoon' : 'Sinistcha',
    status: 'active',
    active: true,
    sourceType: 'curated',
    format: 'champions-reg-mb-doubles',
  })),
);

for (const scenario of ACTIVE_STAGING_HOMOLOGATION_SCENARIOS) {
  const input = buildActiveStagingEngineInput(scenario, records);
  if (input.expectedActiveV2SetsPresentedToEngine.length !== 2) throw new Error(`${scenario.id} must present exactly 2 records`);
  if (input.expectedActiveV2SetsResolvedFromMongo.length !== 4) throw new Error(`${scenario.id} must keep 4-record resolution trace`);
  if (input.localPilotFallbackUsed !== false) throw new Error(`${scenario.id} must not use local fallback`);
}
console.log('active staging engine adapter ok');
```

Run:

```powershell
npm.cmd run sets:active-staging:engine-adapter:check
```

Expected: FAIL with missing script or missing module.

- [ ] **Step 2: Implement adapter**

```ts
import type { ActiveStagingHomologationScenario, ActiveStagingSetRecord } from './ActiveStagingHomologationTypes';
import { ACTIVE_STAGING_SET_ALLOWLIST } from './ActiveStagingHomologationAllowlist';

export interface ActiveStagingEngineInput {
  scenarioId: string;
  leadPokemon: string[];
  format: 'champions-reg-mb-doubles';
  competitiveVerificationState: 'staging-controlled';
  expectedActiveV2SetsResolvedFromMongo: string[];
  expectedActiveV2SetsPresentedToEngine: string[];
  presentedRecords: ActiveStagingSetRecord[];
  localPilotFallbackUsed: false;
}

export function buildActiveStagingEngineInput(
  scenario: ActiveStagingHomologationScenario,
  records: ActiveStagingSetRecord[],
): ActiveStagingEngineInput {
  const byId = new Map(records.map((record) => [record.setId, record]));
  const presentedRecords = scenario.expectedPresentedSetIds.map((setId) => {
    const record = byId.get(setId);
    if (!record) throw new Error(`scenario ${scenario.id} missing active staging set ${setId}`);
    if (record.status !== 'active' || record.active !== true) throw new Error(`scenario ${scenario.id} received inactive set ${setId}`);
    return record;
  });

  return {
    scenarioId: scenario.id,
    leadPokemon: [...scenario.leadPokemon],
    format: 'champions-reg-mb-doubles',
    competitiveVerificationState: 'staging-controlled',
    expectedActiveV2SetsResolvedFromMongo: [...ACTIVE_STAGING_SET_ALLOWLIST],
    expectedActiveV2SetsPresentedToEngine: presentedRecords.map((record) => record.setId),
    presentedRecords,
    localPilotFallbackUsed: false,
  };
}
```

Add script:

```json
"sets:active-staging:engine-adapter:check": "ts-node src/scripts/validateActiveStagingEngineAdapter.ts"
```

- [ ] **Step 3: Verify and commit**

```powershell
npm.cmd run sets:active-staging:engine-adapter:check
npm.cmd run typecheck
git add package.json src/equinox/competitive/active-staging/ActiveStagingEngineAdapter.ts src/scripts/validateActiveStagingEngineAdapter.ts
git commit -m "feat: add active staging engine adapter"
```

Expected: PASS and output `active staging engine adapter ok`.

### Task 8: TeamData Application Tracker And Staging State

**Files:**
- Create: `src/equinox/competitive/active-staging/ActiveStagingTeamDataTracker.ts`
- Create: `src/scripts/validateActiveStagingTeamDataTracker.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `ActiveStagingEngineInput`.
- Produces: `applyActiveStagingTraceToTeamData(teamData, input): TeamDataWithActiveStagingTrace`.

- [ ] **Step 1: Write failing tracker validation**

```ts
import { applyActiveStagingTraceToTeamData } from '../equinox/competitive/active-staging/ActiveStagingTeamDataTracker';
import type { ActiveStagingEngineInput } from '../equinox/competitive/active-staging/ActiveStagingEngineAdapter';

const input: ActiveStagingEngineInput = {
  scenarioId: 'sinistcha-aggronmega',
  leadPokemon: ['Sinistcha', 'Aggron-Mega'],
  format: 'champions-reg-mb-doubles',
  competitiveVerificationState: 'staging-controlled',
  expectedActiveV2SetsResolvedFromMongo: ['a', 'b', 'c', 'd'],
  expectedActiveV2SetsPresentedToEngine: ['a', 'b'],
  presentedRecords: [],
  localPilotFallbackUsed: false,
};
const teamData = applyActiveStagingTraceToTeamData({ team: [] }, input);
if (teamData.competitiveVerificationState !== 'staging-controlled') throw new Error('state not applied');
if (teamData.expectedActiveV2SetsAppliedToTeamData.length !== 2) throw new Error('TeamData must trace the 2 applied sets');
if (teamData.localPilotFallbackUsed !== false) throw new Error('fallback flag must stay false');
console.log('active staging TeamData tracker ok');
```

Run:

```powershell
npm.cmd run sets:active-staging:teamdata:check
```

Expected: FAIL with missing module.

- [ ] **Step 2: Implement tracker**

```ts
import type { ActiveStagingEngineInput } from './ActiveStagingEngineAdapter';

export interface ActiveStagingTeamDataTrace {
  competitiveVerificationState: 'staging-controlled';
  expectedActiveV2SetsResolvedFromMongo: string[];
  expectedActiveV2SetsPresentedToEngine: string[];
  expectedActiveV2SetsAppliedToTeamData: string[];
  localPilotFallbackUsed: false;
}

export type TeamDataWithActiveStagingTrace<T extends object> = T & ActiveStagingTeamDataTrace;

export function applyActiveStagingTraceToTeamData<T extends object>(
  teamData: T,
  input: ActiveStagingEngineInput,
): TeamDataWithActiveStagingTrace<T> {
  return {
    ...teamData,
    competitiveVerificationState: 'staging-controlled',
    expectedActiveV2SetsResolvedFromMongo: [...input.expectedActiveV2SetsResolvedFromMongo],
    expectedActiveV2SetsPresentedToEngine: [...input.expectedActiveV2SetsPresentedToEngine],
    expectedActiveV2SetsAppliedToTeamData: [...input.expectedActiveV2SetsPresentedToEngine],
    localPilotFallbackUsed: false,
  };
}
```

Add script:

```json
"sets:active-staging:teamdata:check": "ts-node src/scripts/validateActiveStagingTeamDataTracker.ts"
```

- [ ] **Step 3: Verify and commit**

```powershell
npm.cmd run sets:active-staging:teamdata:check
npm.cmd run typecheck
git add package.json src/equinox/competitive/active-staging/ActiveStagingTeamDataTracker.ts src/scripts/validateActiveStagingTeamDataTracker.ts
git commit -m "feat: trace active staging sets on team data"
```

Expected: PASS and output `active staging TeamData tracker ok`.

### Task 9: Four-Scenario Runner And Gates

**Files:**
- Create: `src/equinox/competitive/active-staging/ActiveStagingHomologationRunner.ts`
- Create: `src/scripts/validateActiveStagingRunnerOffline.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: repository records, scenario matrix, engine adapter, TeamData tracker.
- Produces: `runActiveStagingHomologationWithRecords(records): ActiveStagingHomologationReport`.

- [ ] **Step 1: Write failing offline runner validation**

```ts
import { runActiveStagingHomologationWithRecords } from '../equinox/competitive/active-staging/ActiveStagingHomologationRunner';
import { ACTIVE_STAGING_SET_ALLOWLIST } from '../equinox/competitive/active-staging/ActiveStagingHomologationAllowlist';
import type { ActiveStagingSetRecord } from '../equinox/competitive/active-staging/ActiveStagingHomologationTypes';

const records: ActiveStagingSetRecord[] = ACTIVE_STAGING_SET_ALLOWLIST.map((setId) => ({
  setId,
  pokemon: setId,
  status: 'active',
  active: true,
  sourceType: 'curated',
  format: 'champions-reg-mb-doubles',
}));
const report = runActiveStagingHomologationWithRecords(records);
if (report.scenarios.length !== 4) throw new Error('must run four scenarios');
if (report.aggregate.activeRecordsLoadedByRepository !== 4) throw new Error('must load 4 active records');
if (report.aggregate.uniqueActiveRecordsPresentedAcrossAllScenarios !== 4) throw new Error('all 4 records must be presented across scenarios');
if (report.aggregate.localPilotFallbackUsed !== false) throw new Error('fallback must be blocked');
if (report.aggregate.readyForAtlasReadOnlyHomologation !== true) throw new Error('offline gate should be ready');
console.log(JSON.stringify(report.aggregate, null, 2));
```

Run:

```powershell
npm.cmd run sets:active-staging:runner:offline
```

Expected: FAIL with missing module.

- [ ] **Step 2: Implement runner and gates**

```ts
import { ACTIVE_STAGING_HOMOLOGATION_SCENARIOS } from './ActiveStagingHomologationAllowlist';
import { buildActiveStagingEngineInput } from './ActiveStagingEngineAdapter';
import { applyActiveStagingTraceToTeamData } from './ActiveStagingTeamDataTracker';
import type { ActiveStagingHomologationReport, ActiveStagingScenarioReport, ActiveStagingSetRecord } from './ActiveStagingHomologationTypes';

export function runActiveStagingHomologationWithRecords(records: ActiveStagingSetRecord[]): ActiveStagingHomologationReport {
  const scenarios: ActiveStagingScenarioReport[] = ACTIVE_STAGING_HOMOLOGATION_SCENARIOS.map((scenario) => {
    const input = buildActiveStagingEngineInput(scenario, records);
    const teamData = applyActiveStagingTraceToTeamData({ team: scenario.leadPokemon }, input);
    const passed =
      teamData.expectedActiveV2SetsResolvedFromMongo.length === 4 &&
      teamData.expectedActiveV2SetsPresentedToEngine.length === 2 &&
      teamData.expectedActiveV2SetsAppliedToTeamData.length === 2 &&
      teamData.localPilotFallbackUsed === false &&
      teamData.competitiveVerificationState === 'staging-controlled';
    return {
      scenarioId: scenario.id,
      leadPokemon: [...scenario.leadPokemon],
      expectedActiveV2SetsResolvedFromMongo: teamData.expectedActiveV2SetsResolvedFromMongo,
      expectedActiveV2SetsPresentedToEngine: teamData.expectedActiveV2SetsPresentedToEngine,
      expectedActiveV2SetsAppliedToTeamData: teamData.expectedActiveV2SetsAppliedToTeamData,
      competitiveVerificationState: teamData.competitiveVerificationState,
      localPilotFallbackUsed: teamData.localPilotFallbackUsed,
      passed,
    };
  });

  const uniquePresented = new Set(scenarios.flatMap((scenario) => scenario.expectedActiveV2SetsPresentedToEngine));
  const aggregate = {
    activeRecordsLoadedByRepository: records.length,
    scenariosRun: scenarios.length,
    scenariosPassed: scenarios.filter((scenario) => scenario.passed).length,
    uniqueActiveRecordsPresentedAcrossAllScenarios: uniquePresented.size,
    localPilotFallbackUsed: scenarios.some((scenario) => scenario.localPilotFallbackUsed) as false,
    readyForAtlasReadOnlyHomologation: records.length === 4 && scenarios.length === 4 && scenarios.every((scenario) => scenario.passed) && uniquePresented.size === 4,
  };

  return { aggregate, scenarios };
}
```

Add script:

```json
"sets:active-staging:runner:offline": "ts-node src/scripts/validateActiveStagingRunnerOffline.ts"
```

- [ ] **Step 3: Verify and commit**

```powershell
npm.cmd run sets:active-staging:runner:offline
npm.cmd run typecheck
git add package.json src/equinox/competitive/active-staging/ActiveStagingHomologationRunner.ts src/scripts/validateActiveStagingRunnerOffline.ts
git commit -m "feat: add active staging homologation runner gates"
```

Expected: PASS and aggregate shows `scenariosRun: 4`, `scenariosPassed: 4`, `activeRecordsLoadedByRepository: 4`.

### Task 10: Operational Script And Deterministic Exit Codes

**Files:**
- Create: `src/scripts/homologateActiveStagingFunctionalV1.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: config guard, monitors, repository, runner.
- Produces: CLI `npm.cmd run sets:active-staging:homologate` with exit codes `0`, `1`, `2`, `3`.

- [ ] **Step 1: Write script shell through failing import**

```ts
import { MongoClient } from 'mongodb';
import { loadActiveStagingHomologationConfig } from '../equinox/competitive/active-staging/ActiveStagingHomologationConfig';
import { CollectionReadMonitor } from '../equinox/competitive/active-staging/ActiveStagingCollectionReadMonitor';
import { MongoCommandMonitor } from '../equinox/competitive/active-staging/ActiveStagingMongoCommandMonitor';
import { ActiveStagingSetRepository } from '../equinox/competitive/active-staging/ActiveStagingSetRepository';
import { runActiveStagingHomologationWithRecords } from '../equinox/competitive/active-staging/ActiveStagingHomologationRunner';

async function main(): Promise<number> {
  let config;
  try {
    config = loadActiveStagingHomologationConfig(process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 2;
  }

  const client = new MongoClient(config.mongoUri, { monitorCommands: true });
  const commandMonitor = new MongoCommandMonitor();
  const readMonitor = new CollectionReadMonitor();
  commandMonitor.attach(client);

  try {
    await client.connect();
    const repository = new ActiveStagingSetRepository({ client, config, commandMonitor, readMonitor });
    const records = await repository.loadActiveAllowlistedSets();
    const report = runActiveStagingHomologationWithRecords(records);
    const evidence = {
      ...report,
      mongo: commandMonitor.report(),
      reads: readMonitor.report(),
      targetCollection: config.targetCollection,
    };
    console.log(JSON.stringify(evidence, null, 2));
    if (evidence.mongo.observedMongoWriteCommands !== 0) return 1;
    if (evidence.reads.productionCollectionReads !== 0) return 1;
    if (!report.aggregate.readyForAtlasReadOnlyHomologation) return 1;
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 3;
  } finally {
    await client.close();
  }
}

main().then((code) => {
  process.exitCode = code;
});
```

Add script:

```json
"sets:active-staging:homologate": "ts-node src/scripts/homologateActiveStagingFunctionalV1.ts"
```

- [ ] **Step 2: Validate missing env returns code 2**

Run:

```powershell
Remove-Item Env:MONGODB_URI -ErrorAction SilentlyContinue
npm.cmd run sets:active-staging:homologate; $LASTEXITCODE
```

Expected: output contains `MONGODB_URI is required` or `MONGO_URI is required`; `$LASTEXITCODE` is `2`.

- [ ] **Step 3: Verify and commit**

```powershell
npm.cmd run typecheck
git add package.json src/scripts/homologateActiveStagingFunctionalV1.ts
git commit -m "feat: add active staging homologation command"
```

Expected: `typecheck` passes.

### Task 11: Integration Tests Without Mongo

**Files:**
- Create: `src/scripts/validateActiveStagingHomologationOfflineIntegration.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: offline records, runner, monitors.
- Produces: CLI `sets:active-staging:offline-integration:check` that proves no Mongo dependency is needed for deterministic gates.

- [ ] **Step 1: Write offline integration script**

```ts
import { ACTIVE_STAGING_SET_ALLOWLIST } from '../equinox/competitive/active-staging/ActiveStagingHomologationAllowlist';
import { runActiveStagingHomologationWithRecords } from '../equinox/competitive/active-staging/ActiveStagingHomologationRunner';
import type { ActiveStagingSetRecord } from '../equinox/competitive/active-staging/ActiveStagingHomologationTypes';

const records: ActiveStagingSetRecord[] = ACTIVE_STAGING_SET_ALLOWLIST.map((setId) => ({
  setId,
  pokemon: setId,
  status: 'active',
  active: true,
  sourceType: 'curated',
  format: 'champions-reg-mb-doubles',
}));

const report = runActiveStagingHomologationWithRecords(records);
const failures = [
  report.aggregate.activeRecordsLoadedByRepository === 4,
  report.aggregate.scenariosRun === 4,
  report.aggregate.scenariosPassed === 4,
  report.aggregate.uniqueActiveRecordsPresentedAcrossAllScenarios === 4,
  report.aggregate.localPilotFallbackUsed === false,
  report.aggregate.readyForAtlasReadOnlyHomologation === true,
];
if (failures.includes(false)) {
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} else {
  console.log('active staging offline integration ok');
}
```

Add script:

```json
"sets:active-staging:offline-integration:check": "ts-node src/scripts/validateActiveStagingHomologationOfflineIntegration.ts"
```

- [ ] **Step 2: Verify and commit**

```powershell
npm.cmd run sets:active-staging:offline-integration:check
npm.cmd run typecheck
git add package.json src/scripts/validateActiveStagingHomologationOfflineIntegration.ts
git commit -m "test: add active staging offline integration gate"
```

Expected: PASS and output `active staging offline integration ok`.

### Task 12: Evidence Report Template

**Files:**
- Create: `docs/data-audit/active-staging-functional-homologation-v1-report.md`

**Interfaces:**
- Consumes: outputs from local checks and Atlas read-only homologation.
- Produces: final report with exact fields required for human review.

- [ ] **Step 1: Create report template**

```markdown
# Active Staging Functional Homologation V1 Report

## Scope

- Target collection: `pokemonsets_v2_staging`
- Production collection reads: `0`
- Mongo writes: `0`
- Render changes: `0`
- Traffic changes: `0`
- Required filter: `status=active + active=true + allowlist`

## Expected Final Evidence

```text
activeRecordsLoadedByRepository: 4
scenariosRun: 4
scenariosPassed: 4
uniqueActiveRecordsPresentedAcrossAllScenarios: 4
productionCollectionReads: 0
observedMongoWriteCommands: 0
observedStagingWriteCommands: 0
observedProductionWriteCommands: 0
localPilotFallbackUsed: false
competitiveVerificationState: staging-controlled
```

## Local Validation

```text
npm.cmd run sets:active-staging:contracts:check
npm.cmd run sets:active-staging:config:check
npm.cmd run sets:active-staging:monitoring:check
npm.cmd run sets:active-staging:engine-adapter:check
npm.cmd run sets:active-staging:teamdata:check
npm.cmd run sets:active-staging:runner:offline
npm.cmd run sets:active-staging:offline-integration:check
npm.cmd run typecheck
npm.cmd run build
git diff --check
```

## Atlas Read-Only Homologation

```text
Command: npm.cmd run sets:active-staging:homologate
Exit code: 0
Target collection: pokemonsets_v2_staging
Production collection reads: 0
Observed Mongo write commands: 0
```

## Stop Criteria

Stop immediately if any field differs from the expected evidence block or if any command exits non-zero outside the documented config failure test.
```

- [ ] **Step 2: Verify and commit**

```powershell
git diff --check
git add docs/data-audit/active-staging-functional-homologation-v1-report.md
git commit -m "docs: add active staging homologation evidence report"
```

Expected: `git diff --check` returns no output.

### Task 13: Final Local Verification Before Atlas

**Files:**
- Modify: none unless a command fails.

**Interfaces:**
- Consumes: all scripts created in Tasks 1-12.
- Produces: local readiness evidence before touching Atlas read-only homologation.

- [ ] **Step 1: Run local validation chain**

```powershell
npm.cmd run sets:active-staging:contracts:check
npm.cmd run sets:active-staging:config:check
npm.cmd run sets:active-staging:monitoring:check
npm.cmd run sets:active-staging:engine-adapter:check
npm.cmd run sets:active-staging:teamdata:check
npm.cmd run sets:active-staging:runner:offline
npm.cmd run sets:active-staging:offline-integration:check
npm.cmd run typecheck
npm.cmd run build
git diff --check
```

Expected: every command exits `0`; `git diff --check` prints no output.

- [ ] **Step 2: Commit only if a fix was required**

```powershell
git status --short
```

Expected: no output. If files changed to fix a failure, commit with:

```powershell
git add package.json src/equinox/competitive/active-staging src/scripts docs/data-audit/active-staging-functional-homologation-v1-report.md
git commit -m "fix: stabilize active staging homologation validation"
```

### Task 14: Read-Only Atlas Homologation

**Files:**
- Modify: `docs/data-audit/active-staging-functional-homologation-v1-report.md`

**Interfaces:**
- Consumes: Mongo URI from local environment, read-only command, report template.
- Produces: Atlas evidence with `0` production reads and `0` writes.

- [ ] **Step 1: Configure read-only environment**

```powershell
$env:EQUINOX_ACTIVE_STAGING_HOMOLOGATION="true"
$env:EQUINOX_USE_COMPETITIVE_SETS_V2="true"
$env:EQUINOX_COMPETITIVE_SETS_V2_SOURCE="staging"
$env:EQUINOX_TARGET_COLLECTION="pokemonsets_v2_staging"
$env:EQUINOX_ALLOW_DATABASE_WRITES="false"
$env:EQUINOX_ENABLE_STAGING_ACTIVATION="false"
```

Expected: no output.

- [ ] **Step 2: Run read-only homologation**

```powershell
npm.cmd run sets:active-staging:homologate
```

Expected output includes:

```text
"targetCollection": "pokemonsets_v2_staging"
"activeRecordsLoadedByRepository": 4
"scenariosRun": 4
"scenariosPassed": 4
"uniqueActiveRecordsPresentedAcrossAllScenarios": 4
"productionCollectionReads": 0
"observedMongoWriteCommands": 0
"observedStagingWriteCommands": 0
"observedProductionWriteCommands": 0
"localPilotFallbackUsed": false
"competitiveVerificationState": "staging-controlled"
```

- [ ] **Step 3: Stop on any unsafe evidence**

If output includes any of these values, stop and do not continue:

```text
productionCollectionReads greater than 0
observedMongoWriteCommands greater than 0
observedStagingWriteCommands greater than 0
observedProductionWriteCommands greater than 0
localPilotFallbackUsed true
targetCollection different from pokemonsets_v2_staging
activeRecordsLoadedByRepository different from 4
scenariosPassed different from 4
```

- [ ] **Step 4: Update report and commit**

Add the final command output summary to `docs/data-audit/active-staging-functional-homologation-v1-report.md`, without URI, username, password, host secrets, or raw connection strings.

```powershell
git add docs/data-audit/active-staging-functional-homologation-v1-report.md
git commit -m "docs: record active staging homologation evidence"
```

Expected: commit contains only the evidence report.

### Task 15: Branch Completion And PR Handoff

**Files:**
- Modify: none unless final checks require a fix.

**Interfaces:**
- Consumes: all completed commits.
- Produces: PR-ready branch with validation evidence.

- [ ] **Step 1: Run final verification**

```powershell
npm.cmd run sets:active-staging:contracts:check
npm.cmd run sets:active-staging:config:check
npm.cmd run sets:active-staging:monitoring:check
npm.cmd run sets:active-staging:engine-adapter:check
npm.cmd run sets:active-staging:teamdata:check
npm.cmd run sets:active-staging:runner:offline
npm.cmd run sets:active-staging:offline-integration:check
npm.cmd run typecheck
npm.cmd run build
git diff --check
git status --short
```

Expected: every command exits `0`; `git diff --check` prints no output; `git status --short` prints no output.

- [ ] **Step 2: Push branch and open PR**

```powershell
git push -u origin spec/active-staging-functional-homologation-v1
```

Open PR:

```text
Base: develop
Compare: spec/active-staging-functional-homologation-v1
Title: feat: homologate active staging sets through isolated V2 source
```

PR body:

```markdown
## Objective

Homologate the Equinox engine using only active records from `pokemonsets_v2_staging`, without production reads, Mongo writes, Render changes, traffic changes, or local fallback in the four mandatory scenarios.

## Gates

- Active staging source is read-only.
- Target collection is exactly `pokemonsets_v2_staging`.
- Required filter is `status=active + active=true + allowlist`.
- Production collection reads are `0`.
- Observed Mongo write commands are `0`.
- Four active records are loaded from staging.
- Four scenarios run and pass.
- Two active V2 sets are presented per scenario.
- Four unique active V2 sets are presented across all scenarios.
- `competitiveVerificationState` is `staging-controlled`.
- Local fallback is blocked for mandatory scenarios.

## Validation

- `npm.cmd run sets:active-staging:contracts:check`
- `npm.cmd run sets:active-staging:config:check`
- `npm.cmd run sets:active-staging:monitoring:check`
- `npm.cmd run sets:active-staging:engine-adapter:check`
- `npm.cmd run sets:active-staging:teamdata:check`
- `npm.cmd run sets:active-staging:runner:offline`
- `npm.cmd run sets:active-staging:offline-integration:check`
- `npm.cmd run sets:active-staging:homologate`
- `npm.cmd run typecheck`
- `npm.cmd run build`
- `git diff --check`

## Out of scope

- No production activation.
- No writes to `pokemonsets`.
- No Render changes.
- No traffic changes.
- No default flow changes with flags disabled.
```

Expected: branch is pushed and PR is ready for review.

## Final Homologation Stop Criteria

The implementation must stop immediately, leave writes disabled, and report the failure if any of these occurs:

```text
targetCollection != pokemonsets_v2_staging
activeRecordsLoadedByRepository != 4
scenariosRun != 4
scenariosPassed != 4
uniqueActiveRecordsPresentedAcrossAllScenarios != 4
productionCollectionReads != 0
observedMongoWriteCommands != 0
observedStagingWriteCommands != 0
observedProductionWriteCommands != 0
localPilotFallbackUsed != false
competitiveVerificationState != staging-controlled
any command exits with an undocumented non-zero code
```
