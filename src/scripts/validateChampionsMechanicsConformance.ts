import fs from 'fs';
import path from 'path';
import { calculateDamage } from '../services/competitive-data/expert/engines/DamageCalculationEngine';
import { calculateSpeedTier, compareActionOrder } from '../services/competitive-data/expert/engines/SpeedTierEngine';
import { IndependentDamageFixture, IndependentSpeedFixture } from '../services/competitive-data/reference-conformance/contracts/ReferenceConformanceContracts';

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function fail(message: string, code: number): never { console.error(message); process.exitCode = code; throw new Error(message); }
function writeAtomic(file: string, value: unknown): void { const temporary = `${file}.tmp-${process.pid}`; fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); fs.renameSync(temporary, file); }
function main(): void {
  const allowed = new Set(['--run-id', '--output-dir']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  const outputDir = arg('--output-dir') ?? `artifacts/competitive-production-readiness/${runId ?? 'missing-run-id'}/mechanics-reference`;
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const damagePackage = JSON.parse(fs.readFileSync(path.resolve(outputDir, 'damage-canonical-fixtures.json'), 'utf8')) as { fixtures: IndependentDamageFixture[] };
  const speedPackage = JSON.parse(fs.readFileSync(path.resolve(outputDir, 'speed-canonical-fixtures.json'), 'utf8')) as { fixtures: IndependentSpeedFixture[] };
  const damageResults = damagePackage.fixtures.map(fixture => {
    const actual = calculateDamage({
      attackerPokemonId: fixture.attacker.species, defenderPokemonId: fixture.defender.species, moveId: fixture.move.name, formatId: 'champions-reg-mb-doubles', level: fixture.attacker.level,
      isSpreadMove: fixture.move.spread, targetsHit: fixture.move.spread ? 2 : 1, weather: fixture.field.weather, terrain: fixture.field.terrain,
      attackerTypes: fixture.attacker.types, defenderTypes: fixture.defender.types,
      attackerStats: { hp: 1, attack: fixture.expected.calculatedAttackStat, defense: 1, specialAttack: fixture.expected.calculatedAttackStat, specialDefense: 1, speed: 1 },
      defenderStats: { hp: fixture.expected.defenderHp, attack: 1, defense: fixture.expected.calculatedDefenseStat, specialAttack: 1, specialDefense: fixture.expected.calculatedDefenseStat, speed: 1 },
      move: { type: fixture.move.type, category: fixture.move.category.toLowerCase() === 'physical' ? 'physical' : 'special', basePower: fixture.move.basePower },
      screens: { reflect: fixture.field.reflect, lightScreen: fixture.field.lightScreen, auroraVeil: fixture.field.auroraVeil },
    });
    const pass = actual.minDamage === fixture.expected.minDamage && actual.maxDamage === fixture.expected.maxDamage;
    return { fixtureId: fixture.fixtureId, status: pass ? 'pass' : 'fail', expected: [fixture.expected.minDamage, fixture.expected.maxDamage], actual: [actual.minDamage, actual.maxDamage], engineVersion: actual.formulaVersion };
  });
  const speedResults = speedPackage.fixtures.map(fixture => {
    const actorResult = calculateSpeedTier({
      pokemonId: fixture.actor.species, baseSpeed: fixture.actor.baseSpeed, level: fixture.actor.level,
      speedEv: fixture.actor.speedEv, speedIv: fixture.actor.speedIv, natureId: fixture.actor.nature, statStage: fixture.actor.speedStage,
      abilityId: fixture.actor.ability, itemId: fixture.actor.item, tailwind: fixture.battleContext.actorTailwind, trickRoom: fixture.battleContext.trickRoom,
      weather: fixture.battleContext.weather, paralyzed: fixture.actor.status === 'par', movePriority: fixture.actor.movePriority,
    });
    const opponentResult = calculateSpeedTier({
      pokemonId: fixture.opponent.species, baseSpeed: fixture.opponent.baseSpeed, level: fixture.opponent.level,
      speedEv: fixture.opponent.speedEv, speedIv: fixture.opponent.speedIv, natureId: fixture.opponent.nature, statStage: fixture.opponent.speedStage,
      abilityId: fixture.opponent.ability, itemId: fixture.opponent.item, tailwind: fixture.battleContext.opponentTailwind, trickRoom: fixture.battleContext.trickRoom,
      weather: fixture.battleContext.weather, paralyzed: fixture.opponent.status === 'par', movePriority: fixture.opponent.movePriority,
    });
    if (!actorResult.valid || !opponentResult.valid) {
      const isDocumentedPriorityAbilityGap = fixture.assumptions.includes('category:priority-ability');
      return { fixtureId: fixture.fixtureId, status: isDocumentedPriorityAbilityGap ? 'unsupported-as-expected' : 'blocked' };
    }
    const order = compareActionOrder({ speed: actorResult.modifiedSpeed!, priority: actorResult.priorityBracket! }, { speed: opponentResult.modifiedSpeed!, priority: opponentResult.priorityBracket! }, fixture.battleContext.trickRoom);
    const pass = actorResult.calculatedSpeed === fixture.expected.actorCalculatedSpeed && actorResult.modifiedSpeed === fixture.expected.actorEffectiveSpeed && actorResult.priorityBracket === fixture.expected.actorPriorityBracket && (order === 'tie') === fixture.expected.speedTie;
    return { fixtureId: fixture.fixtureId, status: pass ? 'pass' : 'fail' };
  });
  const damageFailed = damageResults.filter(result => result.status === 'fail').length;
  const speedFailed = speedResults.filter(result => result.status === 'fail').length;
  const speedBlocked = speedResults.filter(result => result.status === 'blocked').length;
  const result = {
    runId, damageResults, speedResults,
    damageConformance: damageFailed === 0 ? 'pass' : 'fail',
    speedConformance: speedFailed === 0 && speedBlocked === 0 ? 'pass' : 'fail',
    unsupportedFailClosed: speedBlocked === 0 ? 'pass' : 'fail',
    unresolvedDivergences: damageFailed + speedFailed,
    mongoReads: 0, mongoWrites: 0, productionWrites: 0,
  };
  writeAtomic(path.resolve(outputDir, 'damage-results.json'), damageResults);
  writeAtomic(path.resolve(outputDir, 'speed-results.json'), speedResults);
  writeAtomic(path.resolve(outputDir, 'divergence-report.json'), [...damageResults.filter(resultItem => resultItem.status === 'fail'), ...speedResults.filter(resultItem => resultItem.status === 'fail' || resultItem.status === 'blocked')]);
  writeAtomic(path.resolve(outputDir, 'conformance-summary.json'), result);
  console.log(JSON.stringify(result, null, 2));
  if (damageFailed > 0) process.exitCode = 7; else if (speedBlocked > 0) process.exitCode = 8;
}
try {
  main();
} catch (error) {
  if (process.exitCode === undefined) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 19;
  }
}
