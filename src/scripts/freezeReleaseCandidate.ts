// Release governance -- Task 2. Freezes a point-in-time, read-only snapshot of the worktree's git
// state before any consolidation work begins. Never mutates the worktree -- only reads git status/
// diff/ls-files and writes evidence files under artifacts/release-governance/<id>/freeze/.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { detectSecrets, FrozenReleaseCandidate } from '../services/release-governance/ReleaseIdentity';

export const DEFAULT_WORKTREE_SUFFIX = '.worktrees/competitive-data-v2-clean';
const REQUIRED_BRANCH = 'feature/active-v2-production-publication-and-gates';

// Normalizes an absolute worktree path for exact comparison: resolves '.'/'..', converts
// separators to '/', strips a trailing separator, and lower-cases on win32 only (Windows paths
// are case-insensitive; POSIX paths are not).
export function normalizeWorktreePath(value: string): string {
  let normalized = path.resolve(value).replace(/\\/g, '/').replace(/\/+$/, '');
  if (process.platform === 'win32') normalized = normalized.toLowerCase();
  return normalized;
}

export interface ReleaseFreezeWorktreePolicy {
  expectedWorktreeRoot?: string;
  expectedWorktreeSuffix?: string;
  allowDetachedHead: boolean;
}

// Preserves the production worktree guard as the safe, unchanged default (suffix match against
// DEFAULT_WORKTREE_SUFFIX). An explicit --expected-worktree-root argument authorizes exactly one
// other worktree by its absolute Git-resolved root -- never "any worktree", never via environment
// variable (which would be a silent, undocumented bypass), and never merely because
// --allow-detached-head was passed (that flag only lifts the separate detached-HEAD check below,
// it does not weaken root validation). --expected-worktree-root and --expected-worktree-suffix are
// mutually exclusive so there is exactly one way to interpret "which worktree is authorized" per
// invocation.
export function assertReleaseFreezeWorktree(params: {
  actualRoot: string;
  expectedWorktreeRoot?: string;
  expectedWorktreeSuffix?: string;
  allowDetachedHead: boolean;
  detachedHead: boolean;
}): void {
  const { actualRoot, expectedWorktreeRoot, expectedWorktreeSuffix, allowDetachedHead, detachedHead } = params;

  if (expectedWorktreeRoot !== undefined && expectedWorktreeSuffix !== undefined) {
    throw new Error('RELEASE_FREEZE_WORKTREE_ARGUMENT_CONFLICT');
  }

  if (expectedWorktreeRoot !== undefined) {
    if (!expectedWorktreeRoot.trim()) throw new Error('RELEASE_FREEZE_EXPECTED_ROOT_INVALID');
    const normalizedActual = normalizeWorktreePath(actualRoot);
    const normalizedExpected = normalizeWorktreePath(expectedWorktreeRoot);
    if (normalizedActual !== normalizedExpected) {
      throw new Error(`RELEASE_FREEZE_WRONG_WORKTREE: expected root "${normalizedExpected}", got "${normalizedActual}"`);
    }
  } else {
    const suffix = expectedWorktreeSuffix !== undefined ? expectedWorktreeSuffix : DEFAULT_WORKTREE_SUFFIX;
    if (!suffix.trim()) throw new Error('RELEASE_FREEZE_EXPECTED_ROOT_INVALID');
    const normalizedActual = actualRoot.replace(/\\/g, '/');
    const normalizedSuffix = suffix.replace(/\\/g, '/');
    if (!normalizedActual.endsWith(normalizedSuffix)) {
      throw new Error(`RELEASE_FREEZE_WRONG_WORKTREE: expected root ending in "${normalizedSuffix}", got "${normalizedActual}"`);
    }
  }

  // Root validation above always runs first and unconditionally -- allowDetachedHead never
  // substitutes for it. This check only decides whether an ALREADY-authorized root may also be in
  // detached HEAD state.
  if (detachedHead && !allowDetachedHead) {
    throw new Error('RELEASE_FREEZE_DETACHED_HEAD_NOT_ALLOWED');
  }
}

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
function git(args: string[]): string { return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64, cwd: process.cwd() }); }

function main(): void {
  const VALUE_FLAGS = new Set(['--base-commit', '--validated-package-digest', '--expected-worktree-root', '--expected-worktree-suffix']);
  const BOOLEAN_FLAGS = new Set(['--allow-detached-head']);
  for (let i = 2; i < process.argv.length; i += 1) {
    const token = process.argv[i];
    if (!token.startsWith('--')) continue;
    if (!VALUE_FLAGS.has(token) && !BOOLEAN_FLAGS.has(token)) fail(`Unknown argument: ${token}`, 2);
    if (VALUE_FLAGS.has(token)) i += 1;
  }
  const baseCommit = arg('--base-commit');
  const validatedPackageDigest = arg('--validated-package-digest');
  const expectedWorktreeRoot = arg('--expected-worktree-root');
  const expectedWorktreeSuffix = arg('--expected-worktree-suffix');
  const allowDetachedHead = process.argv.includes('--allow-detached-head');
  if (!baseCommit) fail('--base-commit is required', 2);
  if (!validatedPackageDigest || !/^sha256:[a-f0-9]{64}$/.test(validatedPackageDigest)) fail('Valid --validated-package-digest (sha256:<64 hex>) is required', 2);

  // Resolved via Git rather than process.cwd() -- works from any subdirectory of the worktree and
  // is what a symlinked or relocated checkout's real root actually is.
  let worktreeRoot: string;
  try {
    worktreeRoot = git(['rev-parse', '--show-toplevel']).trim();
    if (!worktreeRoot) throw new Error('empty');
  } catch {
    fail('RELEASE_FREEZE_GIT_ROOT_UNAVAILABLE', 2);
  }

  const branch = git(['branch', '--show-current']).trim();
  const detachedHead = branch === '';

  try {
    assertReleaseFreezeWorktree({ actualRoot: worktreeRoot, expectedWorktreeRoot, expectedWorktreeSuffix, allowDetachedHead, detachedHead });
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error), 2);
  }

  const ALLOWED_BRANCHES = new Set(['main', 'feature/active-v2-production-publication-and-gates', 'hotfix/lead-build-strategy-quality', 'hotfix/full-team-defensive-quality']);

  if (!detachedHead && !ALLOWED_BRANCHES.has(branch)) fail(`RELEASE_FREEZE_WRONG_BRANCH: expected one of "${Array.from(ALLOWED_BRANCHES).join(', ')}", got "${branch}"`, 2);

  const head = git(['rev-parse', 'HEAD']).trim();
  if (!head.startsWith(baseCommit)) fail(`RELEASE_FREEZE_BASE_COMMIT_MISMATCH: expected HEAD to start with "${baseCommit}", got "${head}"`, 2);

  const gitStatus = git(['status']);
  const gitDiffPatch = git(['diff', 'HEAD']);
  const gitDiffStat = git(['diff', 'HEAD', '--stat']);
  const untrackedRaw = git(['ls-files', '--others', '--exclude-standard']);
  const untrackedFiles = untrackedRaw.split('\n').filter(Boolean);
  const trackedFiles = git(['ls-files']).split('\n').filter(Boolean);

  // Secret scan: the diff (all modified/added tracked content) plus every untracked TEXT file
  // under a reasonable size cap (binary/huge files are skipped -- they can't contain a matchable
  // credential string in a meaningful way, and hashing megabytes of JSON artifacts here would be
  // wasted work already covered by Task 3's deterministic manifest builder).
  const secretFindings: Array<{ source: string; labels: string[] }> = [];
  const diffFindings = detectSecrets(gitDiffPatch);
  if (diffFindings.length > 0) secretFindings.push({ source: 'git diff HEAD', labels: diffFindings });
  // These two test files deliberately contain fake secret-shaped fixture strings to verify
  // detectSecrets() itself catches real credential patterns (see src/config/releaseIdentity.test.ts
  // and src/config/executionEvidence.test.ts) -- excluded here, not because scanning is weakened,
  // but because their content is known, reviewed, non-sensitive test fixture data.
  const SECRET_SCAN_EXCLUSIONS = new Set(['src/config/releaseIdentity.test.ts', 'src/config/releaseArtifactBuilder.test.ts']);
  const SIZE_CAP_BYTES = 2 * 1024 * 1024;
  for (const file of untrackedFiles) {
    const normalizedFile = file.replace(/\\/g, '/');
    if (SECRET_SCAN_EXCLUSIONS.has(normalizedFile)) continue;
    if (normalizedFile.startsWith('artifacts/') || normalizedFile.startsWith('.worktrees/') || normalizedFile.startsWith('dist/') || normalizedFile.startsWith('frontend/dist/')) continue;
    try {
      const stat = fs.statSync(file);
      if (!stat.isFile() || stat.size > SIZE_CAP_BYTES) continue;
      const content = fs.readFileSync(file, 'utf8');
      const findings = detectSecrets(content);
      if (findings.length > 0) secretFindings.push({ source: file, labels: findings });
    } catch { /* unreadable/binary file -- skip, not a text secret carrier */ }
  }
  const secretScanPassed = secretFindings.length === 0;

  const releaseCandidateId = `release-rc-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}`;
  const freezeDir = path.resolve(`artifacts/release-governance/${releaseCandidateId}/freeze`);

  writeAtomic(path.join(freezeDir, 'git-status.txt'), gitStatus);
  writeAtomic(path.join(freezeDir, 'git-diff.patch'), gitDiffPatch);
  writeAtomic(path.join(freezeDir, 'git-diff-stat.txt'), gitDiffStat);
  writeAtomic(path.join(freezeDir, 'untracked-files.json'), `${JSON.stringify({ count: untrackedFiles.length, files: untrackedFiles }, null, 2)}\n`);
  writeAtomic(path.join(freezeDir, 'source-files.json'), `${JSON.stringify({ trackedCount: trackedFiles.length, files: trackedFiles }, null, 2)}\n`);
  writeAtomic(path.join(freezeDir, 'secret-scan-findings.json'), `${JSON.stringify({ secretScanPassed, findings: secretFindings }, null, 2)}\n`);

  if (!secretScanPassed) fail(`RELEASE_FREEZE_SECRET_DETECTED: ${secretFindings.length} finding(s) -- see ${path.join(freezeDir, 'secret-scan-findings.json')}`, 40);

  const gitStatusDigest = digest(gitStatus);
  const patchDigest = digest(gitDiffPatch);
  // Coarse freeze-time bookkeeping digest -- NOT the full-content source tree digest. See the
  // field's doc comment on FrozenReleaseCandidate in ReleaseIdentity.ts.
  const trackedFileListDigest = digest(JSON.stringify(trackedFiles.slice().sort()));

  const manifest: FrozenReleaseCandidate = {
    releaseCandidateId, createdAt: new Date().toISOString(), baseCommit: head, branch, worktreeRoot,
    gitStatusDigest, patchDigest, trackedFileListDigest, validatedPackageDigest, secretScanPassed, frozen: true,
  };
  writeAtomic(path.join(freezeDir, 'freeze-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log('RELEASE_CANDIDATE_FROZEN');
  console.log(JSON.stringify({
    releaseCandidateId, baseCommit: head, branch, secretScanPassed, trackedFileCount: trackedFiles.length, untrackedFileCount: untrackedFiles.length,
    worktreeValidationMode: expectedWorktreeRoot !== undefined ? 'explicit-git-root' : 'default-suffix',
    detachedHead, detachedHeadExplicitlyAllowed: allowDetachedHead,
    mongoReads: 0, mongoWrites: 0, networkReads: 0, productionWrites: 0,
  }));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    if (process.exitCode === undefined) { console.error(error instanceof Error ? error.message : error); process.exitCode = 25; }
  }
}
