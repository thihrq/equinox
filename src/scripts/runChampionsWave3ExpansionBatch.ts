import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { loadChampionsCompetitivePackage } from '../equinox/data-packs/champions/loadChampionsCompetitivePackage';
import { validateChampionsCompetitivePackage } from '../equinox/data-validation/champions/ChampionsPackageValidator';
import { resolveHomologatedTargetCatalog } from '../services/competitive-data/expert/wave3/HomologatedTargetCatalog';
import { executeBatch, BatchExecutionResult } from '../services/competitive-data/expert/wave3/BatchExecutionEngine';
import { decideBatchResume, BatchCheckpoint, BatchDigests } from '../services/competitive-data/expert/wave3/BatchCheckpoint';
import { FULL_ROSTER_EXPANSION_POLICY } from '../services/competitive-data/expert/wave3/FullRosterExpansionPolicy';

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
const digest = (value: unknown): string => `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;

interface BatchDefinition { batchId: string; pokemonIds: string[]; inputDigest: string; }

function loadBatchDefinitions(runDir: string, requestedBatchId: string | undefined): BatchDefinition[] {
  const planPath = path.join(runDir, 'planning', 'batch-plan.json');
  const canaryPath = path.join(runDir, 'planning', 'canary-selection.json');
  const planned: BatchDefinition[] = fs.existsSync(planPath)
    ? (JSON.parse(fs.readFileSync(planPath, 'utf8')).batches as Array<{ batchId: string; pokemonIds: string[]; inputDigest: string }>).map(b => ({ batchId: b.batchId, pokemonIds: b.pokemonIds, inputDigest: b.inputDigest }))
    : [];
  if (requestedBatchId === 'canary') {
    if (!fs.existsSync(canaryPath)) fail(`Missing canary selection -- run sets:champions:expansion:full:plan first: ${canaryPath}`, 12);
    const canary = JSON.parse(fs.readFileSync(canaryPath, 'utf8')) as { pokemonIds: string[] };
    return [{ batchId: 'canary', pokemonIds: canary.pokemonIds, inputDigest: digest({ scope: 'canary', pokemonIds: canary.pokemonIds }) }];
  }
  if (requestedBatchId) {
    const found = planned.find(b => b.batchId === requestedBatchId);
    if (!found) fail(`Unknown --batch-id: ${requestedBatchId}`, 2);
    return [found];
  }
  return planned;
}

function processOneBatch(runDir: string, def: BatchDefinition, deps: { packageDigest: string; catalog: ReturnType<typeof resolveHomologatedTargetCatalog>; validation: ReturnType<typeof validateChampionsCompetitivePackage>; natures: Array<{ natureId: string; increasedStat: string | null; decreasedStat: string | null }>; pkg: ReturnType<typeof loadChampionsCompetitivePackage>; runId: string }): { batchId: string; action: string; reasonCode: string; valid: boolean; candidateCount: number; verdictCounts: Record<string, number> } {
  const batchDir = path.join(runDir, 'batches', def.batchId);
  const checkpointPath = path.join(batchDir, 'checkpoint.json');
  const verdictsPath = path.join(batchDir, 'verdicts.json');

  const current: BatchDigests = { packageDigest: deps.packageDigest, policyVersion: FULL_ROSTER_EXPANSION_POLICY.policyVersion, targetCatalogDigest: deps.catalog.targetCatalogDigest, inputDigest: def.inputDigest };

  let checkpoint: BatchCheckpoint | null = null;
  let checkpointParseError = false;
  if (fs.existsSync(checkpointPath)) {
    try { checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8')) as BatchCheckpoint; } catch { checkpointParseError = true; }
  }
  const artifactsPresent = fs.existsSync(verdictsPath);
  const currentArtifactDigest = artifactsPresent ? digest(fs.readFileSync(verdictsPath, 'utf8')) : null;

  const decision = decideBatchResume({ checkpoint, checkpointParseError, current, artifactsPresent, currentArtifactDigest, maxRetryAttempts: FULL_ROSTER_EXPANSION_POLICY.failurePolicy.maxRetryAttempts });

  if (decision.action === 'skip-already-complete') {
    const stored = JSON.parse(fs.readFileSync(verdictsPath, 'utf8')) as { verdicts: Array<{ verdict: string }> };
    const verdictCounts: Record<string, number> = {};
    for (const v of stored.verdicts) verdictCounts[v.verdict] = (verdictCounts[v.verdict] ?? 0) + 1;
    return { batchId: def.batchId, action: decision.action, reasonCode: decision.reasonCode, valid: true, candidateCount: stored.verdicts.length, verdictCounts };
  }
  if (decision.action === 'blocked-retry-exhausted') {
    writeAtomic(checkpointPath, { ...checkpoint, status: 'failed', attemptCount: decision.nextAttemptCount, terminalStatus: 'failed-after-retry-exhaustion' });
    return { batchId: def.batchId, action: decision.action, reasonCode: decision.reasonCode, valid: false, candidateCount: 0, verdictCounts: {} };
  }

  // process-fresh or process-retry: run the real pipeline now. Mark 'running' first so an
  // interruption mid-batch leaves an honest, resumable checkpoint rather than a stale 'completed'.
  writeAtomic(checkpointPath, { batchId: def.batchId, attemptCount: decision.nextAttemptCount, status: 'running', ...current, artifactDigest: '', candidateCount: 0 });

  const startedAt = Date.now();
  const result: BatchExecutionResult = executeBatch({ pkg: deps.pkg, validation: deps.validation, natures: deps.natures, catalog: deps.catalog.catalog, pokemonIds: def.pokemonIds, runId: deps.runId, batchId: def.batchId, policy: FULL_ROSTER_EXPANSION_POLICY });

  const verdictCounts: Record<string, number> = { 'expert-validated': 0, 'expert-review-required': 0, rejected: 0 };
  for (const r of result.results) verdictCounts[r.validation.verdict] = (verdictCounts[r.validation.verdict] ?? 0) + 1;
  const decisionTraceCoverage = result.results.filter(r => Array.isArray(r.validation.decisionTrace) && r.validation.decisionTrace!.length > 0).length;
  const digestMismatches = result.results.filter(r => !r.validation.candidateDigest || r.validation.candidateDigest !== r.context.candidate.candidateDigest).length;
  const durations = result.results.map(r => r.durationMs).sort((a, b) => a - b);
  const p50 = durations[Math.floor(durations.length * 0.5)] ?? 0;
  const p95 = durations[Math.floor(durations.length * 0.95)] ?? durations[durations.length - 1] ?? 0;

  const verdictsPayload = { runId: deps.runId, batchId: def.batchId, verdicts: result.results.map(r => ({ setId: r.setId, pokemonId: r.pokemonId, verdict: r.validation.verdict, confidence: r.validation.confidence, humanReviewRequirement: r.validation.humanReviewRequirement, reasonCodes: r.validation.reasonCodes, materialFindings: r.validation.materialFindings, decisionTrace: r.validation.decisionTrace })) };
  writeAtomic(path.join(batchDir, 'candidates.json'), { runId: deps.runId, batchId: def.batchId, pokemonIds: def.pokemonIds, totalGenerated: result.drafts.length, skippedSpecies: result.skippedSpecies, drafts: result.drafts, reviews: result.reviews });
  writeAtomic(path.join(batchDir, 'full-team-structures.json'), { runId: deps.runId, batchId: def.batchId, count: result.fullTeamStructures.length, structures: result.fullTeamStructures });
  writeAtomic(path.join(batchDir, 'evidence-packages.json'), { runId: deps.runId, batchId: def.batchId, packages: result.results.map(r => ({ setId: r.setId, context: r.context, scenarioSignature: r.scenarioSet.signature })) });
  writeAtomic(path.join(batchDir, 'specialist-results.json'), { runId: deps.runId, batchId: def.batchId, results: result.results.map(r => ({ setId: r.setId, specialistResults: r.validation.specialistResults })) });
  writeAtomic(verdictsPath, verdictsPayload);
  writeAtomic(path.join(batchDir, 'performance.json'), { runId: deps.runId, batchId: def.batchId, totalDurationMs: Date.now() - startedAt, candidateCount: result.results.length, p50Ms: p50, p95Ms: p95, maxMs: durations[durations.length - 1] ?? 0 });

  const candidateCount = result.results.length;
  const decisionTraceOk = decisionTraceCoverage === candidateCount;
  const digestOk = digestMismatches === 0;
  const batchValid = candidateCount > 0 && decisionTraceOk && digestOk;

  const finalArtifactDigest = digest(fs.readFileSync(verdictsPath, 'utf8'));
  writeAtomic(checkpointPath, { batchId: def.batchId, attemptCount: decision.nextAttemptCount, status: batchValid ? 'completed' : 'failed', ...current, artifactDigest: finalArtifactDigest, candidateCount, terminalStatus: batchValid ? undefined : 'failed-after-retry-exhaustion' });

  return { batchId: def.batchId, action: decision.action, reasonCode: decision.reasonCode, valid: batchValid, candidateCount, verdictCounts };
}

function main(): void {
  const allowed = new Set(['--run-id', '--mode', '--batch-id']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const mode = arg('--mode') ?? 'run';
  if (!['generate', 'run', 'resume', 'check'].includes(mode)) fail(`Unknown --mode: ${mode}`, 2);
  const batchId = arg('--batch-id');
  if (mode === 'generate' && !batchId) fail('--batch-id is required for --mode generate', 2);

  const runDir = path.resolve(`artifacts/competitive-production-readiness/${runId}`);
  const rosterPath = path.join(runDir, 'roster', 'eligible-records.json');
  if (!fs.existsSync(rosterPath)) fail(`Missing roster reconciliation -- run sets:champions:roster:reconcile first: ${rosterPath}`, 4);

  const pkg = loadChampionsCompetitivePackage();
  const validation = validateChampionsCompetitivePackage(pkg);
  const natures = JSON.parse(fs.readFileSync('src/equinox/data-packs/competitive/champions-reg-mb-doubles/natures.json', 'utf8')).natures as Array<{ natureId: string; increasedStat: string | null; decreasedStat: string | null }>;
  const catalog = resolveHomologatedTargetCatalog(pkg, validation);
  const deps = { packageDigest: pkg.sourceManifest.packageDigest, catalog, validation, natures, pkg, runId };

  const definitions = loadBatchDefinitions(runDir, batchId);
  if (definitions.length === 0) fail('No batches to process -- run sets:champions:expansion:full:plan first', 12);

  if (mode === 'check') {
    const reports = definitions.map(def => {
      const checkpointPath = path.join(runDir, 'batches', def.batchId, 'checkpoint.json');
      const exists = fs.existsSync(checkpointPath);
      const checkpoint = exists ? JSON.parse(fs.readFileSync(checkpointPath, 'utf8')) : null;
      return { batchId: def.batchId, checkpointExists: exists, status: checkpoint?.status ?? 'not-started', attemptCount: checkpoint?.attemptCount ?? 0 };
    });
    writeAtomic(path.join(runDir, 'batches', 'batch-status.json'), { runId, reports });
    console.log(JSON.stringify({ valid: true, mode, batchCount: reports.length, reports, mongoReads: 0, mongoWrites: 0, networkReads: 0, productionWrites: 0 }));
    return;
  }

  const results = definitions.map(def => processOneBatch(runDir, def, deps));
  const allValid = results.every(r => r.valid);
  const skippedAlreadyComplete = results.filter(r => r.action === 'skip-already-complete').length;
  const blockedExhausted = results.filter(r => r.action === 'blocked-retry-exhausted').length;

  writeAtomic(path.join(runDir, 'batches', 'batch-run-summary.json'), { runId, mode, results });
  console.log(JSON.stringify({ valid: allValid && blockedExhausted === 0, mode, batchCount: results.length, skippedAlreadyComplete, blockedExhausted, results: results.map(r => ({ batchId: r.batchId, action: r.action, reasonCode: r.reasonCode, valid: r.valid, candidateCount: r.candidateCount, verdictCounts: r.verdictCounts })), mongoReads: 0, mongoWrites: 0, networkReads: 0, productionWrites: 0 }));
  if (!allValid || blockedExhausted > 0) process.exitCode = 16;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    if (process.exitCode === undefined) { console.error(error instanceof Error ? error.message : error); process.exitCode = 25; }
  }
}
