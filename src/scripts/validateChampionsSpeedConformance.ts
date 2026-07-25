import fs from 'fs';
import path from 'path';
import { calculateSpeedTier, compareActionOrder } from '../services/competitive-data/expert/engines/SpeedTierEngine';
import { IndependentSpeedFixture } from '../services/competitive-data/reference-conformance/contracts/ReferenceConformanceContracts';

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function fail(message: string, code: number): never { console.error(message); process.exitCode = code; throw new Error(message); }
function writeAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function main(): void {
  const allowed = new Set(['--run-id', '--output-dir']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  const outputDir = arg('--output-dir') ?? `artifacts/competitive-production-readiness/${runId ?? 'missing-run-id'}/mechanics-reference`;
  const conformanceDir = arg('--output-dir') ?? `artifacts/competitive-production-readiness/${runId ?? 'missing-run-id'}/mechanics-conformance`;
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);

  const fixturePath = path.resolve(outputDir, 'speed-canonical-fixtures.json');
  if (!fs.existsSync(fixturePath)) fail(`Speed fixture package missing: ${fixturePath}`, 3);
  const pack = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as { fixtures: IndependentSpeedFixture[] };

  const results = pack.fixtures.map(fixture => {
    const reasonCodes: string[] = [];
    const engineVersion = 'speed-formula-v1';

    // Production has no direct "tailwind on opponent only" concept in a single calculateSpeedTier
    // call; it always applies `tailwind` to the Pokemon being evaluated. To evaluate both sides
    // fairly under the fixture's battleContext, each actor gets `tailwind` set to whether ITS side
    // has Tailwind, mirroring what a real per-side call into production would look like.
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
      const unsupportedMechanics = [...actorResult.unsupportedMechanics, ...opponentResult.unsupportedMechanics];
      // Priority-changing abilities beyond weather abilities require move category/type/HP inputs
      // that SpeedTierInput does not carry at all -- a real, documented scope boundary (see
      // unsupported-speed-interactions.json), not a fixable rounding/formatting bug. Fixtures
      // built specifically to probe that boundary are expected to be unsupported by production.
      const isDocumentedPriorityAbilityGap = fixture.assumptions.includes('category:priority-ability');
      return {
        fixtureId: fixture.fixtureId, inputDigest: fixture.inputDigest, fixtureDigest: fixture.fixtureDigest,
        expected: fixture.expected, actual: {}, status: (isDocumentedPriorityAbilityGap ? 'unsupported-as-expected' : 'blocked') as 'unsupported-as-expected' | 'blocked',
        deltas: isDocumentedPriorityAbilityGap ? [] : ['production engine reported unsupported mechanics'],
        reasonCodes: unsupportedMechanics,
        productionEngineVersion: engineVersion, referencePackage: '@pkmn/sim' as const, referenceVersion: '0.10.11' as const,
      };
    }

    const order = compareActionOrder(
      { speed: actorResult.modifiedSpeed!, priority: actorResult.priorityBracket! },
      { speed: opponentResult.modifiedSpeed!, priority: opponentResult.priorityBracket! },
      fixture.battleContext.trickRoom,
    );
    let actionOrder: IndependentSpeedFixture['expected']['actionOrder'];
    if (order === 'tie') actionOrder = 'speed-tie';
    else if (actorResult.priorityBracket !== opponentResult.priorityBracket) actionOrder = order === 'first' ? 'priority-actor-first' : 'priority-opponent-first';
    else if (fixture.battleContext.trickRoom) actionOrder = order === 'first' ? 'trick-room-actor-first' : 'trick-room-opponent-first';
    else actionOrder = order === 'first' ? 'actor-first' : 'opponent-first';

    const actual = {
      calculatedSpeed: actorResult.calculatedSpeed, effectiveSpeed: actorResult.modifiedSpeed,
      priorityBracket: actorResult.priorityBracket, actionOrder, speedTie: order === 'tie',
    };
    const expected = {
      calculatedSpeed: fixture.expected.actorCalculatedSpeed, effectiveSpeed: fixture.expected.actorEffectiveSpeed,
      priorityBracket: fixture.expected.actorPriorityBracket, actionOrder: fixture.expected.actionOrder, speedTie: fixture.expected.speedTie,
    };

    const deltas: string[] = [];
    if (actual.calculatedSpeed !== expected.calculatedSpeed) deltas.push(`calculatedSpeed: expected ${expected.calculatedSpeed}, got ${actual.calculatedSpeed}`);
    if (actual.effectiveSpeed !== expected.effectiveSpeed) deltas.push(`effectiveSpeed: expected ${expected.effectiveSpeed}, got ${actual.effectiveSpeed}`);
    if (actual.priorityBracket !== expected.priorityBracket) deltas.push(`priorityBracket: expected ${expected.priorityBracket}, got ${actual.priorityBracket}`);
    if (actual.actionOrder !== expected.actionOrder) deltas.push(`actionOrder: expected ${expected.actionOrder}, got ${actual.actionOrder}`);
    if (actual.speedTie !== expected.speedTie) deltas.push(`speedTie: expected ${expected.speedTie}, got ${actual.speedTie}`);

    return {
      fixtureId: fixture.fixtureId, inputDigest: fixture.inputDigest, fixtureDigest: fixture.fixtureDigest,
      expected, actual, status: (deltas.length === 0 ? 'pass' : 'fail') as 'pass' | 'fail',
      deltas, reasonCodes,
      productionEngineVersion: engineVersion, referencePackage: '@pkmn/sim' as const, referenceVersion: '0.10.11' as const,
    };
  });

  const failed = results.filter(result => result.status === 'fail');
  const blocked = results.filter(result => result.status === 'blocked');
  const unsupportedAsExpected = results.filter(result => result.status === 'unsupported-as-expected');
  const summary = {
    runId, fixtureCount: results.length, passed: results.length - failed.length - blocked.length - unsupportedAsExpected.length,
    failed: failed.length, blocked: blocked.length, unsupportedAsExpected: unsupportedAsExpected.length,
    speedConformance: failed.length === 0 && blocked.length === 0 ? 'pass' : 'fail',
    unresolvedSpeedDivergences: failed.length,
    unsupportedSpeedInteractionsFailClosed: unsupportedAsExpected.length > 0 || blocked.length === 0 ? 'pass' : 'fail',
    mongoReads: 0, mongoWrites: 0, productionWrites: 0,
  };
  writeAtomic(path.resolve(conformanceDir, 'speed-results.json'), results);
  writeAtomic(path.resolve(conformanceDir, 'speed-divergence-report.json'), [...failed, ...blocked]);
  writeAtomic(path.resolve(conformanceDir, 'speed-conformance-summary.json'), summary);
  console.log(JSON.stringify(summary));
  if (failed.length > 0) process.exitCode = 10;
  else if (blocked.length > 0) process.exitCode = 13;
}

try {
  main();
} catch (error) {
  if (process.exitCode === undefined) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 19;
  }
}
