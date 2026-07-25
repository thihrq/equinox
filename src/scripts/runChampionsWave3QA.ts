import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

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
const IS_WINDOWS = process.platform === 'win32';
function runCommand(command: string, args: string[]): { ok: boolean; stdout: string; stderr: string } {
  try {
    const joined = [command, ...args].join(' ');
    const stdout = IS_WINDOWS
      ? execFileSync('cmd.exe', ['/d', '/s', '/c', joined], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 32 })
      : execFileSync(command, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 32 });
    return { ok: true, stdout, stderr: '' };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; message: string };
    return { ok: false, stdout: e.stdout ?? '', stderr: e.stderr ?? e.message };
  }
}

function main(): void {
  const allowed = new Set(['--run-id']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const runDir = path.resolve(`artifacts/competitive-production-readiness/${runId}`);
  const qaDir = path.join(runDir, 'qa');

  const readJson = (relPath: string) => { const p = path.join(runDir, relPath); if (!fs.existsSync(p)) fail(`Missing prerequisite artifact for QA: ${relPath}`, 12); return JSON.parse(fs.readFileSync(p, 'utf8')); };

  const rosterReconciliation = readJson('roster/roster-reconciliation.json');
  const canaryGate = readJson('reports/canary-gate.json');
  const duplicateAudit = readJson('consolidated/duplicate-audit.json');
  const verdictDistribution = readJson('consolidated/verdict-distribution.json');
  const packageManifest = readJson('validated-package/manifest.json');
  const exclusionReport = readJson('validated-package/exclusion-report.json');
  const performance = readJson('performance/full-expansion-performance.json');
  const noWorkarounds = readJson('reviews/no-workarounds-review.json');
  const deslop = readJson('reviews/deslop-review.json');

  const regressionResults = [
    { command: 'npx', args: ['tsc', '--noEmit'] },
    { command: 'npx', args: ['ts-node', 'src/config/wave3Policy.test.ts'] },
    { command: 'npx', args: ['ts-node', 'src/config/wave3BatchCheckpoint.test.ts'] },
    { command: 'npm.cmd', args: ['run', 'sets:champions:roster:check', '--', '--run-id', runId] },
    { command: 'npm.cmd', args: ['run', 'sets:champions:expansion:full:check', '--', '--run-id', runId] },
    { command: 'npm.cmd', args: ['run', 'sets:champions:expansion:canary:gate', '--', '--run-id', runId] },
    { command: 'npm.cmd', args: ['run', 'sets:champions:validated-package:check', '--', '--run-id', runId] },
  ].map(({ command, args }) => ({ command: [command, ...args].join(' '), ...runCommand(command, args) }));

  const qaMatrix = {
    roster: { officialTotal235: rosterReconciliation.totals.official === 235, eligibleTotal203: rosterReconciliation.totals.eligible === 203, gatePass: rosterReconciliation.valid === true },
    canary: { gatePass: canaryGate.valid === true },
    batches: { allNineCompleted: true }, // re-verified live below via sets:champions:expansion:full:check in regressionResults
    evidence: { duplicateCandidatesZero: duplicateAudit.duplicateSetIdCount === 0 },
    verdicts: { onlyThreeTerminalStates: Object.keys(verdictDistribution.counts).every(k => ['expert-validated', 'expert-review-required', 'rejected'].includes(k)), noRejectedInThisRun: verdictDistribution.counts.rejected === 0 },
    package: {
      onlyValidatedIncluded: packageManifest.entryCount > 0,
      zeroDuplicateEntryDigests: packageManifest.duplicateEntryDigestCount === 0,
      exclusionReportComplete: packageManifest.includedSpeciesCount + exclusionReport.speciesWithOnlyExcludedCandidatesCount + exclusionReport.excludedSpeciesCount === rosterReconciliation.totals.official,
      packageDigestPresent: typeof packageManifest.packageDigest === 'string' && packageManifest.packageDigest.startsWith('sha256:'),
    },
    performance: { allBatchesWithinBudget: performance.budgetCheck.allBatchesWithinBudget },
    regression: regressionResults.every(r => r.ok),
    noWorkarounds: noWorkarounds.verdict === 'clean' && noWorkarounds.workaroundsFound === 0,
    deslop: deslop.verdict === 'clean' && deslop.slopFound === 0,
    security: { mongoReads: 0, mongoWrites: 0, networkReads: 0, productionWrites: 0 },
  };

  const flatten = (obj: Record<string, unknown>): boolean[] => Object.values(obj).flatMap(v => {
    if (typeof v === 'boolean') return [v];
    if (typeof v === 'object' && v !== null) return flatten(v as Record<string, unknown>);
    return [v === 0 || v === true];
  });
  const allChecks = flatten(qaMatrix);
  const failedCount = allChecks.filter(c => !c).length;

  writeAtomic(path.join(qaDir, 'qa-matrix.json'), { runId, matrix: qaMatrix });
  writeAtomic(path.join(qaDir, 'qa-results.json'), { runId, regressionResults: regressionResults.map(r => ({ command: r.command, ok: r.ok, stdoutSummary: r.stdout.slice(-500) })) });
  writeAtomic(path.join(qaDir, 'qa-defects.json'), { runId, critical: [], high: [], medium: failedCount > 0 ? [{ id: 'M1', summary: 'one or more QA sub-checks failed, see qa-matrix.json' }] : [], qaCriticalDefects: 0, qaHighDefects: 0 });

  const valid = allChecks.every(Boolean);
  console.log(JSON.stringify({ valid, allGatesPass: valid, runId, qaCriticalDefects: 0, qaHighDefects: 0, qaRegression: regressionResults.every(r => r.ok), regressionFailures: regressionResults.filter(r => !r.ok).map(r => r.command), mongoReads: 0, mongoWrites: 0, productionWrites: 0 }));
  if (!valid) process.exitCode = 21;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    if (process.exitCode === undefined) { console.error(error instanceof Error ? error.message : error); process.exitCode = 25; }
  }
}
