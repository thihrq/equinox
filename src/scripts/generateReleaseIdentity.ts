// Release governance -- Task 4. Computes the full digest identity of a frozen release candidate:
// patch, source tree, a clean backend build, a clean frontend build, and the Wave 8 dry-run
// evidence -- each via DeterministicManifestBuilder so two independent runs over identical content
// produce byte-identical digests. releaseArtifactDigest is left null here; buildReleaseArtifact.ts
// (Task 5) fills it in once the packaged artifact actually exists.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { buildDeterministicManifest, DeterministicManifest } from '../services/release-governance/DeterministicManifestBuilder';
import { assertValidDigestFields, ReleaseIdentityEnvelope } from '../services/release-governance/ReleaseIdentity';

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
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
const digest = (value: string): string => `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
const IS_WINDOWS = process.platform === 'win32';
function run(command: string, args: string[], cwd: string): void {
  if (IS_WINDOWS) execFileSync('cmd.exe', ['/d', '/s', '/c', [command, ...args].join(' ')], { cwd, stdio: 'inherit', maxBuffer: 1024 * 1024 * 64 });
  else execFileSync(command, args, { cwd, stdio: 'inherit', maxBuffer: 1024 * 1024 * 64 });
}

async function main(): Promise<void> {
  const allowed = new Set(['--release-candidate-id']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const releaseCandidateId = arg('--release-candidate-id');
  if (!releaseCandidateId) fail('--release-candidate-id is required', 2);

  const rcDir = path.resolve(`artifacts/release-governance/${releaseCandidateId}`);
  const freezeManifestPath = path.join(rcDir, 'freeze', 'freeze-manifest.json');
  if (!fs.existsSync(freezeManifestPath)) fail(`Missing freeze manifest -- run sets:release:freeze first: ${freezeManifestPath}`, 12);
  const freeze = JSON.parse(fs.readFileSync(freezeManifestPath, 'utf8')) as { baseCommit: string; patchDigest: string; validatedPackageDigest: string; frozen: boolean };
  if (!freeze.frozen) fail(`Release candidate ${releaseCandidateId} is not frozen`, 12);

  const worktreeRoot = process.cwd();

  console.log('Computing source tree digest...');
  const sourceTreeManifest: DeterministicManifest = await buildDeterministicManifest(path.join(worktreeRoot, 'src'), 'source-tree');
  writeAtomic(path.join(rcDir, 'manifests', 'source-tree.json'), `${JSON.stringify(sourceTreeManifest, null, 2)}\n`);

  console.log('Running clean backend build (tsc)...');
  fs.rmSync(path.join(worktreeRoot, 'dist'), { recursive: true, force: true });
  run('npx.cmd', ['tsc'], worktreeRoot);
  const backendManifest = await buildDeterministicManifest(path.join(worktreeRoot, 'dist'), 'backend-build');
  writeAtomic(path.join(rcDir, 'manifests', 'backend-build.json'), `${JSON.stringify(backendManifest, null, 2)}\n`);

  console.log('Running clean frontend build (tsc -b && vite build)...');
  const frontendRoot = path.join(worktreeRoot, 'frontend');
  fs.rmSync(path.join(frontendRoot, 'dist'), { recursive: true, force: true });
  run('npm.cmd', ['run', 'build'], frontendRoot);
  const frontendManifest = await buildDeterministicManifest(path.join(frontendRoot, 'dist'), 'frontend-dist');
  writeAtomic(path.join(rcDir, 'manifests', 'frontend-dist.json'), `${JSON.stringify(frontendManifest, null, 2)}\n`);

  // Wave 8 dry-run evidence digest: covers the corrected final report + closure state, so this
  // digest changes if either is ever silently re-edited after this point.
  const wave8ReportPath = path.resolve('artifacts/competitive-production-readiness/20260723T232100Z/reports/wave-8-final-report.md');
  const wave8ClosurePath = path.resolve('artifacts/competitive-production-readiness/20260723T232100Z/closure/final-runtime-state.json');
  const wave8DryRunEvidenceDigest = digest(fs.readFileSync(wave8ReportPath, 'utf8') + fs.readFileSync(wave8ClosurePath, 'utf8'));

  const envelope: ReleaseIdentityEnvelope = {
    releaseCandidateId,
    baseCommit: freeze.baseCommit,
    worktreePatchDigest: freeze.patchDigest,
    sourceTreeDigest: sourceTreeManifest.manifestDigest,
    backendBuildDigest: backendManifest.manifestDigest,
    frontendDistributionDigest: frontendManifest.manifestDigest,
    releaseArtifactDigest: null,
    validatedPackageDigest: freeze.validatedPackageDigest,
    wave8DryRunEvidenceDigest,
    generatedAt: new Date().toISOString(),
  };
  assertValidDigestFields(envelope);
  writeAtomic(path.join(rcDir, 'digests', 'release-identity.json'), `${JSON.stringify(envelope, null, 2)}\n`);

  console.log(JSON.stringify({ valid: true, releaseCandidateId, sourceTreeFileCount: sourceTreeManifest.entries.length, backendBuildFileCount: backendManifest.entries.length, frontendDistFileCount: frontendManifest.entries.length, sourceTreeDigest: sourceTreeManifest.manifestDigest, backendBuildDigest: backendManifest.manifestDigest, frontendDistributionDigest: frontendManifest.manifestDigest, mongoReads: 0, mongoWrites: 0, networkReads: 0, productionWrites: 0 }));
}

if (require.main === module) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); if (process.exitCode === undefined) process.exitCode = 25; });
}
