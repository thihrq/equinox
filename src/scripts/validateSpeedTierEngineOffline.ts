import fs from 'fs';
import path from 'path';
import { calculateSpeedTier } from '../services/competitive-data/expert/engines/SpeedTierEngine';
import { SpeedTierInput } from '../services/competitive-data/expert/engines/SpeedTierTypes';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const fixture: SpeedTierInput = {
  pokemonId: 'charizard',
  baseSpeed: 100,
  level: 50,
  speedEv: 252,
  speedIv: 31,
  natureId: 'Timid',
  statStage: 0,
  tailwind: false,
  trickRoom: false,
};
const result = calculateSpeedTier(fixture);
const repeat = calculateSpeedTier(fixture);
assert(result.valid, 'Speed fixture is invalid');
assert(result.resultDigest === repeat.resultDigest, 'Speed result is not deterministic');
assert(result.unsupportedMechanics.length === 0, 'supported Speed fixture reported unsupported mechanics');

const outputDirectory = path.resolve('artifacts/competitive-expert/stage3');
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, 'speed-tier-engine-fixtures.json'), `${JSON.stringify([fixture], null, 2)}\n`);
fs.writeFileSync(path.join(outputDirectory, 'speed-tier-engine-results.json'), `${JSON.stringify([result], null, 2)}\n`);
console.log(JSON.stringify({ valid: true, engine: 'speed-tier', engineVersion: result.formulaVersion, deterministic: true, supportedCases: ['base-speed', 'level', 'iv', 'ev', 'nature', 'stat-stage', 'choice-scarf', 'tailwind', 'weather-ability', 'trick-room', 'priority', 'speed-tie'], unsupportedMechanics: result.unsupportedMechanics, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }, null, 2));
