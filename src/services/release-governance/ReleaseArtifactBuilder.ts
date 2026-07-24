// Release governance -- Task 5. Assembles the immutable release artifact directory: backend build,
// frontend dist, the Wave 3 validated package, and manifests/metadata -- explicitly EXCLUDING
// secrets, node_modules, Mongo dumps, git internals, and personal paths. Pure filesystem
// composition; never touches Mongo/network/production.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { buildDeterministicManifest, DeterministicManifest } from './DeterministicManifestBuilder';
import { detectSecrets } from './ReleaseIdentity';

export interface ReleaseArtifactBuildResult {
  artifactDir: string;
  manifest: DeterministicManifest;
  artifactDigest: string;
  secretCount: number;
  personalPathCount: number;
  secretFindings: Array<{ file: string; labels: string[] }>;
  personalPathFindings: string[];
}

// A "personal path" here means a Windows user-profile path leaking into shipped artifact content
// (e.g. an absolute path like C:\Users\<name>\... embedded in a build output or metadata file) --
// not the build machine's OWN path used internally, which never leaves this function's scope.
// Matches both a raw single-backslash Windows path (e.g. leaked verbatim into a log/stack trace)
// and a JS/JSON-source double-escaped form (e.g. "C:\\Users\\name\\..." as written in a .js/.json
// file), plus Unix-style /Users/<name>/ and /home/<name>/ home directories. The Unix branches use
// a negative lookbehind requiring the leading "/" is not itself preceded by a path/word character
// -- otherwise a URL path segment like ".../sprites/home/normal/..." (a real, legitimate string in
// this frontend's Pokemon sprite URLs) false-positives as a Unix home directory.
const PERSONAL_PATH_PATTERN = /[A-Za-z]:\\{1,2}Users\\{1,2}[^\\/"']+\\{1,2}|(?<![a-zA-Z0-9_/])\/Users\/[^/"']+\/|(?<![a-zA-Z0-9_/])\/home\/[^/"']+\//;

// The compiled release-governance detector files themselves (ReleaseArtifactBuilder.js,
// ReleaseIdentity.js) necessarily contain the literal pattern strings/comments they use to detect
// secrets and personal paths (e.g. the comment text "/Users/<name>/" describing what the regex
// matches) -- scanning them against their own patterns self-triggers on that description text, not
// a real leak. Excluded from the scan for that reason, not to weaken detection elsewhere.
const SCAN_SELF_EXCLUSIONS = new Set(['services/release-governance/ReleaseArtifactBuilder.js', 'services/release-governance/ReleaseIdentity.js']);

function collectTextFileContents(root: string): Array<{ file: string; content: string }> {
  const result: Array<{ file: string; content: string }> = [];
  const stack: string[] = [root];
  const SIZE_CAP_BYTES = 2 * 1024 * 1024;
  const BINARY_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot']);
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) { stack.push(fullPath); continue; }
      if (!entry.isFile()) continue;
      if (BINARY_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      const relative = path.relative(root, fullPath).split(path.sep).join('/');
      if ([...SCAN_SELF_EXCLUSIONS].some(excluded => relative.endsWith(excluded))) continue;
      const stat = fs.statSync(fullPath);
      if (stat.size > SIZE_CAP_BYTES) continue;
      try { result.push({ file: path.relative(root, fullPath), content: fs.readFileSync(fullPath, 'utf8') }); } catch { /* not text -- skip */ }
    }
  }
  return result;
}

export async function buildReleaseArtifact(input: {
  artifactDir: string;
  backendBuildDir: string;
  frontendDistDir: string;
  validatedPackageDir: string;
  metadata: Record<string, unknown>;
}): Promise<ReleaseArtifactBuildResult> {
  const { artifactDir, backendBuildDir, frontendDistDir, validatedPackageDir, metadata } = input;

  fs.rmSync(artifactDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(artifactDir, 'release', 'backend'), { recursive: true });
  fs.mkdirSync(path.join(artifactDir, 'release', 'frontend'), { recursive: true });
  fs.mkdirSync(path.join(artifactDir, 'release', 'validated-package'), { recursive: true });
  fs.mkdirSync(path.join(artifactDir, 'release', 'manifests'), { recursive: true });
  fs.mkdirSync(path.join(artifactDir, 'release', 'metadata'), { recursive: true });

  // Test files (*.test.js, compiled from *.test.ts) have no business shipping in a production
  // backend bundle -- they're dev-time-only, several contain deliberate fake-secret fixtures to
  // exercise detectSecrets() itself, and shipping them just bloats the artifact for no benefit.
  fs.cpSync(backendBuildDir, path.join(artifactDir, 'release', 'backend'), { recursive: true, filter: (source) => !source.endsWith('.test.js') });
  fs.cpSync(frontendDistDir, path.join(artifactDir, 'release', 'frontend'), { recursive: true });
  fs.cpSync(validatedPackageDir, path.join(artifactDir, 'release', 'validated-package'), { recursive: true });

  fs.writeFileSync(path.join(artifactDir, 'release', 'metadata', 'release-identity.json'), `${JSON.stringify(metadata.releaseIdentity ?? {}, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(artifactDir, 'release', 'metadata', 'runtime-configuration-schema.json'), `${JSON.stringify(metadata.runtimeConfigurationSchema ?? { note: 'no runtime secrets included -- this documents the SHAPE of expected env vars, never real values' }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(artifactDir, 'release', 'metadata', 'license-inventory.json'), `${JSON.stringify(metadata.licenseInventory ?? { note: 'populated from package.json dependency licenses' }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(artifactDir, 'release', 'metadata', 'build-information.json'), `${JSON.stringify(metadata.buildInformation ?? {}, null, 2)}\n`, 'utf8');

  // Secret + personal-path scan over everything that was just packaged -- fail closed rather than
  // ship an artifact with either.
  const textFiles = collectTextFileContents(path.join(artifactDir, 'release'));
  const secretFindings: Array<{ file: string; labels: string[] }> = [];
  const personalPathFindings: string[] = [];
  for (const { file, content } of textFiles) {
    const secrets = detectSecrets(content);
    if (secrets.length > 0) secretFindings.push({ file, labels: secrets });
    if (PERSONAL_PATH_PATTERN.test(content)) personalPathFindings.push(file);
  }

  const manifest = await buildDeterministicManifest(path.join(artifactDir, 'release'), 'release-artifact');
  const artifactDigest = manifest.manifestDigest;
  fs.writeFileSync(path.join(artifactDir, 'release-artifact-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(artifactDir, 'release-artifact-digest.txt'), `${artifactDigest}\n`, 'utf8');

  return { artifactDir, manifest, artifactDigest, secretCount: secretFindings.length, personalPathCount: personalPathFindings.length, secretFindings, personalPathFindings };
}

const digestString = (value: string): string => `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
export { digestString };
