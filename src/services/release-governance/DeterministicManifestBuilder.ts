// Release governance -- Task 3. Builds a deterministic manifest (sorted, path-normalized,
// timestamp-free file listing + per-file and aggregate sha256) over a directory tree. Two
// independent runs over identical content MUST produce byte-identical manifestDigest -- this is
// the property the whole release-identity/reproducible-build chain depends on.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface ManifestEntry {
  path: string;
  size: number;
  sha256: string;
}

export interface DeterministicManifest {
  schemaVersion: '1.0.0';
  rootType: 'source-tree' | 'backend-build' | 'frontend-dist' | 'release-artifact';
  entries: ManifestEntry[];
  manifestDigest: string;
}

const DEFAULT_EXCLUSIONS = ['.env', 'node_modules', '.git', '.DS_Store'];

function normalizePath(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}

function isExcluded(normalizedRelativePath: string, exclusions: string[]): boolean {
  const segments = normalizedRelativePath.split('/');
  return exclusions.some(pattern => segments.includes(pattern) || normalizedRelativePath === pattern || normalizedRelativePath.startsWith(`${pattern}/`));
}

function collectFiles(root: string, exclusions: string[]): string[] {
  const result: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      const relativePath = normalizePath(path.relative(root, fullPath));
      if (isExcluded(relativePath, exclusions)) continue;
      if (entry.isSymbolicLink()) {
        // Reject symlinks pointing outside the manifest root -- an in-root symlink pointing to
        // another in-root file is fine (it resolves within the same tree), but anything escaping
        // root would let the manifest silently include content outside what it claims to cover.
        const resolved = fs.realpathSync(fullPath);
        const resolvedRelative = path.relative(root, resolved);
        if (resolvedRelative.startsWith('..') || path.isAbsolute(resolvedRelative)) throw new Error(`DETERMINISTIC_MANIFEST_SYMLINK_ESCAPES_ROOT: ${relativePath}`);
        continue; // in-root symlinks are not separately content-hashed; their target is already covered
      }
      if (entry.isDirectory()) { stack.push(fullPath); continue; }
      if (entry.isFile()) result.push(fullPath);
    }
  }
  return result;
}

function fileSha256(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export async function buildDeterministicManifest(root: string, rootType: DeterministicManifest['rootType'], exclusions: string[] = DEFAULT_EXCLUSIONS): Promise<DeterministicManifest> {
  const absoluteRoot = path.resolve(root);
  const files = collectFiles(absoluteRoot, exclusions);

  const entries: ManifestEntry[] = files.map(filePath => {
    const relativePath = normalizePath(path.relative(absoluteRoot, filePath));
    if (path.isAbsolute(relativePath)) throw new Error(`DETERMINISTIC_MANIFEST_ABSOLUTE_PATH_REJECTED: ${relativePath}`);
    const stat = fs.statSync(filePath);
    return { path: relativePath, size: stat.size, sha256: fileSha256(filePath) };
  }).sort((a, b) => a.path.localeCompare(b.path));

  // Canonical digest lines: "<sha256>  <normalized-path>\n" (two spaces, matching the sha256sum
  // convention), concatenated over lexicographically-sorted entries -- no timestamps, no absolute
  // paths, no platform-specific separators anywhere in the digested content.
  const canonicalLines = entries.map(e => `${e.sha256}  ${e.path}\n`).join('');
  const manifestDigest = `sha256:${crypto.createHash('sha256').update(canonicalLines).digest('hex')}`;

  return { schemaVersion: '1.0.0', rootType, entries, manifestDigest };
}
