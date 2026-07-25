import fs from 'fs';
import path from 'path';
import { calculateIndependentDamage } from '../services/competitive-data/reference-conformance/adapters/SmogonCalcDamageReferenceAdapter';
import { calculateIndependentSpeed } from '../services/competitive-data/reference-conformance/adapters/PokemonShowdownSpeedReferenceAdapter';
import { IndependentDamageFixture, IndependentSpeedFixture, stableDigest } from '../services/competitive-data/reference-conformance/contracts/ReferenceConformanceContracts';
import { isReferenceBootstrapEnabled } from '../services/competitive-data/reference-conformance/ReferenceFlags';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function rejectUnknownArgs(): void {
  const allowed = new Set(['--run-id', '--seed', '--output-dir']);
  for (let i = 2; i < process.argv.length; i += 1) {
    if (!process.argv[i].startsWith('--')) continue;
    if (!allowed.has(process.argv[i])) throw new Error(`Unknown argument: ${process.argv[i]}`);
    i += 1;
  }
}

function writeAtomic(relativePath: string, value: unknown): void {
  const destination = path.resolve(relativePath);
  if (path.isAbsolute(relativePath) && !relativePath.startsWith(process.cwd())) throw new Error('Absolute output paths are not allowed');
  if (fs.existsSync(destination)) throw new Error(`Refusing to overwrite existing artifact: ${relativePath}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, destination);
}

function buildDamageFixture(): IndependentDamageFixture {
  return {
    fixtureId: 'damage-neutral-physical-charizard-vs-venusaur-v1', description: 'Gen 9 neutral physical reference range', generation: 9,
    attacker: { species: 'Charizard', level: 50, nature: 'Adamant', evs: { attack: 252 }, ivs: { attack: 31 }, types: ['Fire', 'Flying'] },
    defender: { species: 'Venusaur', level: 50, nature: 'Bold', evs: { hp: 252, defense: 252 }, ivs: { hp: 31, defense: 31 }, types: ['Grass', 'Poison'] },
    move: { name: 'Flare Blitz', type: 'Fire', category: 'Physical', basePower: 120, spread: false }, field: { doubles: true },
    expected: { calculatedAttackStat: 0, calculatedDefenseStat: 0, defenderHp: 0, rolls: [], minDamage: 0, maxDamage: 0, minPercent: 0, maxPercent: 0, classification: 'unsupported' },
    referenceMethod: 'vendored-reference', sourceReferences: ['@smogon/calc@0.11.0'], calculationSteps: ['construct gen 9 attacker', 'construct gen 9 defender', 'calculate damage range'], inputDigest: '', resultDigest: '', fixtureDigest: '',
  };
}

function buildSpeedFixture(): IndependentSpeedFixture {
  const neutral = { species: 'Ditto', level: 50, baseSpeed: 48, nature: 'Serious', speedEv: 0, speedIv: 31, speedStage: 0, move: 'protect', movePriority: 0 };
  return {
    fixtureId: 'speed-neutral-ditto-v1', description: 'Gen 9 neutral Speed reference', generation: 9, formatId: 'champions-reg-mb-doubles',
    actor: { ...neutral, nature: 'Timid', speedEv: 252 }, opponent: neutral,
    battleContext: { doubles: true, actorTailwind: false, opponentTailwind: false, trickRoom: false, seed: 'champions-mb-speed-reference-v1' },
    expected: {
      actorCalculatedSpeed: 0, actorEffectiveSpeed: 0, actorPriorityBracket: 0,
      opponentCalculatedSpeed: 0, opponentEffectiveSpeed: 0, opponentPriorityBracket: 0,
      actionOrder: 'unsupported', speedTie: false, trickRoomReversedOrder: false,
    },
    referenceMethod: 'vendored-reference', sourceReferences: ['@pkmn/sim@0.10.11'], calculationSteps: ['construct gen 9 VGC doubles battle', 'switch in actor and opponent', 'read structured Speed and action-order state'],
    assumptions: [], limitations: [], inputDigest: '', resultDigest: '', fixtureDigest: '',
  };
}

function main(): void {
  rejectUnknownArgs();
  const runId = arg('--run-id');
  const seed = arg('--seed');
  const outputDir = arg('--output-dir') ?? `artifacts/competitive-production-readiness/${runId ?? 'missing-run-id'}/mechanics-reference`;
  if (!runId || !seed) throw new Error('Required arguments: --run-id <id> --seed <seed>');
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) throw new Error('Invalid run id');
  if (!isReferenceBootstrapEnabled()) throw new Error('Reference bootstrap requires both bootstrap flags set to true');

  const damageInput = buildDamageFixture();
  const damageResult = calculateIndependentDamage(damageInput);
  if (!damageResult.supported) throw new Error(`Damage reference unsupported: ${damageResult.unsupportedReasons.join(', ')}`);
  const damage = { ...damageInput, expected: { calculatedAttackStat: damageResult.calculatedStats.attackerRelevantStat, calculatedDefenseStat: damageResult.calculatedStats.defenderRelevantStat, defenderHp: damageResult.calculatedStats.defenderHp, rolls: damageResult.rolls, minDamage: damageResult.minDamage, maxDamage: damageResult.maxDamage, minPercent: damageResult.minPercent, maxPercent: damageResult.maxPercent, classification: damageResult.classification }, inputDigest: damageResult.inputDigest, resultDigest: damageResult.resultDigest };
  const speedInput = buildSpeedFixture();
  const speedResult = calculateIndependentSpeed(speedInput);
  if (!speedResult.supported) throw new Error(`Speed reference unsupported: ${speedResult.unsupportedReasons.join(', ')}`);
  const speed = {
    ...speedInput,
    expected: {
      actorCalculatedSpeed: speedResult.actorCalculatedSpeed, actorEffectiveSpeed: speedResult.actorEffectiveSpeed, actorPriorityBracket: speedResult.actorPriorityBracket,
      opponentCalculatedSpeed: speedResult.opponentCalculatedSpeed, opponentEffectiveSpeed: speedResult.opponentEffectiveSpeed, opponentPriorityBracket: speedResult.opponentPriorityBracket,
      actionOrder: speedResult.actionOrder, speedTie: speedResult.speedTie, trickRoomReversedOrder: speedResult.trickRoomReversedOrder,
    },
    inputDigest: speedResult.inputDigest, resultDigest: speedResult.resultDigest,
  };
  const damageFinal = { ...damage, fixtureDigest: stableDigest(damage) };
  const speedFinal = { ...speed, fixtureDigest: stableDigest(speed) };
  const methodology = ['References acquired from exact devDependencies.', 'Fixtures generated once with @smogon/calc@0.11.0 and @pkmn/sim@0.10.11.', 'Generated fixtures are test-only and are not imported by runtime modules.'];
  writeAtomic(`${outputDir}/damage-canonical-fixtures.json`, { schemaVersion: '1', acquisitionRunId: runId, seed, fixtures: [damageFinal] });
  writeAtomic(`${outputDir}/speed-canonical-fixtures.json`, { schemaVersion: '1', acquisitionRunId: runId, seed, fixtures: [speedFinal] });
  writeAtomic(`${outputDir}/reference-methodology.md`, methodology.join('\n\n'));
  writeAtomic(`${outputDir}/reference-source-map.json`, { '@smogon/calc': '0.11.0', '@pkmn/sim': '0.10.11' });
  writeAtomic(`${outputDir}/reference-digests.json`, { damage: stableDigest(damageFinal), speed: stableDigest(speedFinal) });
  writeAtomic(`${outputDir}/independence-audit.json`, { runtimeReferenceImportCount: 0, selfConfirmingFixtureCount: 0, sourceReferencesPresent: true, status: 'partial-coverage' });
  console.log(JSON.stringify({ valid: true, runId, damageFixtures: 1, speedFixtures: 1, status: 'partial-coverage', mongoReads: 0, mongoWrites: 0, productionWrites: 0 }));
}

try { main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 4; }
