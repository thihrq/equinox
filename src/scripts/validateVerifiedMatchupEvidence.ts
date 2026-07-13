import pilotPack from '../equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json';
import evidenceFixture from '../equinox/data-packs/competitive/champions-reg-mb-doubles/verified-evidence.fixture.json';
import scenarioFixture from '../equinox/data-packs/competitive/champions-reg-mb-doubles/verified-matchup-scenarios.fixture.json';

interface VerifiedEvidenceRecord {
  setId: string;
  approvedMatchupScenarios: string[];
}

interface VerifiedMatchupScenario {
  scenarioId: string;
  label: string;
  lead: string[];
  opposingThreats: string[];
  validationGoal: string;
  approvedForSets: string[];
  evidenceLevel: string;
  reviewResult: string;
  notes: string;
}

interface PilotSet {
  setId: string;
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const expectedFormatId = 'champions_reg_m_b_doubles';
const acceptedEvidenceLevel = 'internal-scenario-review';
const evidence = evidenceFixture as { formatId: string; records: VerifiedEvidenceRecord[] };
const scenarios = scenarioFixture as {
  formatId: string;
  acceptedEvidenceLevels: string[];
  scenarios: VerifiedMatchupScenario[];
};
const pilotSets = (pilotPack as { sets: PilotSet[] }).sets;
const pilotSetIds = new Set(pilotSets.map(set => set.setId));
const scenariosById = new Map(scenarios.scenarios.map(scenario => [scenario.scenarioId, scenario]));
const failures: string[] = [];

if (evidence.formatId !== expectedFormatId) {
  failures.push(`Evidence fixture formatId must be ${expectedFormatId}; received ${evidence.formatId}.`);
}

if (scenarios.formatId !== expectedFormatId) {
  failures.push(`Scenario fixture formatId must be ${expectedFormatId}; received ${scenarios.formatId}.`);
}

if (
  scenarios.acceptedEvidenceLevels.length !== 1 ||
  scenarios.acceptedEvidenceLevels[0] !== acceptedEvidenceLevel
) {
  failures.push(`Scenario fixture acceptedEvidenceLevels must be exactly ${acceptedEvidenceLevel}.`);
}

for (const setId of pilotSetIds) {
  const evidenceRecordCount = evidence.records.filter(record => record.setId === setId).length;
  if (evidenceRecordCount !== 1) {
    failures.push(`${setId}: requires exactly one evidence record; received ${evidenceRecordCount}.`);
  }
}

const duplicateScenarioIds = scenarios.scenarios
  .map(scenario => scenario.scenarioId)
  .filter((scenarioId, index, scenarioIds) => scenarioIds.indexOf(scenarioId) !== index);

for (const scenarioId of new Set(duplicateScenarioIds)) {
  failures.push(`${scenarioId}: scenario IDs must be unique.`);
}

for (const scenario of scenarios.scenarios) {
  if (scenario.evidenceLevel !== acceptedEvidenceLevel) {
    failures.push(`${scenario.scenarioId}: evidenceLevel must be ${acceptedEvidenceLevel}; received ${scenario.evidenceLevel}.`);
  }

  for (const setId of scenario.approvedForSets) {
    if (!pilotSetIds.has(setId)) {
      failures.push(`${scenario.scenarioId}: approvedForSets references unknown pilot set ${setId}.`);
    }
  }
}

for (const record of evidence.records) {
  const approvedScenarioIds = record.approvedMatchupScenarios.filter(scenarioId => scenarioId.trim().length > 0);
  const distinctApprovedScenarioIds = new Set(approvedScenarioIds);

  if (distinctApprovedScenarioIds.size < 2) {
    failures.push(`${record.setId}: requires at least two distinct approved matchup scenario IDs before verified promotion; received ${distinctApprovedScenarioIds.size}.`);
  }

  for (const scenarioId of distinctApprovedScenarioIds) {
    const scenario = scenariosById.get(scenarioId);
    if (!scenario) {
      failures.push(`${record.setId}: references unknown matchup scenario ${scenarioId}.`);
      continue;
    }

    if (scenario.reviewResult !== 'approved') {
      failures.push(`${record.setId}: scenario ${scenarioId} must have reviewResult approved; received ${scenario.reviewResult}.`);
    }

    if (!scenario.approvedForSets.includes(record.setId)) {
      failures.push(`${record.setId}: scenario ${scenarioId} does not include the set in approvedForSets.`);
    }
  }
}

assert(failures.length === 0, `Verified matchup evidence validation failed:\n${failures.join('\n')}`);

console.log(`[Equinox] Verified matchup evidence validation passed for ${evidence.records.length} records.`);
