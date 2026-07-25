import crypto from 'crypto';

export type ReleaseArtifactEntryClass =
  | 'stable-content'
  | 'release-envelope';

export interface ReleaseArtifactManifestV2 {
  schemaVersion: '2.0.0';
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
    variableFields: ['releaseCandidateId', 'generatedAt'];
    variableEntries: string[];
  };
  entryClassification: {
    stableContentEntryCount: number;
    releaseEnvelopeEntryCount: number;
    unclassifiedEntryCount: 0;
  };
  treeDigestExclusions?: string[];
  entries?: Array<{ path: string; sha256: string; classification?: ReleaseArtifactEntryClass }>;
}

export const RELEASE_METADATA_CLASSIFICATION: Record<string, ReleaseArtifactEntryClass> = {
  'metadata/build-information.json': 'release-envelope',
  'metadata/release-identity.json': 'release-envelope',
  'metadata/license-inventory.json': 'stable-content',
  'metadata/runtime-configuration-schema.json': 'stable-content',
} as const;

export function classifyReleaseEntry(relativePath: string): ReleaseArtifactEntryClass {
  const normalized = relativePath.replace(/\\/g, '/');

  if (normalized.startsWith('backend/') || normalized.startsWith('frontend/') || normalized.startsWith('validated-package/')) {
    return 'stable-content';
  }

  if (normalized.startsWith('metadata/')) {
    const classification = RELEASE_METADATA_CLASSIFICATION[normalized];
    if (!classification) {
      throw new Error(`RELEASE_ARTIFACT_METADATA_CLASSIFICATION_REQUIRED: Unclassified metadata file '${normalized}'`);
    }
    return classification;
  }

  throw new Error(`RELEASE_ARTIFACT_ENTRY_CLASSIFICATION_REQUIRED: Top-level entry '${normalized}' requires explicit classification policy`);
}

export function classifyReleaseArtifactEntry(relativePath: string): { classification: ReleaseArtifactEntryClass } {
  return { classification: classifyReleaseEntry(relativePath) };
}

export function canonicalEntriesDigest(entries: Array<{ path: string; sha256: string }>): string {
  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path));
  const content = sorted.map(e => `${e.path}:${e.sha256}`).join('\n');
  return `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
}

export function partitionReleaseManifestEntries<T extends { path: string }>(entries: T[]): {
  stableContentEntries: T[];
  releaseEnvelopeEntries: T[];
} {
  const stableContentEntries: T[] = [];
  const releaseEnvelopeEntries: T[] = [];

  for (const entry of entries) {
    const cls = classifyReleaseEntry(entry.path);
    if (cls === 'stable-content') {
      stableContentEntries.push(entry);
    } else {
      releaseEnvelopeEntries.push(entry);
    }
  }

  return { stableContentEntries, releaseEnvelopeEntries };
}
