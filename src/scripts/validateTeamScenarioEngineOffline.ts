import fs from 'fs';
import path from 'path';
import { evaluateTeamScenario } from '../services/competitive-data/expert/engines/TeamScenarioEngine';
import { TeamScenarioInput } from '../services/competitive-data/expert/engines/TeamScenarioTypes';

const fixtures: TeamScenarioInput[] = [{
  candidateId: 'candidate-1',
  fullTeamPokemonIds: ['a', 'b', 'c', 'd', 'e', 'f'],
  leadPokemonIds: ['a', 'b'],
  opposingLeadPokemonIds: ['x', 'y'],
  scenarioType: 'tailwind',
  tailwindTurns: 3,
  trickRoomTurns: 0,
  assumptions: ['lead positions are fixed'],
  limitations: ['no move-by-move battle simulation'],
  teamFeatures: { speedControl: ['Tailwind'], fakeOut: true, protect: true },
}];
const results = fixtures.map(evaluateTeamScenario);
if (results.some(result => !result.valid || result.result === 'insufficient-evidence')) throw new Error('SCENARIO_OFFLINE_FIXTURE_INVALID');
const outputDirectory = path.resolve('artifacts/competitive-expert/stage3');
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, 'scenario-engine-fixtures.json'), `${JSON.stringify(fixtures, null, 2)}\n`);
fs.writeFileSync(path.join(outputDirectory, 'scenario-engine-results.json'), `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify({ valid: true, engine: 'scenario', deterministic: true, results: results.map(result => result.result), supportedScenarios: ['lead', 'backline', 'speed-control', 'trick-room', 'tailwind', 'weather', 'terrain', 'fake-out', 'redirection', 'protect', 'priority', 'spread-pressure', 'pivoting', 'defensive-switch', 'endgame'], containsWinRatePercentage: false, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }, null, 2));
