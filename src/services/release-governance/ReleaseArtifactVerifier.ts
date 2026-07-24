// Release governance -- read-only re-verification of an already-built release artifact.
//
// Two independent checks, neither able to stand in for the other: the ENVELOPE digest proves this
// specific artifact has not been altered since it was sealed, and the CONTENT digest proves the
// deterministic part still matches what the manifest claims. A valid envelope cannot excuse a
// broken content digest, and vice versa -- so both are recomputed and both are reported.
import fs from 'fs';
import path from 'path';
import { buildDeterministicManifest } from './DeterministicManifestBuilder';
import { canonicalEntriesDigest, partitionReleaseManifestEntries } from '../../config/releaseArtifactEntryClassification';
import { assertReleaseArtifactManifestV2Structure, assertSupportedReleaseArtifactSchemaVersion, ReleaseArtifactManifestV2 } from '../../config/releaseArtifactManifestV2';

export interface ReleaseArtifactVerification {
  artifactDir: string;
  schemaVersion: string;
  recordedContentDigest: string;
  recomputedContentDigest: string;
  contentDigestMatch: boolean;
  recordedEnvelopeDigest: string;
  recomputedEnvelopeDigest: string;
  envelopeDigestMatch: boolean;
  digestFileMatch: boolean;
  recordedEntryCount: number;
  recomputedEntryCount: number;
  /** True only when every independent check above passed. */
  digestMatch: boolean;
}

export async function verifyReleaseArtifact(artifactDir: string): Promise<ReleaseArtifactVerification> {
  // 1. required external files
  const manifestPath = path.join(artifactDir, 'release-artifact-manifest.json');
  const digestPath = path.join(artifactDir, 'release-artifact-digest.txt');
  if (!fs.existsSync(manifestPath) || !fs.existsSync(digestPath)) {
    throw new Error(`RELEASE_ARTIFACT_VERIFY_MISSING_EVIDENCE: expected both ${manifestPath} and ${digestPath}`);
  }
  const rawManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { schemaVersion?: unknown };

  // 2. schema version -- fails before any digest is looked at, so a manifest this build cannot
  //    interpret is never "checked anyway" against assumptions that may not hold for it.
  assertSupportedReleaseArtifactSchemaVersion(rawManifest.schemaVersion);

  // 3. structure
  assertReleaseArtifactManifestV2Structure(rawManifest);
  const manifest = rawManifest as ReleaseArtifactManifestV2;

  // 4. recompute the tree, which also detects post-seal contamination: any file added under
  //    release/ after sealing either fails classification (5) or changes the envelope digest (7).
  const recomputed = await buildDeterministicManifest(path.join(artifactDir, 'release'), 'release-artifact');

  // 5. classification completeness -- throws on an entry the policy does not cover.
  const partition = partitionReleaseManifestEntries(recomputed.entries);

  // 6/7. recompute both digests independently.
  const recomputedContentDigest = canonicalEntriesDigest(partition.stableContentEntries);
  const recomputedEnvelopeDigest = canonicalEntriesDigest(recomputed.entries);

  // 8. the standalone digest file must agree with the manifest's envelope digest.
  const digestFileValue = fs.readFileSync(digestPath, 'utf8').trim();

  const contentDigestMatch = manifest.digests.contentDigest === recomputedContentDigest;
  const envelopeDigestMatch = manifest.digests.releaseEnvelopeDigest === recomputedEnvelopeDigest;
  const digestFileMatch = digestFileValue === manifest.digests.releaseEnvelopeDigest;

  return {
    artifactDir,
    schemaVersion: manifest.schemaVersion,
    recordedContentDigest: manifest.digests.contentDigest,
    recomputedContentDigest,
    contentDigestMatch,
    recordedEnvelopeDigest: manifest.digests.releaseEnvelopeDigest,
    recomputedEnvelopeDigest,
    envelopeDigestMatch,
    digestFileMatch,
    recordedEntryCount: manifest.entries.length,
    recomputedEntryCount: recomputed.entries.length,
    digestMatch: contentDigestMatch && envelopeDigestMatch && digestFileMatch,
  };
}

/** Throws with the specific reason code for whichever independent check failed first. */
export function assertReleaseArtifactVerified(verification: ReleaseArtifactVerification): void {
  if (!verification.contentDigestMatch) {
    throw new Error(`RELEASE_ARTIFACT_CONTENT_DIGEST_MISMATCH: recorded=${verification.recordedContentDigest} recomputed=${verification.recomputedContentDigest}`);
  }
  if (!verification.envelopeDigestMatch) {
    throw new Error(`RELEASE_ARTIFACT_ENVELOPE_DIGEST_MISMATCH: recorded=${verification.recordedEnvelopeDigest} recomputed=${verification.recomputedEnvelopeDigest}`);
  }
  if (!verification.digestFileMatch) {
    throw new Error(`RELEASE_ARTIFACT_DIGEST_FILE_MISMATCH: release-artifact-digest.txt disagrees with the manifest envelope digest`);
  }
}
