import fs from 'fs';
import path from 'path';
import { loadChampionsCompetitivePackage } from '../equinox/data-packs/champions/loadChampionsCompetitivePackage';
import { FULL_ROSTER_EXPANSION_POLICY } from '../services/competitive-data/expert/wave3/FullRosterExpansionPolicy';
import { planBatches, selectCanaryBatch, projectFullRerunDuration } from '../services/competitive-data/expert/wave3/BatchPlanning';
import { maxCalculatedSpeed } from '../services/competitive-data/expert/wave2/PokemonProfileClassifier';
import { ALREADY_PROCESSED_POKEMON_IDS } from '../services/competitive-data/expert/wave3/AlreadyProcessedPokemonIds';

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function fail(message: string, code: number): never { console.error(message); process.exitCode = code; throw new Error(message); }
function writeAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

const CANARY_SIZE = 10;

function main(): void {
  const allowed = new Set(['--run-id', '--seed']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const seed = arg('--seed') ?? FULL_ROSTER_EXPANSION_POLICY.seedBase;
  if (seed !== FULL_ROSTER_EXPANSION_POLICY.seedBase) fail(`Seed must match the policy's seedBase (${FULL_ROSTER_EXPANSION_POLICY.seedBase})`, 7);

  const runDir = path.resolve(`artifacts/competitive-production-readiness/${runId}`);
  const rosterPath = path.join(runDir, 'roster', 'eligible-records.json');
  if (!fs.existsSync(rosterPath)) fail(`Missing roster reconciliation -- run sets:champions:roster:reconcile first: ${rosterPath}`, 4);
  const eligibleRecords = JSON.parse(fs.readFileSync(rosterPath, 'utf8')).records as Array<{ canonicalPokemonId: string; reasonCodes: string[] }>;
  const remainingPokemonIds = eligibleRecords.filter(r => !r.reasonCodes.includes('ALREADY_PROCESSED_IN_PRIOR_WAVE')).map(r => r.canonicalPokemonId);

  const pkg = loadChampionsCompetitivePackage();
  const speeds = remainingPokemonIds.map(id => { const s = pkg.species.find(sp => sp.pokemonId === id); return s ? maxCalculatedSpeed(s) : 0; }).sort((a, b) => a - b);
  const percentile = (p: number) => speeds[Math.floor(speeds.length * p)] ?? speeds[speeds.length - 1];
  const speedPercentiles = { p25: percentile(0.25), p75: percentile(0.75) };

  const batches = planBatches({ remainingPokemonIds, speciesPerBatch: FULL_ROSTER_EXPANSION_POLICY.batchPolicy.speciesPerBatch, policyVersion: FULL_ROSTER_EXPANSION_POLICY.policyVersion, seedBase: seed });
  const canary = selectCanaryBatch(pkg, remainingPokemonIds, speedPercentiles, CANARY_SIZE);
  // Wave 2 pilot performance.json measured p95~1-2ms/candidate; use the conservative (higher) bound.
  const projection = projectFullRerunDuration(2, remainingPokemonIds.length, FULL_ROSTER_EXPANSION_POLICY.maxCandidatesPerPokemon);

  const batchCoverage = batches.reduce((sum, b) => sum + b.pokemonIds.length, 0);
  const duplicatePokemonAcrossBatches = new Set(batches.flatMap(b => b.pokemonIds)).size !== batchCoverage;
  const missingPokemon = remainingPokemonIds.filter(id => !batches.some(b => b.pokemonIds.includes(id)));

  writeAtomic(path.join(runDir, 'planning', 'expansion-plan.json'), { runId, seed, totalRemainingSpecies: remainingPokemonIds.length, alreadyProcessedCount: ALREADY_PROCESSED_POKEMON_IDS.length, batchCount: batches.length });
  writeAtomic(path.join(runDir, 'planning', 'batch-policy.json'), { runId, speciesPerBatch: FULL_ROSTER_EXPANSION_POLICY.batchPolicy.speciesPerBatch, rationale: FULL_ROSTER_EXPANSION_POLICY.batchPolicy.rationale, maxBatchDurationMsBudget: FULL_ROSTER_EXPANSION_POLICY.batchPolicy.maxBatchDurationMsBudget });
  writeAtomic(path.join(runDir, 'planning', 'batch-plan.json'), { runId, batches });
  writeAtomic(path.join(runDir, 'planning', 'batch-index.json'), { runId, index: batches.map(b => ({ batchId: b.batchId, index: b.index, speciesCount: b.pokemonIds.length, status: b.status })) });
  writeAtomic(path.join(runDir, 'planning', 'canary-selection.json'), { runId, pokemonIds: canary.pokemonIds, representedTags: canary.representedTags, requiredTags: ['fast', 'slow', 'physical-attacker', 'special-attacker', 'support', 'weather', 'trick-room', 'alternate-form'] });
  writeAtomic(path.join(runDir, 'planning', 'projected-load.json'), { runId, measuredMsPerCandidateAssumption: 2, ...projection, note: 'Assumption is the conservative (higher) bound from Wave 2 pilot performance.json p95; will be reconciled against this run\'s own measured performance in performance/full-expansion-projection.md.' });

  const gate = { batchPlanComplete: batches.length > 0, batchInputCoverage: batchCoverage === remainingPokemonIds.length, batchDuplicatePokemonCount: !duplicatePokemonAcrossBatches, batchMissingPokemonCount: missingPokemon.length === 0, canaryRepresentative: canary.representedTags.length >= 6 };
  const valid = Object.values(gate).every(Boolean);
  console.log(JSON.stringify({ valid, gate, batchCount: batches.length, totalRemainingSpecies: remainingPokemonIds.length, canarySize: canary.pokemonIds.length, canaryRepresentedTags: canary.representedTags, projectedTotalSeconds: projection.estimatedTotalSeconds, mongoReads: 0, mongoWrites: 0, networkReads: 0, productionWrites: 0 }));
  if (!valid) process.exitCode = 8;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    if (process.exitCode === undefined) { console.error(error instanceof Error ? error.message : error); process.exitCode = 32; }
  }
}
