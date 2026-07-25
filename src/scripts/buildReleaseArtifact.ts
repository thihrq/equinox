// Release governance -- Task 5. Builds the immutable release artifact from the already-built
// backend/frontend and the Wave 3 validated package, runs the secret/personal-path gate, verifies
// it once, then rebuilds a second time to prove the build is genuinely reproducible.
import fs from 'fs';
import path from 'path';
import { buildReleaseArtifact } from '../services/release-governance/ReleaseArtifactBuilder';
import { verifyReleaseArtifact } from '../services/release-governance/ReleaseArtifactVerifier';
import { ReleaseIdentityEnvelope } from '../services/release-governance/ReleaseIdentity';
import { VALIDATED_PACKAGE_DIGEST } from '../config/releaseRegressionProfile';

// Stable, versioned, timestamp-free repository entry -- NOT an artifacts/ run directory. Replaces
// the previous hardcoded dependency on a historical Wave 3 evidence run directory, which only ever
// existed in the shared dev worktree and was never committed, making every release build silently
// dependent on a specific developer's local state. This default is a real, committed part of the
// repository (see VERSIONED-VALIDATED-PACKAGE-CORRECTION-010).
export const DEFAULT_VALIDATED_PACKAGE_DIR = 'data/competitive/validated-packages/active-v2';
export const VALIDATED_PACKAGE_MANIFEST_FILE = 'package-manifest.json';
export const EXPECTED_PACKAGE_ID = 'active-v2';

export interface VersionedValidatedPackageManifest {
  schemaVersion: string;
  packageId: string;
  packageDigest: string;
}

// Pure predicate version (no process.exitCode / throw side effects) for unit testing.
export function validateVersionedPackage(dir: string): { ok: true } | { ok: false; reasonCode: string; message: string } {
  if (!fs.existsSync(dir)) return { ok: false, reasonCode: 'VALIDATED_PACKAGE_NOT_FOUND', message: `VALIDATED_PACKAGE_NOT_FOUND: ${dir}` };
  const manifestPath = path.join(dir, VALIDATED_PACKAGE_MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) return { ok: false, reasonCode: 'VALIDATED_PACKAGE_MANIFEST_NOT_FOUND', message: `VALIDATED_PACKAGE_MANIFEST_NOT_FOUND: ${manifestPath}` };
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as VersionedValidatedPackageManifest;
  if (manifest.packageId !== EXPECTED_PACKAGE_ID) return { ok: false, reasonCode: 'VALIDATED_PACKAGE_ID_MISMATCH', message: `VALIDATED_PACKAGE_ID_MISMATCH: expected "${EXPECTED_PACKAGE_ID}", got "${manifest.packageId}"` };
  if (manifest.packageDigest !== VALIDATED_PACKAGE_DIGEST) return { ok: false, reasonCode: 'VALIDATED_PACKAGE_DIGEST_MISMATCH', message: `VALIDATED_PACKAGE_DIGEST_MISMATCH: expected "${VALIDATED_PACKAGE_DIGEST}", got "${manifest.packageDigest}"` };
  return { ok: true };
}

// Fails BEFORE any copy happens -- identity (packageId) and integrity (packageDigest) are both
// checked against the versioned manifest, never against file-layout assumptions.
function assertValidatedPackage(dir: string): void {
  const result = validateVersionedPackage(dir);
  if (!result.ok) fail(result.message, 13);
}

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function fail(message: string, code: number): never { console.error(message); process.exitCode = code; throw new Error(message); }
function writeAtomic(file: string, value: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, value, 'utf8');
  try { fs.renameSync(temporary, file); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EPERM') { console.error(`ARTIFACT_ATOMIC_RENAME_BLOCKED:${file}`); fs.copyFileSync(temporary, file); fs.unlinkSync(temporary); return; }
    throw error;
  }
}

async function main(): Promise<void> {
  const allowed = new Set(['--release-candidate-id', '--validated-package-dir']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const releaseCandidateId = arg('--release-candidate-id');
  if (!releaseCandidateId) fail('--release-candidate-id is required', 2);
  // The versioned default is the normal path. An override requires an explicit, non-empty
  // argument -- there is no environment variable that can silently redirect this.
  const validatedPackageDirArg = arg('--validated-package-dir');
  if (validatedPackageDirArg !== undefined && !validatedPackageDirArg.trim()) fail('VALIDATED_PACKAGE_OVERRIDE_INVALID', 2);

  const rcDir = path.resolve(`artifacts/release-governance/${releaseCandidateId}`);
  const identityPath = path.join(rcDir, 'digests', 'release-identity.json');
  if (!fs.existsSync(identityPath)) fail(`Missing release identity -- run sets:release:identity first: ${identityPath}`, 12);
  const identityEnvelope = JSON.parse(fs.readFileSync(identityPath, 'utf8')) as ReleaseIdentityEnvelope;

  const worktreeRoot = process.cwd();
  const backendBuildDir = path.join(worktreeRoot, 'dist');
  const frontendDistDir = path.join(worktreeRoot, 'frontend', 'dist');
  const validatedPackageDir = path.resolve(validatedPackageDirArg ?? DEFAULT_VALIDATED_PACKAGE_DIR);
  assertValidatedPackage(validatedPackageDir);
  for (const [label, dir] of [['backend', backendBuildDir], ['frontend', frontendDistDir]] as const) if (!fs.existsSync(dir)) fail(`Missing ${label} build output: ${dir} -- run sets:release:identity first`, 12);

  const metadata = {
    releaseIdentity: identityEnvelope,
    buildInformation: { releaseCandidateId, baseCommit: identityEnvelope.baseCommit, generatedAt: new Date().toISOString(), backendBuildDigest: identityEnvelope.backendBuildDigest, frontendDistributionDigest: identityEnvelope.frontendDistributionDigest },
    validatedPackageProvenance: { packageSource: 'versioned-validated-package' as const, packageId: EXPECTED_PACKAGE_ID, packageDigest: VALIDATED_PACKAGE_DIGEST, historicalArtifactConsumed: false },
  };

  const artifactIdentity = {
    releaseCandidateId,
    head: identityEnvelope.baseCommit,
    baseCommit: identityEnvelope.baseCommit,
    sourceTreeDigest: identityEnvelope.sourceTreeDigest,
    backendBuildDigest: identityEnvelope.backendBuildDigest,
    frontendBuildDigest: identityEnvelope.frontendDistributionDigest,
    validatedPackageDigest: VALIDATED_PACKAGE_DIGEST,
  };

  const artifactDir1 = path.join(rcDir, 'builds', 'release-artifact');
  console.log('Building release artifact (attempt 1)...');
  const build1 = await buildReleaseArtifact({ artifactDir: artifactDir1, backendBuildDir, frontendDistDir, validatedPackageDir, metadata, identity: artifactIdentity });
  if (build1.secretCount > 0) fail(`RELEASE_ARTIFACT_SECRET_DETECTED: ${build1.secretCount} finding(s): ${JSON.stringify(build1.secretFindings)}`, 40);
  if (build1.personalPathCount > 0) fail(`RELEASE_ARTIFACT_PERSONAL_PATH_DETECTED: ${build1.personalPathCount} finding(s): ${JSON.stringify(build1.personalPathFindings)}`, 40);

  console.log('Verifying artifact (fresh recompute)...');
  const verification1 = await verifyReleaseArtifact(artifactDir1);
  if (!verification1.digestMatch) fail(`RELEASE_ARTIFACT_VERIFY_FAILED: contentMatch=${verification1.contentDigestMatch} envelopeMatch=${verification1.envelopeDigestMatch} digestFileMatch=${verification1.digestFileMatch}`, 40);

  console.log('Building release artifact again (attempt 2, reproducibility check)...');
  const artifactDir2 = path.join(rcDir, 'builds', 'release-artifact-reproducibility-check');
  const build2 = await buildReleaseArtifact({ artifactDir: artifactDir2, backendBuildDir, frontendDistDir, validatedPackageDir, metadata, identity: artifactIdentity });
  // Both attempts share one metadata object, so an identical tree must produce an identical
  // envelope digest. Across DIFFERENT candidates the envelope digest is expected to differ.
  const reproducibleBuild = build1.releaseEnvelopeDigest === build2.releaseEnvelopeDigest && build1.contentDigest === build2.contentDigest;
  fs.rmSync(artifactDir2, { recursive: true, force: true }); // second build was only to prove reproducibility, not a second real artifact

  // Update the release identity envelope with the real artifact digest now that it exists.
  const updatedIdentity: ReleaseIdentityEnvelope = { ...identityEnvelope, releaseArtifactDigest: build1.releaseEnvelopeDigest };
  writeAtomic(identityPath, `${JSON.stringify(updatedIdentity, null, 2)}\n`);

  const verificationReportDir = path.join(rcDir, 'verification');
  writeAtomic(path.join(verificationReportDir, 'artifact-verification.json'), `${JSON.stringify({
    releaseCandidateId, schemaVersion: verification1.schemaVersion, contentDigest: build1.contentDigest, releaseEnvelopeDigest: build1.releaseEnvelopeDigest, reproducibleBuild, verificationDigestMatch: verification1.digestMatch,
    contentDigestMatch: verification1.contentDigestMatch, envelopeDigestMatch: verification1.envelopeDigestMatch, digestFileMatch: verification1.digestFileMatch,
    stableContentEntryCount: build1.manifestV2.entryClassification.stableContentEntryCount, releaseEnvelopeEntryCount: build1.manifestV2.entryClassification.releaseEnvelopeEntryCount, byteIdenticalReleaseArtifactClaimed: false,
    artifactSecretCount: build1.secretCount, artifactPersonalPathCount: build1.personalPathCount,
    packageDigestMatch: true, entryCount: build1.manifest.entries.length,
    packageSource: 'versioned-validated-package', packageId: EXPECTED_PACKAGE_ID, packageDigest: VALIDATED_PACKAGE_DIGEST, historicalArtifactConsumed: false,
  }, null, 2)}\n`);

  const valid = reproducibleBuild && verification1.digestMatch && build1.secretCount === 0 && build1.personalPathCount === 0;
  console.log(JSON.stringify({
    valid, releaseCandidateId, schemaVersion: '2.0.0', contentDigest: build1.contentDigest, releaseEnvelopeDigest: build1.releaseEnvelopeDigest, byteIdenticalReleaseArtifactClaimed: false, reproducibleBuild, artifactSecretCount: build1.secretCount, artifactPersonalPathCount: build1.personalPathCount, entryCount: build1.manifest.entries.length,
    packageSource: 'versioned-validated-package', packageId: EXPECTED_PACKAGE_ID, packageDigest: VALIDATED_PACKAGE_DIGEST, historicalArtifactConsumed: false,
    mongoReads: 0, mongoWrites: 0, networkReads: 0, productionWrites: 0,
  }));
  if (!valid) process.exitCode = 20;
}

if (require.main === module) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); if (process.exitCode === undefined) process.exitCode = 25; });
}
