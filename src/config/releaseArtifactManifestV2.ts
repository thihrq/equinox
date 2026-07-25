// Release governance -- the v2 release artifact manifest contract.
//
// v2 exists to make one distinction explicit inside the artifact itself, instead of leaving it to
// external evidence: `contentDigest` is what two builds of the same commit must agree on, and
// `releaseEnvelopeDigest` is the identity of one specific release candidate and is unique by
// design. Conflating them previously invited the false claim that two candidates should be
// byte-identical.
//
// There is deliberately no v1 compatibility path. Reading a 1.x manifest through v2 semantics
// would mean interpreting a single ambiguous digest as though it carried the guarantees of the two
// distinct ones -- exactly the ambiguity this schema exists to remove.
import { ReleaseArtifactEntryClass } from './releaseArtifactEntryClassification';

export const SUPPORTED_RELEASE_ARTIFACT_SCHEMA_VERSIONS = ['2.0.0'] as const;
export type SupportedReleaseArtifactSchemaVersion = typeof SUPPORTED_RELEASE_ARTIFACT_SCHEMA_VERSIONS[number];

/**
 * Files written outside the digested `release/` tree and therefore never part of it. This is empty
 * by construction, not by filtering: `release-artifact-manifest.json` and
 * `release-artifact-digest.txt` are siblings of `release/`, not children, so the manifest never has
 * to exclude itself and no self-reference is possible.
 */
export const TREE_DIGEST_EXCLUSIONS: readonly string[] = [];

export interface ReleaseArtifactManifestV2 {
  schemaVersion: SupportedReleaseArtifactSchemaVersion;
  releaseCandidateId: string;
  generatedAt: string;
  commit: {
    head: string;
    baseCommit?: string;
  };
  digests: {
    contentDigest: string;
    releaseEnvelopeDigest: string;
    sourceTreeDigest: string;
    backendBuildDigest: string;
    frontendBuildDigest: string;
    validatedPackageDigest: string;
  };
  digestSemantics: {
    contentDigest: {
      algorithm: 'sha256';
      source: 'deterministic-manifest-partition';
      includes: 'stable-content';
      excludes: 'release-envelope';
    };
    releaseEnvelopeDigest: {
      algorithm: 'sha256';
      source: 'complete-release-tree';
      includes: 'all-release-artifact-entries';
      uniquePerReleaseCandidate: true;
    };
  };
  reproducibility: {
    deterministicContentClaimed: true;
    byteIdenticalReleaseArtifactClaimed: false;
    releaseEnvelopeUniqueByDesign: true;
    variableFields: string[];
    variableEntries: string[];
  };
  entryClassification: {
    stableContentEntryCount: number;
    releaseEnvelopeEntryCount: number;
    unclassifiedEntryCount: 0;
  };
  treeDigestExclusions: readonly string[];
  entries: Array<{ path: string; size: number; sha256: string; classification: ReleaseArtifactEntryClass }>;
}

export interface SchemaVersionRejection {
  reasonCode: 'RELEASE_ARTIFACT_SCHEMA_VERSION_UNSUPPORTED';
  supportedSchemaVersions: string[];
  observedSchemaVersion: string | null;
}

export function describeSchemaVersionRejection(observed: unknown): SchemaVersionRejection {
  return {
    reasonCode: 'RELEASE_ARTIFACT_SCHEMA_VERSION_UNSUPPORTED',
    supportedSchemaVersions: [...SUPPORTED_RELEASE_ARTIFACT_SCHEMA_VERSIONS],
    observedSchemaVersion: typeof observed === 'string' ? observed : null,
  };
}

/**
 * Fails before any digest work. A manifest whose version this build cannot interpret must not have
 * its digests "checked anyway" -- the fields would not mean what the checker assumes.
 */
export function assertSupportedReleaseArtifactSchemaVersion(observed: unknown): void {
  if (typeof observed !== 'string' || !(SUPPORTED_RELEASE_ARTIFACT_SCHEMA_VERSIONS as readonly string[]).includes(observed)) {
    const rejection = describeSchemaVersionRejection(observed);
    throw new Error(`RELEASE_ARTIFACT_SCHEMA_VERSION_UNSUPPORTED: ${JSON.stringify({ observedSchemaVersion: rejection.observedSchemaVersion, supportedSchemaVersions: rejection.supportedSchemaVersions })}`);
  }
}

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;

export function assertReleaseArtifactManifestV2Structure(manifest: unknown): asserts manifest is ReleaseArtifactManifestV2 {
  const invalid = (detail: string): never => { throw new Error(`RELEASE_ARTIFACT_MANIFEST_STRUCTURE_INVALID: ${detail}`); };
  if (typeof manifest !== 'object' || manifest === null) invalid('manifest is not an object');
  const candidate = manifest as Partial<ReleaseArtifactManifestV2>;

  if (!candidate.releaseCandidateId?.trim()) invalid('releaseCandidateId is missing');
  if (!candidate.generatedAt?.trim()) invalid('generatedAt is missing');
  if (!candidate.commit?.head?.trim()) invalid('commit.head is missing');

  const digests = candidate.digests;
  if (!digests) invalid('digests block is missing');
  for (const field of ['contentDigest', 'releaseEnvelopeDigest', 'sourceTreeDigest', 'backendBuildDigest', 'frontendBuildDigest', 'validatedPackageDigest'] as const) {
    const value = digests![field];
    if (typeof value !== 'string' || !SHA256_DIGEST_PATTERN.test(value)) invalid(`digests.${field} is missing or not a sha256:<64 hex> digest`);
  }

  if (candidate.reproducibility?.byteIdenticalReleaseArtifactClaimed !== false) invalid('reproducibility.byteIdenticalReleaseArtifactClaimed must be literally false -- this artifact never claims byte-identical release trees across candidates');
  if (candidate.reproducibility?.deterministicContentClaimed !== true) invalid('reproducibility.deterministicContentClaimed must be true');
  if (candidate.reproducibility?.releaseEnvelopeUniqueByDesign !== true) invalid('reproducibility.releaseEnvelopeUniqueByDesign must be true');

  if (candidate.entryClassification?.unclassifiedEntryCount !== 0) invalid('entryClassification.unclassifiedEntryCount must be 0');
  if (typeof candidate.entryClassification?.stableContentEntryCount !== 'number') invalid('entryClassification.stableContentEntryCount is missing');
  if (typeof candidate.entryClassification?.releaseEnvelopeEntryCount !== 'number') invalid('entryClassification.releaseEnvelopeEntryCount is missing');
  if (!Array.isArray(candidate.entries)) invalid('entries array is missing');
}
