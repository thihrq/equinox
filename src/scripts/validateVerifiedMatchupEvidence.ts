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
  for (const setId of scenario.approvedForSets) {
    if (!pilotSetIds.has(setId)) {
      failures.push(`${scenario.scenarioId}: approvedForSets references unknown pilot set ${setId}.`);
    }
  }
}

for (const record of evidence.records) {
  const approvedScenarioIds = record.approvedMatchupScenarios.filter(scenarioId => scenarioId.trim().length > 0);

  if (approvedScenarioIds.length < 2) {
    failures.push(`${record.setId}: requires at least two approved matchup scenario IDs before verified promotion; received ${approvedScenarioIds.length}.`);
  }

  for (const scenarioId of approvedScenarioIds) {
    const scenario = scenariosById.get(scenarioId);
    if (!scenario) {
      failures.push(`${record.setId}: references unknown matchup scenario ${scenarioId}.`);
      continue;
    }

    if (scenario.reviewResult !== 'approved') {
      failures.push(`${record.setId}: scenario ${scenarioId} must have reviewResult approved; received ${scenario.reviewResult}.`);
    }

    if (!scenarios.acceptedEvidenceLevels.includes(scenario.evidenceLevel)) {
      failures.push(`${record.setId}: scenario ${scenarioId} uses unaccepted evidenceLevel ${scenario.evidenceLevel}.`);
    }

    if (!scenario.approvedForSets.includes(record.setId)) {
      failures.push(`${record.setId}: scenario ${scenarioId} does not include the set in approvedForSets.`);
    }
  }
}

assert(failures.length === 0, `Verified matchup evidence validation failed:\n${failures.join('\n')}`);

console.log(`[Equinox] Verified matchup evidence validation passed for ${evidence.records.length} records.`);
