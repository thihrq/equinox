import fs from 'fs';
import { ACTIVE_STAGING_SET_ALLOWLIST } from '../equinox/competitive/active-staging/ActiveStagingHomologationAllowlist';
import { runActiveStagingHomologationWithRecords } from '../equinox/competitive/active-staging/ActiveStagingHomologationRunner';
import type { ActiveStagingSetRecord } from '../equinox/competitive/active-staging/ActiveStagingHomologationTypes';

const pack = JSON.parse(fs.readFileSync('src/equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json', 'utf8'));
const allowlistedSetIds = new Set<string>(ACTIVE_STAGING_SET_ALLOWLIST);
const records: ActiveStagingSetRecord[] = pack.sets
  .filter((set: ActiveStagingSetRecord) => allowlistedSetIds.has(set.setId))
  .map((set: ActiveStagingSetRecord) => ({
    ...set,
    pokemon: set.pokemonName ?? set.pokemon,
    status: 'active',
    active: true,
    format: 'champions-reg-mb-doubles',
  }));

const report = runActiveStagingHomologationWithRecords(records);

if (report.scenarios.length !== 4) throw new Error('must run four scenarios');
if (report.aggregate.activeRecordsLoadedByRepository !== 4) throw new Error('must load 4 active records');
if (report.aggregate.uniqueActiveRecordsPresentedAcrossAllScenarios !== 4) throw new Error('all 4 records must be presented across scenarios');
if (report.aggregate.scenariosWithEngineExecution !== 4) throw new Error('all 4 scenarios must execute the VGC engine probe');
if (report.aggregate.scenariosWithZeroFallbacks !== 4) throw new Error('all 4 scenarios must consume active V2 data without fallbacks');
if (report.aggregate.localPilotFallbackUsed !== false) throw new Error('fallback must be blocked');
if (report.aggregate.readyForAtlasReadOnlyHomologation !== true) throw new Error('offline gate should be ready');

console.log(JSON.stringify(report.aggregate, null, 2));
