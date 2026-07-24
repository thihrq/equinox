import { evaluateTeamScenario } from '../services/competitive-data/expert/engines/TeamScenarioEngine';
import { TeamScenarioInput } from '../services/competitive-data/expert/engines/TeamScenarioTypes';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function scenario(overrides: Partial<TeamScenarioInput> = {}): TeamScenarioInput {
  return {
    candidateId: 'candidate-1',
    fullTeamPokemonIds: ['a', 'b', 'c', 'd', 'e', 'f'],
    leadPokemonIds: ['a', 'b'],
    opposingLeadPokemonIds: ['x', 'y'],
    scenarioType: 'tailwind',
    trickRoomTurns: 0,
    tailwindTurns: 3,
    assumptions: ['lead positions are fixed for this scenario'],
    limitations: ['does not simulate individual move choices'],
    ...overrides,
  };
}

const favorable = evaluateTeamScenario(scenario({ teamFeatures: { speedControl: ['Tailwind'] } }));
assert(favorable.valid && favorable.result === 'supports-candidate', 'favorable Tailwind scenario failed');

const neutral = evaluateTeamScenario(scenario({ scenarioType: 'opening', teamFeatures: {} }));
assert(neutral.result === 'mixed', 'neutral scenario should be mixed');

const adverse = evaluateTeamScenario(scenario({ teamFeatures: {}, tailwindTurns: 0, opposingFeatures: { speedControl: ['Tailwind'] } }));
assert(adverse.result === 'does-not-support-candidate', 'adverse scenario should reject support');

const trickRoom = evaluateTeamScenario(scenario({ scenarioType: 'trick-room', trickRoomTurns: 3, teamFeatures: { speedControl: ['Trick Room'] } }));
assert(trickRoom.result === 'supports-candidate', 'Trick Room scenario failed');

const weather = evaluateTeamScenario(scenario({ scenarioType: 'weather-control', weather: 'Rain', teamFeatures: { weather: ['Rain'] }, opposingFeatures: { weather: ['Sun'] } }));
assert(weather.favorableFactors.length > 0 && weather.unfavorableFactors.length > 0, 'weather war should record both sides');

const support = evaluateTeamScenario(scenario({ scenarioType: 'positioning', teamFeatures: { redirection: true, fakeOut: true, priority: true } }));
assert(support.result === 'supports-candidate', 'redirection and Fake Out support scenario failed');

const unsupported = evaluateTeamScenario(scenario({ scenarioType: 'opening', unsupportedMechanics: ['unknown-terrain-rule'] }));
assert(unsupported.result === 'insufficient-evidence', 'unsupported mechanic should not produce a confident result');
assert(unsupported.unsupportedMechanics.includes('unknown-terrain-rule'), 'unsupported mechanic was not recorded');

const missingAssumptions = evaluateTeamScenario(scenario({ assumptions: undefined }));
assert(!missingAssumptions.valid && missingAssumptions.findings.some(finding => finding.code === 'SCENARIO_ASSUMPTIONS_MISSING'), 'missing assumptions should invalidate scenario');

const missingLimitations = evaluateTeamScenario(scenario({ limitations: undefined }));
assert(!missingLimitations.valid && missingLimitations.findings.some(finding => finding.code === 'SCENARIO_LIMITATIONS_MISSING'), 'missing limitations should invalidate scenario');

const repeat = evaluateTeamScenario(scenario({ teamFeatures: { speedControl: ['Tailwind'] } }));
assert(repeat.resultDigest === favorable.resultDigest, 'same scenario must generate same digest');

console.log('[Equinox] Team scenario engine tests passed.');
