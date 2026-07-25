import fs from 'fs';
import path from 'path';
import { IndependentSpeedFixture, stableDigest } from '../services/competitive-data/reference-conformance/contracts/ReferenceConformanceContracts';
import { isReferenceOfflineEnabled } from '../services/competitive-data/reference-conformance/ReferenceFlags';

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function fail(message: string, code: number): never { console.error(message); process.exitCode = code; throw new Error(message); }
function writeAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function validateActor(actor: IndependentSpeedFixture['actor'], prefix: string): string[] {
  const problems: string[] = [];
  if (!Number.isFinite(actor.baseSpeed) || actor.baseSpeed <= 0) problems.push(`${prefix}:baseSpeed missing or invalid`);
  if (actor.speedIv < 0 || actor.speedIv > 31) problems.push(`${prefix}:speedIv out of 0-31 range`);
  if (actor.speedEv < 0 || actor.speedEv > 252) problems.push(`${prefix}:speedEv out of 0-252 range`);
  if (!Number.isFinite(actor.level) || actor.level <= 0) problems.push(`${prefix}:level invalid`);
  if (!Number.isFinite(actor.movePriority)) problems.push(`${prefix}:movePriority missing`);
  return problems;
}

function main(): void {
  const allowed = new Set(['--run-id', '--seed', '--output-dir']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  const expectedSeed = arg('--seed') ?? 'champions-mb-speed-reference-v1';
  const outputDir = arg('--output-dir') ?? `artifacts/competitive-production-readiness/${runId ?? 'missing-run-id'}/mechanics-reference`;
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  if (!isReferenceOfflineEnabled()) fail('Offline speed reference check requires both network/bootstrap flags disabled', 4);

  const fixturePath = path.resolve(outputDir, 'speed-canonical-fixtures.json');
  if (!fs.existsSync(fixturePath)) fail(`Speed fixture package missing: ${fixturePath}`, 3);
  const pack = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as { schemaVersion: string; seed: string; fixtures: IndependentSpeedFixture[] };
  if (!Array.isArray(pack.fixtures) || pack.fixtures.length === 0) fail('Speed fixture package is empty', 3);

  const problems: string[] = [];
  const digestMismatches: string[] = [];
  const seenIds = new Set<string>();
  for (const fixture of pack.fixtures) {
    if (seenIds.has(fixture.fixtureId)) problems.push(`duplicate fixtureId: ${fixture.fixtureId}`);
    seenIds.add(fixture.fixtureId);
    if (fixture.battleContext.seed !== expectedSeed) problems.push(`${fixture.fixtureId}: seed mismatch (expected ${expectedSeed}, got ${fixture.battleContext.seed})`);
    if (fixture.sourceReferences.join(',') !== '@pkmn/sim@0.10.11') problems.push(`${fixture.fixtureId}: sourceReferences must be exactly @pkmn/sim@0.10.11`);
    problems.push(...validateActor(fixture.actor, `${fixture.fixtureId}:actor`));
    problems.push(...validateActor(fixture.opponent, `${fixture.fixtureId}:opponent`));
    if (!fixture.battleContext.doubles) problems.push(`${fixture.fixtureId}: battleContext.doubles must be true`);
    // fixtureDigest was computed while fixtureDigest still held its '' placeholder value
    // (see generateChampionsSpeedReferenceFixtures.ts draft initialization); recompute the
    // same way -- clearing to '' rather than deleting the key, since draft never omitted it.
    const expectedDigest = stableDigest({ ...fixture, fixtureDigest: '' });
    if (fixture.fixtureDigest !== expectedDigest) digestMismatches.push(fixture.fixtureId);
  }

  const speedFixtureContractComplete = problems.length === 0;
  const baseSpeedPersisted = pack.fixtures.every(fixture => Number.isFinite(fixture.actor.baseSpeed) && Number.isFinite(fixture.opponent.baseSpeed));
  const battleContextNormalized = pack.fixtures.every(fixture =>
    typeof fixture.battleContext.trickRoom === 'boolean' &&
    typeof fixture.battleContext.actorTailwind === 'boolean' &&
    typeof fixture.battleContext.opponentTailwind === 'boolean');

  const result = {
    valid: speedFixtureContractComplete && digestMismatches.length === 0,
    runId,
    fixtureCount: pack.fixtures.length,
    speedFixtureContractComplete,
    baseSpeedPersisted,
    battleContextNormalized,
    speedFixtureDigestsValid: digestMismatches.length === 0,
    digestMismatches,
    contractProblems: problems,
    speedReferenceIndependence: pack.fixtures.every(fixture => fixture.sourceReferences.join(',') === '@pkmn/sim@0.10.11') ? 'pass' : 'fail',
    mongoReads: 0, mongoWrites: 0, productionWrites: 0,
  };
  writeAtomic(path.resolve(outputDir, 'speed-reference-check.json'), result);
  console.log(JSON.stringify(result));
  if (!result.valid) process.exitCode = 4;
}

try {
  main();
} catch (error) {
  if (process.exitCode === undefined) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 19;
  }
}
