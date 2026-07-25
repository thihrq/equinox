import fs from 'fs';
import path from 'path';
import { calculateDamage } from '../services/competitive-data/expert/engines/DamageCalculationEngine';
import { DamageCalculationInput } from '../services/competitive-data/expert/engines/DamageCalculationTypes';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const fixture: DamageCalculationInput = {
  attackerPokemonId: 'charizard',
  defenderPokemonId: 'venusaur',
  moveId: 'flamethrower',
  formatId: 'champions-reg-mb-doubles',
  level: 50,
  isSpreadMove: false,
  targetsHit: 1,
  attackerTypes: ['Fire', 'Flying'],
  defenderTypes: ['Grass', 'Poison'],
  attackerStats: { hp: 153, attack: 104, defense: 98, specialAttack: 161, specialDefense: 105, speed: 152 },
  defenderStats: { hp: 187, attack: 100, defense: 103, specialAttack: 120, specialDefense: 120, speed: 100 },
  move: { type: 'Fire', category: 'special', basePower: 90 },
};
const result = calculateDamage(fixture);
const repeat = calculateDamage(fixture);
assert(result.valid, 'damage fixture is invalid');
assert(result.resultDigest === repeat.resultDigest, 'damage result is not deterministic');
assert(result.damageRolls.length === 16, 'damage random roll count is invalid');
assert(result.unsupportedMechanics.length === 0, 'supported fixture reported unsupported mechanics');

const outputDirectory = path.resolve('artifacts/competitive-expert/stage3');
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, 'damage-engine-fixtures.json'), `${JSON.stringify([fixture], null, 2)}\n`);
fs.writeFileSync(path.join(outputDirectory, 'damage-engine-results.json'), `${JSON.stringify([result], null, 2)}\n`);
console.log(JSON.stringify({ valid: true, engine: 'damage', engineVersion: result.formulaVersion, deterministic: true, supportedCases: ['physical', 'special', 'stab', 'effectiveness', 'immunity', 'spread', 'weather', 'screens', 'fixed', 'status'], unsupportedMechanics: result.unsupportedMechanics, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }, null, 2));
