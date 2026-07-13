import evidenceFixture from '../equinox/data-packs/competitive/champions-reg-mb-doubles/verified-evidence.fixture.json';

interface VerifiedEvidenceRecord {
  setId: string;
  approvedMatchupScenarios: string[];
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const evidenceRecords = (evidenceFixture as { records: VerifiedEvidenceRecord[] }).records;
const failures = evidenceRecords.flatMap(record => {
  const approvedScenarioIds = record.approvedMatchupScenarios.filter(scenarioId => scenarioId.trim().length > 0);

  return approvedScenarioIds.length >= 2
    ? []
    : [`${record.setId}: requires at least two approved matchup scenario IDs before verified promotion; received ${approvedScenarioIds.length}.`];
});

assert(failures.length === 0, `Verified matchup evidence validation failed:\n${failures.join('\n')}`);

console.log(`[Equinox] Verified matchup evidence validation passed for ${evidenceRecords.length} records.`);
