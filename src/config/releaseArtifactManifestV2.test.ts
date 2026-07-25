// RELEASE-ARTIFACT-DIGEST-CONTRACT-011. Proves the v2 schema gate is fail-closed: 1.x, missing and
// unknown versions are all rejected before any digest is looked at, and no manifest may claim
// byte-identical release artifacts.
import {
  SUPPORTED_RELEASE_ARTIFACT_SCHEMA_VERSIONS,
  TREE_DIGEST_EXCLUSIONS,
  assertSupportedReleaseArtifactSchemaVersion,
  assertReleaseArtifactManifestV2Structure,
  describeSchemaVersionRejection,
  ReleaseArtifactManifestV2,
} from './releaseArtifactManifestV2';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertThrowsWith(fn: () => unknown, expected: string, context: string): void {
  try {
    fn();
  } catch (error) {
    const actual = error instanceof Error ? error.message : String(error);
    assert(actual.startsWith(expected), `${context}: expected message starting with "${expected}", got "${actual}"`);
    return;
  }
  throw new Error(`${context}: expected throw of "${expected}", but nothing was thrown.`);
}

const digest = (seed: string): string => `sha256:${seed.repeat(64).slice(0, 64)}`;

function validManifest(): ReleaseArtifactManifestV2 {
  return {
    schemaVersion: '2.0.0',
    releaseCandidateId: 'release-rc-test',
    generatedAt: '2026-07-24T00:00:00.000Z',
    commit: { head: '3eb27c2aec0966825d4a4dd8fc3f414caed11281' },
    digests: {
      contentDigest: digest('a'), releaseEnvelopeDigest: digest('b'), sourceTreeDigest: digest('c'),
      backendBuildDigest: digest('d'), frontendBuildDigest: digest('e'), validatedPackageDigest: digest('f'),
    },
    digestSemantics: {
      contentDigest: { algorithm: 'sha256', source: 'deterministic-manifest-partition', includes: 'stable-content', excludes: 'release-envelope' },
      releaseEnvelopeDigest: { algorithm: 'sha256', source: 'complete-release-tree', includes: 'all-release-artifact-entries', uniquePerReleaseCandidate: true },
    },
    reproducibility: {
      deterministicContentClaimed: true, byteIdenticalReleaseArtifactClaimed: false, releaseEnvelopeUniqueByDesign: true,
      variableFields: ['releaseCandidateId', 'generatedAt'],
      variableEntries: ['metadata/build-information.json', 'metadata/release-identity.json'],
    },
    entryClassification: { stableContentEntryCount: 5, releaseEnvelopeEntryCount: 2, unclassifiedEntryCount: 0 },
    treeDigestExclusions: [],
    entries: [],
  };
}

// -------- supported version --------
assert(SUPPORTED_RELEASE_ARTIFACT_SCHEMA_VERSIONS.length === 1 && SUPPORTED_RELEASE_ARTIFACT_SCHEMA_VERSIONS[0] === '2.0.0', 'exactly 2.0.0 is supported.');
assertSupportedReleaseArtifactSchemaVersion('2.0.0'); // must not throw

// -------- rejected versions (no backward compatibility) --------
for (const rejected of ['1.0.0', '1.5.2', '3.0.0', '2.0', '', 'v2.0.0']) {
  assertThrowsWith(() => assertSupportedReleaseArtifactSchemaVersion(rejected),
    'RELEASE_ARTIFACT_SCHEMA_VERSION_UNSUPPORTED', `schema "${rejected}" must be rejected`);
}
for (const rejected of [undefined, null, 2, {}]) {
  assertThrowsWith(() => assertSupportedReleaseArtifactSchemaVersion(rejected),
    'RELEASE_ARTIFACT_SCHEMA_VERSION_UNSUPPORTED', `non-string schema ${JSON.stringify(rejected)} must be rejected`);
}

// -------- the rejection is machine-readable --------
{
  const rejection = describeSchemaVersionRejection('1.0.0');
  assert(rejection.reasonCode === 'RELEASE_ARTIFACT_SCHEMA_VERSION_UNSUPPORTED', 'reason code is reported.');
  assert(rejection.observedSchemaVersion === '1.0.0', 'the observed version is reported.');
  assert(JSON.stringify(rejection.supportedSchemaVersions) === '["2.0.0"]', 'the supported set is reported.');
  assert(describeSchemaVersionRejection(undefined).observedSchemaVersion === null, 'an absent version is reported as null, not invented.');
}

// -------- tree digest exclusions are empty by construction --------
assert(TREE_DIGEST_EXCLUSIONS.length === 0, 'the manifest and digest file are siblings of release/, not children -- nothing needs excluding.');

// -------- structure --------
assertReleaseArtifactManifestV2Structure(validManifest()); // must not throw

assertThrowsWith(() => assertReleaseArtifactManifestV2Structure({ ...validManifest(), releaseCandidateId: '' }),
  'RELEASE_ARTIFACT_MANIFEST_STRUCTURE_INVALID', 'a missing releaseCandidateId must be rejected');
assertThrowsWith(() => assertReleaseArtifactManifestV2Structure({ ...validManifest(), commit: { head: '' } }),
  'RELEASE_ARTIFACT_MANIFEST_STRUCTURE_INVALID', 'a missing commit.head must be rejected');

for (const field of ['contentDigest', 'releaseEnvelopeDigest', 'sourceTreeDigest', 'backendBuildDigest', 'frontendBuildDigest', 'validatedPackageDigest']) {
  const manifest = validManifest();
  (manifest.digests as unknown as Record<string, string>)[field] = 'not-a-digest';
  assertThrowsWith(() => assertReleaseArtifactManifestV2Structure(manifest),
    'RELEASE_ARTIFACT_MANIFEST_STRUCTURE_INVALID', `a malformed digests.${field} must be rejected`);
}

// The single most important structural rule: the artifact may never claim byte-identical trees.
{
  const manifest = validManifest();
  (manifest.reproducibility as unknown as Record<string, unknown>).byteIdenticalReleaseArtifactClaimed = true;
  assertThrowsWith(() => assertReleaseArtifactManifestV2Structure(manifest),
    'RELEASE_ARTIFACT_MANIFEST_STRUCTURE_INVALID', 'claiming byte-identical release artifacts must be rejected');
}
{
  const manifest = validManifest();
  (manifest.entryClassification as unknown as Record<string, unknown>).unclassifiedEntryCount = 1;
  assertThrowsWith(() => assertReleaseArtifactManifestV2Structure(manifest),
    'RELEASE_ARTIFACT_MANIFEST_STRUCTURE_INVALID', 'a manifest admitting unclassified entries must be rejected');
}

console.log('[Equinox] releaseArtifactManifestV2 test passed.');
