import fs from 'fs';
import {
  ACTIVE_STAGING_SET_ALLOWLIST,
  ACTIVE_STAGING_HOMOLOGATION_SCENARIOS,
} from '../equinox/competitive/active-staging/ActiveStagingHomologationAllowlist';
import { runActiveStagingHomologationWithRecords } from '../equinox/competitive/active-staging/ActiveStagingHomologationRunner';
import type { ActiveStagingSetRecord } from '../equinox/competitive/active-staging/ActiveStagingHomologationTypes';

const expectedRecordCount = ACTIVE_STAGING_SET_ALLOWLIST.length;
const expectedScenarioCount = ACTIVE_STAGING_HOMOLOGATION_SCENARIOS.length;

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
  report.aggregate.activeRecordsLoadedByRepository === expectedRecordCount,
  report.aggregate.scenariosRun === expectedScenarioCount,
  report.aggregate.scenariosPassed === expectedScenarioCount,
  report.aggregate.uniqueActiveRecordsPresentedAcrossAllScenarios === expectedRecordCount,
  report.aggregate.scenariosWithEngineExecution === expectedScenarioCount,
  report.aggregate.scenariosWithZeroFallbacks === expectedScenarioCount,
  report.aggregate.localPilotFallbackUsed === false,
  report.aggregate.readyForAtlasReadOnlyHomologation === true,
];

if (failures.includes(false)) {
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} else {
  console.log('active staging offline integration ok');
}
