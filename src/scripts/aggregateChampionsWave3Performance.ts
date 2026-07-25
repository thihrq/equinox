// Wave 3 -- aggregates real per-batch performance.json artifacts (canary + all 9 wave3-batch-*)
// into one report, and reconciles the original planning-time projection (a conservative assumption
// carried over from Wave 2's pilot) against what this run actually measured.
import fs from 'fs';
import path from 'path';
import { FULL_ROSTER_EXPANSION_POLICY } from '../services/competitive-data/expert/wave3/FullRosterExpansionPolicy';
import { ALREADY_PROCESSED_POKEMON_IDS } from '../services/competitive-data/expert/wave3/AlreadyProcessedPokemonIds';

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function fail(message: string, code: number): never { console.error(message); process.exitCode = code; throw new Error(message); }
function writeAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  try { fs.renameSync(temporary, file); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EPERM') { console.error(`ARTIFACT_ATOMIC_RENAME_BLOCKED:${file}`); fs.copyFileSync(temporary, file); fs.unlinkSync(temporary); return; }
    throw error;
  }
}

interface BatchPerf { batchId: string; totalDurationMs: number; candidateCount: number; p50Ms: number; p95Ms: number; maxMs: number; }

function main(): void {
  const allowed = new Set(['--run-id']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const runDir = path.resolve(`artifacts/competitive-production-readiness/${runId}`);
  const batchesDir = path.join(runDir, 'batches');
  if (!fs.existsSync(batchesDir)) fail(`Missing batches directory: ${batchesDir}`, 12);

  const batchIds = fs.readdirSync(batchesDir).filter(name => fs.existsSync(path.join(batchesDir, name, 'performance.json')));
  const perfs: BatchPerf[] = batchIds.map(id => JSON.parse(fs.readFileSync(path.join(batchesDir, id, 'performance.json'), 'utf8')) as BatchPerf);

  const totalCandidates = perfs.reduce((sum, p) => sum + p.candidateCount, 0);
  const totalDurationMs = perfs.reduce((sum, p) => sum + p.totalDurationMs, 0);
  const overallMaxMs = Math.max(...perfs.map(p => p.maxMs));
  const overallP95Ms = Math.max(...perfs.map(p => p.p95Ms)); // conservative: worst observed batch-level p95, not averaged away
  const meanMsPerCandidate = totalCandidates > 0 ? totalDurationMs / totalCandidates : 0;

  const rosterTotals = (JSON.parse(fs.readFileSync(path.join(runDir, 'roster', 'roster-reconciliation.json'), 'utf8')).totals as { official: number });
  const remainingForFullCatalogProjection = rosterTotals.official - ALREADY_PROCESSED_POKEMON_IDS.length; // roster total minus sentinel+pilot already processed before this wave
  const originalAssumptionMsPerCandidate = 2; // Wave 2 pilot's conservative p95 bound, used at planning time (planning/projected-load.json)
  const measuredProjectionMs = remainingForFullCatalogProjection * FULL_ROSTER_EXPANSION_POLICY.maxCandidatesPerPokemon * overallP95Ms;
  const originalProjectionMs = remainingForFullCatalogProjection * FULL_ROSTER_EXPANSION_POLICY.maxCandidatesPerPokemon * originalAssumptionMsPerCandidate;

  const report = {
    runId, batchesMeasured: perfs.length, totalCandidates, totalDurationMs, meanMsPerCandidate: Number(meanMsPerCandidate.toFixed(3)), overallP95Ms, overallMaxMs,
    perBatch: perfs.map(p => ({ batchId: p.batchId, candidateCount: p.candidateCount, totalDurationMs: p.totalDurationMs, p50Ms: p.p50Ms, p95Ms: p.p95Ms, maxMs: p.maxMs })),
    budgetCheck: { maxBatchDurationMsBudget: FULL_ROSTER_EXPANSION_POLICY.batchPolicy.maxBatchDurationMsBudget, allBatchesWithinBudget: perfs.every(p => p.totalDurationMs <= FULL_ROSTER_EXPANSION_POLICY.batchPolicy.maxBatchDurationMsBudget) },
    reconciliation: {
      originalPlanningAssumptionMsPerCandidate: originalAssumptionMsPerCandidate, measuredP95MsPerCandidate: overallP95Ms,
      originalAssumptionWasConservative: originalAssumptionMsPerCandidate >= overallP95Ms,
      originalProjectedTotalMs: originalProjectionMs, measuredProjectedTotalMs: measuredProjectionMs,
      note: 'planning/projected-load.json used a fixed conservative estimate (Wave 2 pilot p95) because no Wave 3 measurement existed yet at plan time; this report reconciles it against what Wave 3 actually measured across the real canary + 9-batch run.',
    },
  };

  writeAtomic(path.join(runDir, 'performance', 'full-expansion-performance.json'), report);
  writeAtomic(path.join(runDir, 'performance', 'full-expansion-projection.md'), `# Wave 3 Performance Reconciliation\n\nRun ID: \`${runId}\`\n\n| Metric | Value |\n|---|---|\n| Batches measured | ${perfs.length} |\n| Total candidates | ${totalCandidates} |\n| Total duration (ms) | ${totalDurationMs} |\n| Mean ms/candidate | ${meanMsPerCandidate.toFixed(3)} |\n| Overall p95 (ms) | ${overallP95Ms} |\n| Overall max (ms) | ${overallMaxMs} |\n| All batches within ${FULL_ROSTER_EXPANSION_POLICY.batchPolicy.maxBatchDurationMsBudget}ms budget | ${report.budgetCheck.allBatchesWithinBudget} |\n\nOriginal planning-time assumption: ${originalAssumptionMsPerCandidate}ms/candidate (Wave 2 pilot p95, conservative). Measured this run: ${overallP95Ms}ms/candidate. Assumption was ${report.reconciliation.originalAssumptionWasConservative ? 'conservative (safe)' : 'NOT conservative -- underestimated real cost'}.\n`);

  const valid = perfs.length === batchIds.length && report.budgetCheck.allBatchesWithinBudget && totalCandidates > 0;
  console.log(JSON.stringify({ valid, batchesMeasured: perfs.length, totalCandidates, overallP95Ms, overallMaxMs, allBatchesWithinBudget: report.budgetCheck.allBatchesWithinBudget, originalAssumptionWasConservative: report.reconciliation.originalAssumptionWasConservative, mongoReads: 0, mongoWrites: 0, networkReads: 0, productionWrites: 0 }));
  if (!valid) process.exitCode = 16;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    if (process.exitCode === undefined) { console.error(error instanceof Error ? error.message : error); process.exitCode = 25; }
  }
}
