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

if (report.scenarios.length !== 4) throw new Error('must run four scenarios');
if (report.aggregate.activeRecordsLoadedByRepository !== 4) throw new Error('must load 4 active records');
if (report.aggregate.uniqueActiveRecordsPresentedAcrossAllScenarios !== 4) throw new Error('all 4 records must be presented across scenarios');
if (report.aggregate.localPilotFallbackUsed !== false) throw new Error('fallback must be blocked');
if (report.aggregate.readyForAtlasReadOnlyHomologation !== true) throw new Error('offline gate should be ready');

console.log(JSON.stringify(report.aggregate, null, 2));
