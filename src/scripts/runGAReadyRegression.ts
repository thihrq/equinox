// Release governance -- profile-aware regression. Two explicit profiles:
//
//   runtime-safety          -- self-contained: typecheck, committed unit tests, backend/frontend
//                               build, preflight, Mongo-optional/synthetic-fallback/format-registry/
//                               local-dev/secret-sanitization gates, and an EPHEMERAL release
//                               candidate (frozen/built/verified fresh, every run, from the current
//                               HEAD -- never a historical release-rc-* directory). Never touches
//                               the Wave 1-3 Champions QA pipeline.
//
//   full-competitive-pipeline -- requires the Wave 1-3 QA orchestrators (src/scripts/
//                               runChampionsWave{1,2,3}QA.ts) to actually exist on disk. When they
//                               do not (as in this commit chain -- see the dependency-closure
//                               evidence under artifacts/release-governance/self-contained-ga-
//                               regression-*/), this profile fails closed with
//                               FULL_COMPETITIVE_PIPELINE_SOURCES_NOT_AVAILABLE instead of silently
//                               reporting valid:true for work it did not do.
//
// Running this script without --profile is a hard error (RELEASE_REGRESSION_PROFILE_REQUIRED) --
// there is no default profile, so a bare command can never be mistaken for "the full regression".
import path from 'path';
import { execFileSync } from 'child_process';
import fs from 'fs';
import {
  assertFullPipelineSourcesPresent,
  assertValidProfile,
  buildRuntimeSafetyCapabilityManifest,
  buildRuntimeSafetyPackageCapability,
  ReleaseRegressionProfile,
  VALIDATED_PACKAGE_DIGEST,
} from '../config/releaseRegressionProfile';

function fail(message: string, code: number): never { console.error(message); process.exitCode = code; throw new Error(message); }
function writeAtomic(file: string, value: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, value, 'utf8');
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
      ? execFileSync('cmd.exe', ['/d', '/s', '/c', joined], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 })
      : execFileSync(command, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });
    return { ok: true, stdout, stderr: '' };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; message: string };
    return { ok: false, stdout: e.stdout ?? '', stderr: e.stderr ?? e.message };
  }
}
function findTestFiles(dir: string): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { result.push(...findTestFiles(full)); continue; }
    if (entry.isFile() && entry.name.endsWith('.test.ts')) result.push(full);
  }
  return result;
}
function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function currentHead(): string { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); }

function runCommittedUnitTests(): { ok: boolean; testFileCount: number; testResults: Array<{ file: string; ok: boolean; stdout: string; stderr: string }> } {
  const testFiles = findTestFiles(path.resolve('src/config')).sort();
  const testResults = testFiles.map((file) => ({ file: path.relative(process.cwd(), file), ...runCommand('npx.cmd', ['ts-node', file]) }));
  return { ok: testResults.every((r) => r.ok), testFileCount: testFiles.length, testResults };
}

function runtimeSafetyStaticGates(testResults: Array<{ file: string; ok: boolean }>): {
  dataModePolicy: boolean; syntheticFallbackFailClosed: boolean; formatRegistryPreserved: boolean; localDevIsolation: boolean;
} {
  const testOk = (name: string) => testResults.find((r) => r.file.endsWith(name))?.ok === true;
  const packageJson = fs.readFileSync(path.resolve('package.json'), 'utf8');
  const localDevScriptEntry = packageJson.includes('"dev:local": "node scripts-local/run-local-dev.js"');
  const localDevScriptOnlyConsumer = (packageJson.match(/run-local-dev\.js/g) ?? []).length === 1;
  return {
    dataModePolicy: testOk('dataMode.test.ts'),
    syntheticFallbackFailClosed: testOk('syntheticFallbackPolicy.test.ts'),
    formatRegistryPreserved: testOk('formatEquivalence.test.ts'),
    localDevIsolation: localDevScriptEntry && localDevScriptOnlyConsumer,
  };
}

function currentGitWorktreeRoot(): string { return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim(); }

function buildAndVerifyEphemeralReleaseCandidate(baseCommit: string): { ok: boolean; releaseCandidateId: string | null; steps: Array<{ label: string; ok: boolean }>; worktreeValidation: { mode: 'explicit-git-root'; expectedWorktreeRoot: string } } {
  // Always resolve the worktree root via Git and pass it explicitly, with detached HEAD
  // authorized -- this single code path works identically whether this regression runs in the
  // shared production worktree (root == its own toplevel, branch attached) or in any isolated
  // verification worktree (root == that worktree's own toplevel, detached HEAD). The operator
  // never has to supply a personal path manually for the normal regression command.
  const expectedWorktreeRoot = currentGitWorktreeRoot();
  const worktreeValidation = { mode: 'explicit-git-root' as const, expectedWorktreeRoot };
  const freezeResult = runCommand('npm.cmd', ['run', 'release:freeze', '--', '--base-commit', baseCommit, '--validated-package-digest', VALIDATED_PACKAGE_DIGEST, '--expected-worktree-root', expectedWorktreeRoot, '--allow-detached-head']);
  const idLine = freezeResult.stdout.split('\n').find((line) => line.trim().startsWith('{"releaseCandidateId"'));
  const releaseCandidateId: string | null = idLine ? (JSON.parse(idLine).releaseCandidateId as string) : null;
  const steps = [{ label: 'release:freeze', ok: freezeResult.ok && releaseCandidateId !== null }];
  if (!releaseCandidateId) return { ok: false, releaseCandidateId: null, steps, worktreeValidation };

  const identityResult = runCommand('npm.cmd', ['run', 'release:identity', '--', '--release-candidate-id', releaseCandidateId]);
  steps.push({ label: 'release:identity', ok: identityResult.ok });
  const buildResult = runCommand('npm.cmd', ['run', 'release:build', '--', '--release-candidate-id', releaseCandidateId]);
  steps.push({ label: 'release:build', ok: buildResult.ok });
  const verifyResult = runCommand('npm.cmd', ['run', 'release:verify', '--', '--release-candidate-id', releaseCandidateId]);
  steps.push({ label: 'release:verify', ok: verifyResult.ok });

  return { ok: steps.every((s) => s.ok), releaseCandidateId, steps, worktreeValidation };
}

// Public evidence must never contain a personal absolute filesystem path -- reduce to the
// worktree's own directory name (the meaningful, non-identifying part) for reporting.
function sanitizeWorktreeReference(absoluteRoot: string): string {
  const normalized = absoluteRoot.replace(/\\/g, '/').replace(/\/+$/, '');
  const segments = normalized.split('/');
  return segments.slice(-2).join('/');
}

async function runRuntimeSafetyRegression(): Promise<void> {
  const baseCommit = currentHead();
  const typecheckResult = runCommand('npx.cmd', ['tsc', '--noEmit']);
  const unitTests = runCommittedUnitTests();
  const backendBuild = runCommand('npm.cmd', ['run', 'build']);
  const frontendBuild = runCommand('npm.cmd', ['--prefix', 'frontend', 'run', 'build']);
  const preflight = runCommand('npm.cmd', ['run', 'preflight']);
  const gitDiffCheck = runCommand('git', ['diff', '--check']);
  const staticGates = runtimeSafetyStaticGates(unitTests.testResults);

  const release = buildAndVerifyEphemeralReleaseCandidate(baseCommit);

  // Secret sanitization scan -- scoped to the assembled release/ directory of the ephemeral
  // candidate just built, NOT the whole shared dev worktree. Scanning the repo root would
  // false-positive on gitignored local dev files (.env, .atlas-restore-drill-dump/) that were
  // never part of what gets packaged -- see the false-positive analysis recorded for commit 3
  // (secretSanitizer.ts) in targeted-classification-20260724T100530Z. Scanning the assembled
  // artifact output instead matches the tool's actual purpose: catching secrets in what ships.
  //
  // Scan target and evidence destination are passed explicitly. Routing the evidence by cwd (the
  // previous approach) wrote the scanner's own output INSIDE the artifact it had just inspected,
  // which invalidated the sealed manifest and left the artifact permanently unverifiable. The
  // artifact is re-verified after the scan below precisely to prove that no longer happens.
  const sanitizerRunId = `runtime-safety-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}`;
  const outDir = path.resolve(`artifacts/release-governance/runtime-safety-regression-${release.releaseCandidateId ?? sanitizerRunId}`);
  let secretSanitizationOk = false;
  let artifactImmutableAcrossScan = false;
  let sanitizerEvidenceWrittenOutsideArtifact = false;
  let postScanVerification: { digestMatch: boolean; recordedEntryCount: number; recomputedEntryCount: number } | null = null;
  if (release.ok && release.releaseCandidateId) {
    const artifactDir = path.resolve(`artifacts/release-governance/${release.releaseCandidateId}/builds/release-artifact`);
    const releaseDir = path.join(artifactDir, 'release');
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { runSecretSanitizer } = require('./secretSanitizer') as { runSecretSanitizer: (options: { scanRoot: string; outputRoot: string; runId: string }) => { passed: boolean } };
      const sanitizerEvidenceDir = path.join(outDir, 'security');
      secretSanitizationOk = runSecretSanitizer({ scanRoot: releaseDir, outputRoot: sanitizerEvidenceDir, runId: sanitizerRunId }).passed;

      // Measured, not asserted: the evidence must actually exist at the external location, and the
      // directory the old cwd-routed behavior used to create must actually be absent.
      sanitizerEvidenceWrittenOutsideArtifact = fs.existsSync(path.join(sanitizerEvidenceDir, 'secret-scan-summary.json'))
        && !fs.existsSync(path.join(releaseDir, 'artifacts'));

      // Independent proof that scanning did not mutate the artifact: recompute the manifest and
      // compare it against the digest sealed at build time.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { verifyReleaseArtifact } = require('../services/release-governance/ReleaseArtifactVerifier') as { verifyReleaseArtifact: (dir: string) => Promise<{ digestMatch: boolean; recordedEntryCount: number; recomputedEntryCount: number }> };
      // Only the digest/count fields are kept: verifyReleaseArtifact() also returns the absolute
      // artifactDir, which would write the developer's personal path into public evidence.
      const verification = await verifyReleaseArtifact(artifactDir);
      postScanVerification = {
        digestMatch: verification.digestMatch,
        recordedEntryCount: verification.recordedEntryCount,
        recomputedEntryCount: verification.recomputedEntryCount,
      };
      artifactImmutableAcrossScan = verification.digestMatch
        && verification.recordedEntryCount === verification.recomputedEntryCount;
    } catch (error) {
      secretSanitizationOk = false;
      artifactImmutableAcrossScan = false;
      sanitizerEvidenceWrittenOutsideArtifact = false;
    }
  }
  const packageCapability = buildRuntimeSafetyPackageCapability(release.ok, release.ok, release.ok);
  const capabilityManifest = buildRuntimeSafetyCapabilityManifest();

  const valid = typecheckResult.ok && unitTests.ok && backendBuild.ok && frontendBuild.ok && preflight.ok && gitDiffCheck.ok
    && staticGates.dataModePolicy && staticGates.syntheticFallbackFailClosed && staticGates.formatRegistryPreserved && staticGates.localDevIsolation
    && secretSanitizationOk && artifactImmutableAcrossScan && sanitizerEvidenceWrittenOutsideArtifact && release.ok;

  const summary = {
    profile: 'runtime-safety' as ReleaseRegressionProfile,
    valid,
    executionWorktree: sanitizeWorktreeReference(release.worktreeValidation.expectedWorktreeRoot),
    baseCommit,
    testFileCount: unitTests.testFileCount,
    testsAllPassed: unitTests.ok,
    failedTests: unitTests.testResults.filter((r) => !r.ok).map((r) => r.file),
    typecheck: typecheckResult.ok,
    backendBuild: backendBuild.ok,
    frontendBuild: frontendBuild.ok,
    preflight: preflight.ok,
    gitDiffCheck: gitDiffCheck.ok,
    ...staticGates,
    secretSanitization: secretSanitizationOk,
    releaseCandidate: {
      ok: release.ok,
      releaseCandidateId: release.releaseCandidateId,
      steps: release.steps,
      worktreeValidation: { mode: release.worktreeValidation.mode, expectedWorktreeRoot: sanitizeWorktreeReference(release.worktreeValidation.expectedWorktreeRoot) },
    },
    packageCapability,
    capabilityManifest,
    // The scan inspects the sealed artifact and writes its evidence outside it; these fields are
    // the proof, measured after the scan rather than assumed.
    sanitizerEvidenceWrittenOutsideArtifact,
    artifactImmutableAcrossScan,
    postScanVerification,
    historicalEvidenceConsumed: false,
    mongoReads: 0, mongoWrites: 0, networkReads: 0, productionWrites: 0,
  };

  writeAtomic(path.join(outDir, 'regression-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

  console.log(JSON.stringify(summary));
  if (!valid) process.exitCode = 21;
}

async function runFullCompetitivePipelineRegression(): Promise<void> {
  // assertFullPipelineSourcesPresent() checks the FILESYSTEM, not git tracking status -- in an
  // isolated checkout of this commit chain (where the Wave 1-3 sources genuinely do not exist on
  // disk) it throws FULL_COMPETITIVE_PIPELINE_SOURCES_NOT_AVAILABLE, which is the required
  // fail-closed behavior. In the shared dev worktree the sources exist on disk (untracked, never
  // committed), so this assertion passes there and execution reaches the line below -- which is
  // intentional: the ACTUAL Wave 1-3 QA replay is not implemented by this commit chain (that is
  // exactly the Wave 1-3 Pipeline Consolidation initiative deferred by
  // SELF-CONTAINED-GA-REGRESSION-007's Task 1 dependency-closure finding), so this profile must
  // never silently report valid:true for work it does not do, in either context.
  assertFullPipelineSourcesPresent();
  fail('FULL_COMPETITIVE_PIPELINE_REGRESSION_NOT_IMPLEMENTED', 22);
}

async function main(): Promise<void> {
  const allowed = new Set(['--profile']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const profile = arg('--profile');
  assertValidProfile(profile);

  if (profile === 'runtime-safety') { await runRuntimeSafetyRegression(); return; }
  await runFullCompetitivePipelineRegression();
}

if (require.main === module) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); if (process.exitCode === undefined) process.exitCode = 25; });
}
