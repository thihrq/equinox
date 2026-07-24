// SECRET-SANITIZER-OUTPUT-ISOLATION-012. Proves the secret sanitizer inspects the release tree
// without writing anything into it: the scan root stays byte-identical, evidence lands only in an
// explicit external output root, and every containment bypass (equal paths, descendants, "..",
// symlinks/junctions, cwd manipulation) is rejected fail-closed.
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { runSecretSanitizer, assertOutputOutsideScanRoot, isDescendantPath, SECRET_SANITIZER_EVIDENCE_FILES } from '../scripts/secretSanitizer';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertThrowsWith(fn: () => unknown, expectedMessage: string, context: string): void {
  try {
    fn();
  } catch (error) {
    const actual = error instanceof Error ? error.message : String(error);
    assert(actual === expectedMessage, `${context}: expected "${expectedMessage}", got "${actual}"`);
    return;
  }
  throw new Error(`${context}: expected throw of "${expectedMessage}", but nothing was thrown.`);
}

// Independent tree digest -- deliberately NOT reusing DeterministicManifestBuilder, so scan-root
// immutability is proven by a second, unrelated implementation.
function treeDigest(root: string): { digest: string; entryCount: number } {
  const files: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) { stack.push(full); continue; }
      if (entry.isFile()) files.push(full);
    }
  }
  const lines = files
    .map(f => `${crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}  ${path.relative(root, f).split(path.sep).join('/')}`)
    .sort()
    .join('\n');
  return { digest: crypto.createHash('sha256').update(lines).digest('hex'), entryCount: files.length };
}

function makeScanRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'equinox-sanitizer-scan-'));
  fs.mkdirSync(path.join(dir, 'backend'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'metadata'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'backend', 'server.js'), 'console.log("ok");\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'metadata', 'build-information.json'), '{"releaseCandidateId":"rc-test"}\n', 'utf8');
  return dir;
}

const cleanups: string[] = [];
function tracked(dir: string): string { cleanups.push(dir); return dir; }

try {
  // -------- isDescendantPath: segment-based, not startsWith --------
  assert(isDescendantPath('/a/b/c', '/a/b'), 'a real descendant must be detected.');
  assert(!isDescendantPath('/a/b', '/a/b'), 'an identical path is not a descendant of itself.');
  // The classic startsWith bug: "/a/bcd" naively "starts with" "/a/b" but is a sibling, not a child.
  assert(!isDescendantPath('/a/bcd', '/a/b'), 'a sibling sharing a name prefix must NOT count as a descendant (segment comparison, not startsWith).');
  assert(!isDescendantPath('/a', '/a/b'), 'an ancestor is not a descendant.');

  // -------- output root required --------
  assertThrowsWith(() => runSecretSanitizer('legacy-string-run-id' as never), 'SECRET_SANITIZER_OUTPUT_ROOT_REQUIRED',
    'calling with a bare run-id string (the legacy cwd-based form) must fail closed');

  // -------- valid external output --------
  {
    const scanRoot = tracked(makeScanRoot());
    const outputRoot = tracked(fs.mkdtempSync(path.join(os.tmpdir(), 'equinox-sanitizer-out-')));
    const before = treeDigest(scanRoot);

    const summary = runSecretSanitizer({ scanRoot, outputRoot, runId: 'run-external' });
    assert(summary.passed === true, 'a clean scan root must produce passed:true.');

    const after = treeDigest(scanRoot);
    assert(before.digest === after.digest, 'scan root digest must be unchanged by the sanitizer.');
    assert(before.entryCount === after.entryCount, 'scan root entry count must be unchanged by the sanitizer.');

    // Evidence exists ONLY externally.
    for (const file of SECRET_SANITIZER_EVIDENCE_FILES) {
      assert(fs.existsSync(path.join(outputRoot, file)), `evidence file ${file} must be written under the external output root.`);
    }
    assert(!fs.existsSync(path.join(scanRoot, 'artifacts')), 'no artifacts/ directory may be created inside the scan root.');
  }

  // -------- output inside scan root --------
  {
    const scanRoot = tracked(makeScanRoot());
    assertThrowsWith(() => runSecretSanitizer({ scanRoot, outputRoot: path.join(scanRoot, 'artifacts'), runId: 'run-inside' }),
      'SECRET_SANITIZER_OUTPUT_INSIDE_SCAN_ROOT', 'output nested inside the scan root must be rejected');
    assert(!fs.existsSync(path.join(scanRoot, 'artifacts')), 'a rejected run must not have created the directory it was rejected for.');
  }

  // -------- output equal to scan root --------
  {
    const scanRoot = tracked(makeScanRoot());
    assertThrowsWith(() => runSecretSanitizer({ scanRoot, outputRoot: scanRoot, runId: 'run-equal' }),
      'SECRET_SANITIZER_OUTPUT_INSIDE_SCAN_ROOT', 'output identical to the scan root must be rejected');
  }

  // -------- traversal that resolves back inside --------
  {
    const scanRoot = tracked(makeScanRoot());
    const traversal = path.join(scanRoot, '..', path.basename(scanRoot), 'artifacts');
    assertThrowsWith(() => runSecretSanitizer({ scanRoot, outputRoot: traversal, runId: 'run-traversal' }),
      'SECRET_SANITIZER_OUTPUT_INSIDE_SCAN_ROOT', 'a ".." path resolving back inside the scan root must be rejected');
  }

  // -------- trailing separator must not defeat containment --------
  {
    const scanRoot = tracked(makeScanRoot());
    assertThrowsWith(() => runSecretSanitizer({ scanRoot, outputRoot: `${path.join(scanRoot, 'artifacts')}${path.sep}`, runId: 'run-trailing' }),
      'SECRET_SANITIZER_OUTPUT_INSIDE_SCAN_ROOT', 'a trailing separator must not defeat containment checking');
  }

  // -------- missing scan root --------
  {
    const outputRoot = tracked(fs.mkdtempSync(path.join(os.tmpdir(), 'equinox-sanitizer-out-')));
    assertThrowsWith(() => runSecretSanitizer({ scanRoot: path.join(os.tmpdir(), 'equinox-nonexistent-scan-root-xyz'), outputRoot, runId: 'run-missing' }),
      'SECRET_SANITIZER_SCAN_ROOT_NOT_FOUND', 'a nonexistent scan root must be rejected');
  }

  // -------- empty/blank roots --------
  {
    const scanRoot = tracked(makeScanRoot());
    assertThrowsWith(() => runSecretSanitizer({ scanRoot, outputRoot: '   ', runId: 'run-blank' }),
      'SECRET_SANITIZER_OUTPUT_ROOT_REQUIRED', 'a blank output root must be rejected');
    assertThrowsWith(() => runSecretSanitizer({ scanRoot, outputRoot: path.join(os.tmpdir(), 'equinox-ok-out'), runId: '  ' }),
      'SECRET_SANITIZER_RUN_ID_REQUIRED', 'a blank run id must be rejected');
  }

  // -------- symlink/junction bypass: outputRoot looks external but resolves inside --------
  {
    const scanRoot = tracked(makeScanRoot());
    const linkParent = tracked(fs.mkdtempSync(path.join(os.tmpdir(), 'equinox-sanitizer-link-')));
    const link = path.join(linkParent, 'looks-external');
    let symlinkSupported = true;
    try {
      fs.symlinkSync(scanRoot, link, 'junction');
    } catch {
      symlinkSupported = false; // unprivileged Windows without Developer Mode -- skip, do not fake a pass
    }
    if (symlinkSupported) {
      assertThrowsWith(() => runSecretSanitizer({ scanRoot, outputRoot: path.join(link, 'artifacts'), runId: 'run-symlink' }),
        'SECRET_SANITIZER_OUTPUT_INSIDE_SCAN_ROOT', 'an output root reaching the scan root through a symlink/junction must be rejected');
      console.log('[Equinox] symlink/junction bypass case exercised.');
    } else {
      console.log('[Equinox] symlink/junction creation unavailable on this platform -- case not exercised (not silently passed).');
    }
  }

  // -------- cwd independence --------
  {
    const scanRoot = tracked(makeScanRoot());
    const outA = tracked(fs.mkdtempSync(path.join(os.tmpdir(), 'equinox-sanitizer-cwdA-')));
    const outB = tracked(fs.mkdtempSync(path.join(os.tmpdir(), 'equinox-sanitizer-cwdB-')));
    const originalCwd = process.cwd();
    try {
      // Same runId in both runs: the ONLY variable under test is the working directory, so any
      // difference in the resulting evidence would have to be caused by cwd.
      process.chdir(os.tmpdir());
      runSecretSanitizer({ scanRoot, outputRoot: outA, runId: 'run-cwd-fixed' });
      process.chdir(scanRoot);
      runSecretSanitizer({ scanRoot, outputRoot: outB, runId: 'run-cwd-fixed' });
    } finally {
      process.chdir(originalCwd);
    }
    const a = treeDigest(outA);
    const b = treeDigest(outB);
    assert(a.digest === b.digest, 'evidence written from two different working directories must be identical -- cwd must not influence output.');
    assert(!fs.existsSync(path.join(scanRoot, 'artifacts')), 'chdir-ing INTO the scan root must still not cause writes into it.');
  }

  // -------- assertOutputOutsideScanRoot is independently usable --------
  {
    const scanRoot = tracked(makeScanRoot());
    const outside = tracked(fs.mkdtempSync(path.join(os.tmpdir(), 'equinox-sanitizer-ok-')));
    assertOutputOutsideScanRoot(scanRoot, outside); // must not throw
    assertThrowsWith(() => assertOutputOutsideScanRoot(scanRoot, path.join(scanRoot, 'nested')),
      'SECRET_SANITIZER_OUTPUT_INSIDE_SCAN_ROOT', 'the containment guard must be callable on its own');
  }

  console.log('[Equinox] secretSanitizerOutputIsolation test passed.');
} finally {
  for (const dir of cleanups) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort temp cleanup */ }
  }
}
