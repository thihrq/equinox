// Release governance -- Task 5. Verifies a built release artifact by recomputing its deterministic
// manifest fresh and comparing against the digest recorded at build time. Read-only.
import fs from 'fs';
import path from 'path';
import { buildDeterministicManifest } from './DeterministicManifestBuilder';

export interface ReleaseArtifactVerification {
  artifactDir: string;
  recordedDigest: string;
  recomputedDigest: string;
  digestMatch: boolean;
  recordedEntryCount: number;
  recomputedEntryCount: number;
}

export async function verifyReleaseArtifact(artifactDir: string): Promise<ReleaseArtifactVerification> {
  const manifestPath = path.join(artifactDir, 'release-artifact-manifest.json');
  const digestPath = path.join(artifactDir, 'release-artifact-digest.txt');
  if (!fs.existsSync(manifestPath) || !fs.existsSync(digestPath)) throw new Error(`RELEASE_ARTIFACT_VERIFY_MISSING_EVIDENCE: expected both ${manifestPath} and ${digestPath}`);

  const recordedManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { manifestDigest: string; entries: unknown[] };
  const recordedDigest = fs.readFileSync(digestPath, 'utf8').trim();
  if (recordedManifest.manifestDigest !== recordedDigest) throw new Error(`RELEASE_ARTIFACT_VERIFY_INTERNAL_INCONSISTENCY: manifest file and digest file disagree (${recordedManifest.manifestDigest} vs ${recordedDigest})`);

  const recomputed = await buildDeterministicManifest(path.join(artifactDir, 'release'), 'release-artifact');

  return {
    artifactDir, recordedDigest, recomputedDigest: recomputed.manifestDigest,
    digestMatch: recordedDigest === recomputed.manifestDigest,
    recordedEntryCount: recordedManifest.entries.length, recomputedEntryCount: recomputed.entries.length,
  };
}
