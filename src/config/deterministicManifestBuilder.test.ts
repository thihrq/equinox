import fs from 'fs';
import path from 'path';
import os from 'os';
import { buildDeterministicManifest } from '../services/release-governance/DeterministicManifestBuilder';

function assertEqual(label: string, actual: unknown, expected: unknown): void { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`DETERMINISTIC_MANIFEST_TEST_FAILED:${label} -- expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
async function expectRejects(label: string, fn: () => Promise<unknown>, messageIncludes: string): Promise<void> {
  let threw = false;
  try { await fn(); } catch (error) { threw = error instanceof Error && error.message.includes(messageIncludes); }
  if (!threw) throw new Error(`DETERMINISTIC_MANIFEST_GUARD_NOT_CAUGHT:${label}`);
}

async function main(): Promise<void> {
  const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'graphify-dmb-test-'));
  try {
    // Case: lexicographic ordering of entries regardless of filesystem readdir order.
    fs.mkdirSync(path.join(scratchRoot, 'ordering'));
    fs.writeFileSync(path.join(scratchRoot, 'ordering', 'zeta.txt'), 'z');
    fs.writeFileSync(path.join(scratchRoot, 'ordering', 'alpha.txt'), 'a');
    fs.writeFileSync(path.join(scratchRoot, 'ordering', 'mid.txt'), 'm');
    const orderingManifest = await buildDeterministicManifest(path.join(scratchRoot, 'ordering'), 'source-tree', []);
    assertEqual('lexicographic-order', orderingManifest.entries.map(e => e.path), ['alpha.txt', 'mid.txt', 'zeta.txt']);

    // Case: nested directories normalize to forward-slash paths regardless of OS separator.
    fs.mkdirSync(path.join(scratchRoot, 'nested', 'a', 'b'), { recursive: true });
    fs.writeFileSync(path.join(scratchRoot, 'nested', 'a', 'b', 'file.txt'), 'content');
    const nestedManifest = await buildDeterministicManifest(path.join(scratchRoot, 'nested'), 'source-tree', []);
    assertEqual('forward-slash-normalization', nestedManifest.entries[0].path, 'a/b/file.txt');
    if (nestedManifest.entries[0].path.includes('\\')) throw new Error('DETERMINISTIC_MANIFEST_TEST_FAILED:backslash-leaked-into-path');

    // Case: two independent builds over identical content produce a byte-identical digest.
    fs.mkdirSync(path.join(scratchRoot, 'repro'));
    fs.writeFileSync(path.join(scratchRoot, 'repro', 'a.txt'), 'hello');
    fs.writeFileSync(path.join(scratchRoot, 'repro', 'b.txt'), 'world');
    const repro1 = await buildDeterministicManifest(path.join(scratchRoot, 'repro'), 'source-tree', []);
    const repro2 = await buildDeterministicManifest(path.join(scratchRoot, 'repro'), 'source-tree', []);
    assertEqual('reproducible-digest', repro1.manifestDigest, repro2.manifestDigest);
    if (!repro1.manifestDigest.startsWith('sha256:')) throw new Error('DETERMINISTIC_MANIFEST_TEST_FAILED:digest-missing-sha256-prefix');

    // Case: exclusions (.env, node_modules, dumps) are genuinely skipped, not just hidden from output.
    fs.mkdirSync(path.join(scratchRoot, 'excl', 'node_modules', 'somepkg'), { recursive: true });
    fs.writeFileSync(path.join(scratchRoot, 'excl', 'node_modules', 'somepkg', 'index.js'), 'module.exports = 1;');
    fs.writeFileSync(path.join(scratchRoot, 'excl', '.env'), 'SECRET=1');
    fs.writeFileSync(path.join(scratchRoot, 'excl', 'real.txt'), 'kept');
    const exclManifest = await buildDeterministicManifest(path.join(scratchRoot, 'excl'), 'source-tree', ['.env', 'node_modules']);
    assertEqual('exclusions-applied', exclManifest.entries.map(e => e.path), ['real.txt']);

    // Case: timestamps are never part of the digest -- touching a file's mtime without changing
    // content must not change the manifestDigest.
    fs.mkdirSync(path.join(scratchRoot, 'ts'));
    fs.writeFileSync(path.join(scratchRoot, 'ts', 'file.txt'), 'same content');
    const beforeTouch = await buildDeterministicManifest(path.join(scratchRoot, 'ts'), 'source-tree', []);
    const future = new Date(Date.now() + 60_000);
    fs.utimesSync(path.join(scratchRoot, 'ts', 'file.txt'), future, future);
    const afterTouch = await buildDeterministicManifest(path.join(scratchRoot, 'ts'), 'source-tree', []);
    assertEqual('timestamp-ignored', beforeTouch.manifestDigest, afterTouch.manifestDigest);

    // Case: a symlink escaping the manifest root must be rejected.
    fs.mkdirSync(path.join(scratchRoot, 'symlink-root'));
    fs.mkdirSync(path.join(scratchRoot, 'outside'));
    fs.writeFileSync(path.join(scratchRoot, 'outside', 'secret.txt'), 'outside content');
    try {
      fs.symlinkSync(path.join(scratchRoot, 'outside', 'secret.txt'), path.join(scratchRoot, 'symlink-root', 'escape.txt'));
      await expectRejects('symlink-escapes-root', () => buildDeterministicManifest(path.join(scratchRoot, 'symlink-root'), 'source-tree', []), 'DETERMINISTIC_MANIFEST_SYMLINK_ESCAPES_ROOT');
    } catch (symlinkError) {
      if (symlinkError instanceof Error && symlinkError.message.includes('DETERMINISTIC_MANIFEST')) throw symlinkError;
      console.log('  (skipped symlink-escape case -- creating symlinks requires elevated privileges on this OS)');
    }

    console.log('deterministic manifest builder tests passed');
  } finally {
    fs.rmSync(scratchRoot, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
