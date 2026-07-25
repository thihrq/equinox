import { detectSecrets, assertWorktreeRoot, assertValidDigestFields, ReleaseIdentityEnvelope } from '../services/release-governance/ReleaseIdentity';

function expectThrows(label: string, fn: () => void, messageIncludes: string): void {
  let threw = false;
  try { fn(); } catch (error) { threw = error instanceof Error && error.message.includes(messageIncludes); }
  if (!threw) throw new Error(`RELEASE_IDENTITY_GUARD_NOT_CAUGHT:${label}`);
}
function assertEqual(label: string, actual: unknown, expected: unknown): void { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`RELEASE_IDENTITY_TEST_FAILED:${label} -- expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }

// Case: freezing in the wrong worktree must be rejected, not silently proceed against whatever
// directory happens to be current.
expectThrows('wrong-worktree-rejected', () => assertWorktreeRoot('C:\\Users\\tiigo\\OneDrive\\Documentos\\equinox\\equinox', '.worktrees/competitive-data-v2-clean'), 'RELEASE_FREEZE_WRONG_WORKTREE');

// Case: the correct worktree (backslash form, as Windows reports it) must pass.
assertWorktreeRoot('C:\\Users\\tiigo\\OneDrive\\Documentos\\equinox\\equinox\\.worktrees\\competitive-data-v2-clean', '.worktrees/competitive-data-v2-clean');

// Case: a real sha256 digest string (this codebase's artifacts are full of these) must NOT be
// flagged as a secret -- false positives here would block every legitimate freeze.
assertEqual('sha256-digest-not-flagged', detectSecrets('packageDigest: sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665'), []);

// Case: a genuine AWS access key must be flagged.
assertEqual('aws-key-flagged', detectSecrets('AWS_ACCESS_KEY_ID=AKIAABCDEFGHIJKLMNOP'), ['aws-access-key-id']);

// Case: a private key block must be flagged.
assertEqual('private-key-flagged', detectSecrets('-----BEGIN RSA PRIVATE KEY-----\nMIIEow...'), ['private-key-block']);

// Case: a MongoDB URI with embedded credentials must be flagged.
assertEqual('mongo-uri-with-creds-flagged', detectSecrets('mongodb+srv://dbuser:S3cr3tPass@cluster0.mongodb.net/prod'), ['mongodb-connection-string-with-credentials']);

// Case: a MongoDB URI WITHOUT credentials must NOT be flagged (common in this codebase's docs/config).
assertEqual('mongo-uri-without-creds-not-flagged', detectSecrets('mongodb://localhost:27017/pokemon-builder'), []);

// Case: a generic api key assignment must be flagged.
const testKeyAssignment = ['const api', '_key = "sk_live_', '12345678901234567890";'].join('');
assertEqual('generic-api-key-flagged', detectSecrets(testKeyAssignment), ['generic-api-key-assignment']);

// Case: a valid full envelope (all real 64-hex sha256 digests) must pass.
const validEnvelope: ReleaseIdentityEnvelope = {
  releaseCandidateId: 'release-rc-test', baseCommit: 'e9abeb5',
  worktreePatchDigest: 'sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665',
  sourceTreeDigest: 'sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665',
  backendBuildDigest: 'sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665',
  frontendDistributionDigest: 'sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665',
  releaseArtifactDigest: null,
  validatedPackageDigest: 'sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665',
  wave8DryRunEvidenceDigest: 'sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665',
  generatedAt: new Date().toISOString(),
};
assertValidDigestFields(validEnvelope);

// Case: a single-hash-only digest (e.g. one frontend file's hash mistaken for the whole
// distribution) must be rejected -- it won't match the sha256:<64hex> format anyway if it's just
// a bare hash, but more importantly this guards the format contract itself.
expectThrows('missing-sha256-prefix-rejected', () => assertValidDigestFields({ ...validEnvelope, frontendDistributionDigest: '797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665' }), 'RELEASE_IDENTITY_INVALID_DIGEST_FORMAT');

// Case: a too-short hex string must be rejected.
expectThrows('short-digest-rejected', () => assertValidDigestFields({ ...validEnvelope, backendBuildDigest: 'sha256:abc123' }), 'RELEASE_IDENTITY_INVALID_DIGEST_FORMAT');

console.log('release identity freeze-guard tests passed');
