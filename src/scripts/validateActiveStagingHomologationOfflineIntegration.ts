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
const failures = [
  report.aggregate.activeRecordsLoadedByRepository === 4,
  report.aggregate.scenariosRun === 4,
  report.aggregate.scenariosPassed === 4,
  report.aggregate.uniqueActiveRecordsPresentedAcrossAllScenarios === 4,
  report.aggregate.scenariosWithEngineExecution === 4,
  report.aggregate.scenariosWithZeroFallbacks === 4,
  report.aggregate.localPilotFallbackUsed === false,
  report.aggregate.readyForAtlasReadOnlyHomologation === true,
];

if (failures.includes(false)) {
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} else {
  console.log('active staging offline integration ok');
}
