// Release governance -- identity of a frozen release candidate. A "freeze" is a point-in-time,
// read-only snapshot of the worktree's git state (status/diff/untracked files) plus a secret scan
// gate -- it never mutates the worktree.
export interface FrozenReleaseCandidate {
  releaseCandidateId: string;
  createdAt: string;

  baseCommit: string;
  branch: string;
  worktreeRoot: string;

  gitStatusDigest: string;
  patchDigest: string;
  // Deliberately named differently from ReleaseIdentityEnvelope.sourceTreeDigest below: this is a
  // coarse hash of the sorted TRACKED FILE NAME LIST ONLY (freeze-time bookkeeping, computed
  // before any build exists), not a content-hash manifest over src/. Peer review (Ciclo A) flagged
  // the original shared field name "sourceTreeDigest" across both interfaces as a real footgun --
  // same name, very different rigor, in the same pipeline. The real, full-content source tree
  // digest used for release identity is ReleaseIdentityEnvelope.sourceTreeDigest, computed by
  // DeterministicManifestBuilder in generateReleaseIdentity.ts (Task 4), not here.
  trackedFileListDigest: string;

  validatedPackageDigest: string;

  secretScanPassed: boolean;
  frozen: boolean;
}

export interface FreezeEvidenceFileDigest {
  file: string;
  sha256: string;
}

// Secret patterns checked against git diff/untracked file content before a freeze is allowed to
// complete. Deliberately conservative (real credential shapes, not "any long hex string") to avoid
// false-positive blocking on legitimate sha256 digests, which are all over this codebase's
// artifacts.
const LOCALHOST_MONGO_PATTERN = /mongodb(\+srv)?:\/\/[^:\s/]+:[^@\s/]+@(127\.0\.0\.1|localhost|0\.0\.0\.0)(:\d+)?\//;
const SECRET_PATTERNS: Array<{ label: string; pattern: RegExp; excludePattern?: RegExp }> = [
  { label: 'aws-access-key-id', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: 'private-key-block', pattern: /-----BEGIN (RSA |EC |OPENSSH |DSA |)PRIVATE KEY-----/ },
  // Credentials embedded in a real remote MongoDB URI are a genuine leak; the same shape pointed
  // at 127.0.0.1/localhost/0.0.0.0 is a local dev/test fixture (this codebase's own CLI
  // exit-code test scripts use exactly this pattern deliberately, e.g.
  // "mongodb://user:super-secret@127.0.0.1:1/..." with a port chosen to guarantee failure) and is
  // not flagged.
  { label: 'mongodb-connection-string-with-credentials', pattern: /mongodb(\+srv)?:\/\/[^:\s/]+:[^@\s/]+@/, excludePattern: LOCALHOST_MONGO_PATTERN },
  { label: 'generic-api-key-assignment', pattern: /\b(api[_-]?key|apikey|secret[_-]?key|access[_-]?token)\s*[:=]\s*["'][A-Za-z0-9_\-./+=]{16,}["']/i },
  { label: 'slack-token', pattern: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { label: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
];

export function detectSecrets(content: string): string[] {
  const found: string[] = [];
  for (const { label, pattern, excludePattern } of SECRET_PATTERNS) {
    if (!pattern.test(content)) continue;
    if (excludePattern && excludePattern.test(content)) continue;
    found.push(label);
  }
  return found;
}

export function assertWorktreeRoot(actualRoot: string, requiredSuffix: string): void {
  const normalized = actualRoot.replace(/\\/g, '/');
  const requiredNormalized = requiredSuffix.replace(/\\/g, '/');
  if (!normalized.endsWith(requiredNormalized)) throw new Error(`RELEASE_FREEZE_WRONG_WORKTREE: expected root ending in "${requiredNormalized}", got "${normalized}"`);
}

// Full digest identity of a release candidate (Task 4). releaseArtifactDigest is populated by
// buildReleaseArtifact.ts (Task 5), which runs after this envelope is first generated -- it is
// optional here and required once the artifact has actually been built.
const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;

export interface ReleaseIdentityEnvelope {
  releaseCandidateId: string;
  baseCommit: string;
  worktreePatchDigest: string;
  sourceTreeDigest: string;
  backendBuildDigest: string;
  frontendDistributionDigest: string;
  releaseArtifactDigest: string | null;
  validatedPackageDigest: string;
  wave8DryRunEvidenceDigest: string;
  generatedAt: string;
}

export function assertValidDigestFields(envelope: ReleaseIdentityEnvelope): void {
  const required: Array<[string, string]> = [
    ['worktreePatchDigest', envelope.worktreePatchDigest],
    ['sourceTreeDigest', envelope.sourceTreeDigest],
    ['backendBuildDigest', envelope.backendBuildDigest],
    ['frontendDistributionDigest', envelope.frontendDistributionDigest],
    ['validatedPackageDigest', envelope.validatedPackageDigest],
    ['wave8DryRunEvidenceDigest', envelope.wave8DryRunEvidenceDigest],
  ];
  for (const [field, value] of required) if (!SHA256_DIGEST_PATTERN.test(value)) throw new Error(`RELEASE_IDENTITY_INVALID_DIGEST_FORMAT: ${field}="${value}" does not match ^sha256:[a-f0-9]{64}$`);
  if (envelope.releaseArtifactDigest !== null && !SHA256_DIGEST_PATTERN.test(envelope.releaseArtifactDigest)) throw new Error(`RELEASE_IDENTITY_INVALID_DIGEST_FORMAT: releaseArtifactDigest="${envelope.releaseArtifactDigest}" does not match ^sha256:[a-f0-9]{64}$`);
}
