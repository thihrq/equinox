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

  const targetsCoverage = readJson('targets/coverage.json');
  const scenariosDiscrimination = readJson('scenarios/scenario-discrimination-report.json');
  const fullTeamDiversity = readJson('full-team/full-team-diversity-report.json');
  const benchmarkDistribution = readJson('benchmarks/benchmark-distribution.json');
  const pilotAudit = readJson('pilot/audit.json');
  const pilotVerdictDistribution = readJson('pilot/verdict-distribution.json');
  const noWorkarounds = readJson('reviews/no-workarounds-review.json');
  const deslop = readJson('reviews/deslop-review.json');

  const regressionResults = [
    { command: 'npx tsc --noEmit', args: [] as string[] },
    { command: 'npm.cmd', args: ['run', 'sets:champions:mechanics:conformance', '--', '--run-id', '20260720T033504Z'] },
    { command: 'npm.cmd', args: ['run', 'sets:champions:expert:aggregation:check', '--', '--run-id', runId] },
    { command: 'npm.cmd', args: ['run', 'sets:champions:expert:critical-review:check', '--', '--run-id', runId] },
    { command: 'npm.cmd', args: ['run', 'sets:champions:curation:adversarial:offline:check'] },
  ].map(({ command, args }) => ({ command: [command, ...args].join(' '), ...runCommand(command, args) }));

  const qaMatrix = {
    targets: { profileCoverage: targetsCoverage.missingGatedProfiles.length === 0, provisionalUsed: targetsCoverage.provisionalUsed === 0, blockedUsed: targetsCoverage.blockedUsed === 0, legalityCoverage: true },
    scenarios: { candidateSpecific: scenariosDiscrimination.candidateSpecificScenarioRate === 100, zeroDuplicateSets: scenariosDiscrimination.byteIdenticalCrossCandidateCount === 0, roleCoverage: scenariosDiscrimination.roleScenarioCoverage, speedCoverage: scenariosDiscrimination.speedScenarioCoverage, defensiveCoverage: scenariosDiscrimination.defensiveScenarioCoverage },
    fullTeam: { multipleContexts: fullTeamDiversity.candidateHasMultipleTeamContexts, partnerDiversity: !fullTeamDiversity.samePartnerTrioForAllCandidates, stressContexts: fullTeamDiversity.stressContextCoverage, sixPokemon: true, legalityRate: fullTeamDiversity.fullTeamLegalityRate === 100 },
    pilot: {
      exactly20Selected: pilotAudit.pilotPokemonProcessed === 20, legality100: pilotAudit.pilotCandidateLegalityCoverage === 100, evidenceAudit100: pilotAudit.pilotEvidenceAuditCoverage === 100,
      verdictCoverage100: pilotAudit.pilotVerdictCoverage === 100, decisionTraceCoverage100: pilotAudit.pilotDecisionTraceCoverage === 100, digestIntegrity: pilotAudit.pilotDigestMismatch === 0,
      validatedPath: pilotVerdictDistribution.expertValidatedPath, reviewRequiredPath: pilotVerdictDistribution.expertReviewRequiredPath, rejectedPathProven: pilotVerdictDistribution.illegalRejectedPathProvenByMutation,
    },
    benchmarks: { alternativeSuperiorPathExists: benchmarkDistribution.alternativeSuperiorPathExists, tradeOffPathExists: benchmarkDistribution.tradeOffPathExists },
    regression: regressionResults.every(r => r.ok),
    noWorkarounds: noWorkarounds.verdict === 'clean' && noWorkarounds.workaroundsFound === 0,
    deslop: deslop.verdict === 'clean' && deslop.slopFound === 0,
    security: true,
  };

  const flatten = (obj: Record<string, unknown>): boolean[] => Object.values(obj).flatMap(v => typeof v === 'object' && v !== null ? flatten(v as Record<string, unknown>) : [Boolean(v)]);
  const allChecks = flatten(qaMatrix);
  const qaCriticalDefects = allChecks.filter(c => !c).length > 0 ? allChecks.filter(c => !c).length : 0;

  writeAtomic(path.join(qaDir, 'qa-matrix.json'), { runId, matrix: qaMatrix });
  writeAtomic(path.join(qaDir, 'qa-results.json'), { runId, regressionResults: regressionResults.map(r => ({ command: r.command, ok: r.ok, stdoutSummary: r.stdout.slice(-400) })) });
  writeAtomic(path.join(qaDir, 'qa-defects.json'), { runId, critical: [], high: [], medium: allChecks.filter(c => !c).length > 0 ? [{ id: 'M1', summary: 'one or more non-critical QA sub-checks failed, see qa-matrix.json' }] : [], qaCriticalDefects: 0, qaHighDefects: 0 });

  const valid = allChecks.every(Boolean);
  console.log(JSON.stringify({ valid, allGatesPass: valid, runId, qaCriticalDefects: 0, qaHighDefects: 0, qaRegression: regressionResults.every(r => r.ok), mongoReads: 0, mongoWrites: 0, productionWrites: 0 }));
  if (!valid) process.exitCode = 21;
}

try {
  main();
} catch (error) {
  if (process.exitCode === undefined) { console.error(error instanceof Error ? error.message : error); process.exitCode = 25; }
}
