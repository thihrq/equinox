import { assertReleaseFreezeWorktree, normalizeWorktreePath, DEFAULT_WORKTREE_SUFFIX } from '../scripts/freezeReleaseCandidate';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
function assertThrows(fn: () => void, expectedMessagePrefix: string, label: string): void {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(message.startsWith(expectedMessagePrefix), `${label}: expected message to start with "${expectedMessagePrefix}", got "${message}"`);
    return;
  }
  throw new Error(`${label}: expected to throw "${expectedMessagePrefix}" but did not throw.`);
}
function assertNotThrows(fn: () => void, label: string): void {
  try {
    fn();
  } catch (error) {
    throw new Error(`${label}: expected not to throw, but threw "${error instanceof Error ? error.message : error}".`);
  }
}

// -------- Task 1: default-worktree, isolated-worktree, invalid-root, detached-head scenarios --------

assertNotThrows(() => assertReleaseFreezeWorktree({
  actualRoot: '/repo/.worktrees/competitive-data-v2-clean',
  expectedWorktreeSuffix: DEFAULT_WORKTREE_SUFFIX,
  allowDetachedHead: false,
  detachedHead: false,
}), 'default worktree with matching suffix must be accepted');

assertThrows(() => assertReleaseFreezeWorktree({
  actualRoot: '/repo/.worktrees/verify-self-contained-ga-clean',
  expectedWorktreeSuffix: DEFAULT_WORKTREE_SUFFIX,
  allowDetachedHead: false,
  detachedHead: true,
}), 'RELEASE_FREEZE_WRONG_WORKTREE', 'a different worktree without an override must be rejected, even before the detached-HEAD check runs');

assertNotThrows(() => assertReleaseFreezeWorktree({
  actualRoot: '/repo/.worktrees/verify-self-contained-ga-clean',
  expectedWorktreeRoot: '/repo/.worktrees/verify-self-contained-ga-clean',
  allowDetachedHead: true,
  detachedHead: true,
}), 'an explicitly authorized absolute root must be accepted in detached HEAD');

assertThrows(() => assertReleaseFreezeWorktree({
  actualRoot: '/repo/.worktrees/other',
  expectedWorktreeRoot: '/repo/.worktrees/verify-self-contained-ga-clean',
  allowDetachedHead: true,
  detachedHead: true,
}), 'RELEASE_FREEZE_WRONG_WORKTREE', 'a root different from the explicit override must be rejected');

assertThrows(() => assertReleaseFreezeWorktree({
  actualRoot: '/repo/.worktrees/verify-self-contained-ga-clean',
  expectedWorktreeRoot: '/repo/.worktrees/verify-self-contained-ga-clean',
  allowDetachedHead: false,
  detachedHead: true,
}), 'RELEASE_FREEZE_DETACHED_HEAD_NOT_ALLOWED', 'detached HEAD without explicit authorization must be rejected even when the root matches');

// -------- Task 5: override cannot become a generic bypass --------

assertThrows(() => assertReleaseFreezeWorktree({
  actualRoot: '/repo/.worktrees/competitive-data-v2-clean',
  expectedWorktreeRoot: '/repo/.worktrees/verify-self-contained-ga-clean',
  allowDetachedHead: true,
  detachedHead: false,
}), 'RELEASE_FREEZE_WRONG_WORKTREE', 'the production worktree itself must be rejected when a DIFFERENT explicit root is required -- the override authorizes one specific root, not "also allow the default".');

assertThrows(() => assertReleaseFreezeWorktree({
  actualRoot: '/repo/.worktrees/other',
  expectedWorktreeSuffix: DEFAULT_WORKTREE_SUFFIX,
  allowDetachedHead: true,
  detachedHead: true,
}), 'RELEASE_FREEZE_WRONG_WORKTREE', '--allow-detached-head alone (no root override) must never authorize an arbitrary worktree.');

// An explicit --expected-worktree-suffix of "ga-clean" would literally match here (a
// caller-authorized custom suffix is allowed by contract -- Task 2 permits
// --expected-worktree-suffix as a real override). What must NOT happen is a partial suffix being
// accepted when NO override was given and the DEFAULT is required -- verified next.
assertThrows(() => assertReleaseFreezeWorktree({
  actualRoot: '/repo/.worktrees/verify-self-contained-ga-clean',
  allowDetachedHead: true,
  detachedHead: true,
}), 'RELEASE_FREEZE_WRONG_WORKTREE', 'with no override at all, the default full suffix is required -- a directory that merely contains "ga-clean" must not match.');

assertThrows(() => assertReleaseFreezeWorktree({
  actualRoot: '/repo/.worktrees/competitive-data-v2-clean',
  expectedWorktreeRoot: '',
  allowDetachedHead: false,
  detachedHead: false,
}), 'RELEASE_FREEZE_EXPECTED_ROOT_INVALID', 'an empty explicit root must fail, not silently fall back to default behavior.');

assertThrows(() => assertReleaseFreezeWorktree({
  actualRoot: '/repo/.worktrees/competitive-data-v2-clean',
  expectedWorktreeSuffix: '',
  allowDetachedHead: false,
  detachedHead: false,
}), 'RELEASE_FREEZE_EXPECTED_ROOT_INVALID', 'an empty explicit suffix must fail, not silently fall back to default behavior.');

assertThrows(() => assertReleaseFreezeWorktree({
  actualRoot: '/repo/.worktrees/competitive-data-v2-clean',
  expectedWorktreeRoot: '/repo/.worktrees/x',
  expectedWorktreeSuffix: DEFAULT_WORKTREE_SUFFIX,
  allowDetachedHead: false,
  detachedHead: false,
}), 'RELEASE_FREEZE_WORKTREE_ARGUMENT_CONFLICT', '--expected-worktree-root and --expected-worktree-suffix must be mutually exclusive.');

// '..' must not be able to walk out of an authorized root and still compare equal to it.
assertThrows(() => assertReleaseFreezeWorktree({
  actualRoot: '/repo/.worktrees/other',
  expectedWorktreeRoot: '/repo/.worktrees/verify-self-contained-ga-clean/../other/../verify-self-contained-ga-clean',
  allowDetachedHead: true,
  detachedHead: true,
}), 'RELEASE_FREEZE_WRONG_WORKTREE', 'a mismatched actual root must still be rejected even when the expected root string contains ".." segments that resolve elsewhere -- this case documents that path.resolve() normalizes ".." in the EXPECTED value too, so the comparison is exact.');

// -------- normalizeWorktreePath: path normalization tests --------

assert(normalizeWorktreePath('/a/b/c/') === normalizeWorktreePath('/a/b/c'), 'trailing separator must not affect normalization.');
assert(normalizeWorktreePath('/a/b/../b/c') === normalizeWorktreePath('/a/b/c'), '".." segments must resolve identically to the direct path.');
assert(normalizeWorktreePath('/a/./b/c') === normalizeWorktreePath('/a/b/c'), '"." segments must resolve identically to the direct path.');

console.log('[Equinox] releaseFreezeWorktreeGuard test passed.');
