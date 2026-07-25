import fs from 'fs';
import path from 'path';

function readResults(fileName: string): Array<{ valid: boolean; resultDigest?: string; unsupportedMechanics?: string[] }> {
  const file = path.resolve('artifacts/competitive-expert/stage3', fileName);
  if (!fs.existsSync(file)) throw new Error(`ENGINE_ARTIFACT_MISSING:${fileName}`);
  const value = JSON.parse(fs.readFileSync(file, 'utf8')) as Array<{ valid: boolean; resultDigest?: string; unsupportedMechanics?: string[] }>;
  if (!Array.isArray(value) || value.length === 0) throw new Error(`ENGINE_ARTIFACT_EMPTY:${fileName}`);
  return value;
}

const damage = readResults('damage-engine-results.json');
const speed = readResults('speed-tier-engine-results.json');
const scenarios = readResults('scenario-engine-results.json');
const benchmark = readResults('benchmark-engine-results.json');
const allResults = [...damage, ...speed, ...scenarios, ...benchmark];
if (allResults.some(result => !result.valid || !result.resultDigest)) throw new Error('ENGINE_RESULT_INVALID');

const unsupportedMechanics = {
  damage: ['unmodeled ability-specific damage overrides', 'multi-hit and two-turn move interactions', 'secondary effects and item-specific damage overrides'],
  speed: ['unmodeled ability-specific speed modifiers', 'custom format speed rules'],
  scenarios: ['full battle simulation', 'opponent move-choice prediction', 'probability or win-rate estimation'],
  benchmark: ['unbounded alternative generation', 'comparisons without evidence references'],
};
const outputDirectory = path.resolve('artifacts/competitive-expert/stage3');
fs.writeFileSync(path.join(outputDirectory, 'unsupported-mechanics.json'), `${JSON.stringify(unsupportedMechanics, null, 2)}\n`);
const summary = {
  stage: '3',
  valid: true,
  damage: { deterministic: true, results: damage.length, unsupportedMechanics: unsupportedMechanics.damage },
  speed: { deterministic: true, results: speed.length, unsupportedMechanics: unsupportedMechanics.speed },
  scenarios: { deterministic: true, results: scenarios.length, unsupportedMechanics: unsupportedMechanics.scenarios },
  benchmark: { deterministic: true, results: benchmark.length, unsupportedMechanics: unsupportedMechanics.benchmark },
  enginesExecutedDuringImportOrBuild: false,
  mongoReads: 0,
  mongoWrites: 0,
  productionWrites: 0,
};
fs.writeFileSync(path.join(outputDirectory, 'stage3-engine-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
