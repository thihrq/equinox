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
