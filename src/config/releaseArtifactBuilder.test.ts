import fs from 'fs';
import path from 'path';
import os from 'os';
import { buildReleaseArtifact } from '../services/release-governance/ReleaseArtifactBuilder';
import { verifyReleaseArtifact } from '../services/release-governance/ReleaseArtifactVerifier';

const digestFixture = (seed: string): string => `sha256:${seed.repeat(64).slice(0, 64)}`;
const identityFixture = {
  releaseCandidateId: 'release-rc-test', head: 'a'.repeat(40),
  sourceTreeDigest: digestFixture('1'), backendBuildDigest: digestFixture('2'),
  frontendBuildDigest: digestFixture('3'), validatedPackageDigest: digestFixture('4'),
};

function assertEqual(label: string, actual: unknown, expected: unknown): void { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`RELEASE_ARTIFACT_TEST_FAILED:${label} -- expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }

async function main(): Promise<void> {
  const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'graphify-release-artifact-test-'));
  try {
    const backendDir = path.join(scratchRoot, 'fake-backend');
    const frontendDir = path.join(scratchRoot, 'fake-frontend');
    const packageDir = path.join(scratchRoot, 'fake-validated-package');
    fs.mkdirSync(backendDir, { recursive: true });
    fs.mkdirSync(frontendDir, { recursive: true });
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(path.join(backendDir, 'server.js'), 'console.log("backend");');
    fs.writeFileSync(path.join(frontendDir, 'index.html'), '<html></html>');
    fs.writeFileSync(path.join(packageDir, 'entries.json'), '{"entries":[]}');

    // Case: a clean build includes the backend/frontend/package content.
    const artifactDir = path.join(scratchRoot, 'artifact-1');
    const build = await buildReleaseArtifact({ artifactDir, backendBuildDir: backendDir, frontendDistDir: frontendDir, validatedPackageDir: packageDir, metadata: {}, identity: identityFixture });
    assertEqual('backend-included', fs.existsSync(path.join(artifactDir, 'release', 'backend', 'server.js')), true);
    assertEqual('frontend-included', fs.existsSync(path.join(artifactDir, 'release', 'frontend', 'index.html')), true);
    assertEqual('package-included', fs.existsSync(path.join(artifactDir, 'release', 'validated-package', 'entries.json')), true);
    assertEqual('metadata-directory-present', fs.existsSync(path.join(artifactDir, 'release', 'metadata', 'release-identity.json')), true);
    assertEqual('no-secrets-in-clean-fixture', build.secretCount, 0);
    assertEqual('no-personal-paths-in-clean-fixture', build.personalPathCount, 0);
    if (!build.releaseEnvelopeDigest.startsWith('sha256:')) throw new Error('RELEASE_ARTIFACT_TEST_FAILED:envelope-digest-missing-prefix');
    if (!build.contentDigest.startsWith('sha256:')) throw new Error('RELEASE_ARTIFACT_TEST_FAILED:content-digest-missing-prefix');
    assertEqual('schema-is-v2', build.manifestV2.schemaVersion, '2.0.0');
    assertEqual('never-claims-byte-identical', build.manifestV2.reproducibility.byteIdenticalReleaseArtifactClaimed, false);
    assertEqual('no-unclassified-entries', build.manifestV2.entryClassification.unclassifiedEntryCount, 0);
    assertEqual('digest-file-holds-envelope', fs.readFileSync(path.join(artifactDir, 'release-artifact-digest.txt'), 'utf8').trim(), build.releaseEnvelopeDigest);

    // Case: rebuilding a second time from identical source content reproduces the same digest.
    const artifactDir2 = path.join(scratchRoot, 'artifact-2');
    const build2 = await buildReleaseArtifact({ artifactDir: artifactDir2, backendBuildDir: backendDir, frontendDistDir: frontendDir, validatedPackageDir: packageDir, metadata: {}, identity: identityFixture });
    assertEqual('reproducible-envelope', build.releaseEnvelopeDigest, build2.releaseEnvelopeDigest);
    assertEqual('reproducible-content', build.contentDigest, build2.contentDigest);

    // Case: verifier confirms a freshly-built artifact matches its own recorded digest.
    const verification = await verifyReleaseArtifact(artifactDir);
    assertEqual('verifier-confirms-match', verification.digestMatch, true);
    assertEqual('verifier-content-match', verification.contentDigestMatch, true);
    assertEqual('verifier-envelope-match', verification.envelopeDigestMatch, true);
    assertEqual('verifier-digest-file-match', verification.digestFileMatch, true);
    assertEqual('verifier-entry-counts-match', verification.recordedEntryCount, verification.recomputedEntryCount);

    // Case: a secret embedded in a backend file must be caught and reported (not silently packaged).
    const dirtyBackendDir = path.join(scratchRoot, 'dirty-backend');
    fs.mkdirSync(dirtyBackendDir, { recursive: true });
    const keyName = ['api', 'key'].join('_');
    const keyValue = ['sk_live', '12345678901234567890'].join('_');
    fs.writeFileSync(path.join(dirtyBackendDir, 'config.js'), `const ${keyName} = "${keyValue}";`);
    const dirtyArtifactDir = path.join(scratchRoot, 'dirty-artifact');
    const dirtyBuild = await buildReleaseArtifact({ artifactDir: dirtyArtifactDir, backendBuildDir: dirtyBackendDir, frontendDistDir: frontendDir, validatedPackageDir: packageDir, metadata: {}, identity: identityFixture });
    if (dirtyBuild.secretCount === 0) throw new Error('RELEASE_ARTIFACT_TEST_FAILED:secret-not-detected-in-dirty-fixture');

    // Case: a URL path segment that happens to contain "/home/" (e.g. a real sprite URL like
    // ".../sprites/home/normal/25.png") must NOT be flagged as a Unix personal home directory.
    const urlFalsePositiveBackendDir = path.join(scratchRoot, 'url-false-positive-backend');
    fs.mkdirSync(urlFalsePositiveBackendDir, { recursive: true });
    fs.writeFileSync(path.join(urlFalsePositiveBackendDir, 'sprites.js'), '`https://img.pokemondb.net/sprites/home/normal/25.png`');
    const urlFalsePositiveArtifactDir = path.join(scratchRoot, 'url-false-positive-artifact');
    const urlFalsePositiveBuild = await buildReleaseArtifact({ artifactDir: urlFalsePositiveArtifactDir, backendBuildDir: urlFalsePositiveBackendDir, frontendDistDir: frontendDir, validatedPackageDir: packageDir, metadata: {}, identity: identityFixture });
    if (urlFalsePositiveBuild.personalPathCount !== 0) throw new Error('RELEASE_ARTIFACT_TEST_FAILED:url-path-false-positive-flagged-as-personal-path');

    // Case: a personal Windows user path embedded in a file must be caught.
    const personalPathBackendDir = path.join(scratchRoot, 'personal-path-backend');
    fs.mkdirSync(personalPathBackendDir, { recursive: true });
    fs.writeFileSync(path.join(personalPathBackendDir, 'log.js'), 'console.log("C:\\\\Users\\\\someone\\\\project\\\\file.ts");');
    const personalPathArtifactDir = path.join(scratchRoot, 'personal-path-artifact');
    const personalPathBuild = await buildReleaseArtifact({ artifactDir: personalPathArtifactDir, backendBuildDir: personalPathBackendDir, frontendDistDir: frontendDir, validatedPackageDir: packageDir, metadata: {}, identity: identityFixture });
    if (personalPathBuild.personalPathCount === 0) throw new Error('RELEASE_ARTIFACT_TEST_FAILED:personal-path-not-detected');

    // Case: a tampered artifact (post-build edit) must fail verification.
    fs.writeFileSync(path.join(artifactDir2, 'release', 'backend', 'server.js'), 'console.log("TAMPERED");');
    const tamperedVerification = await verifyReleaseArtifact(artifactDir2);
    assertEqual('tampered-artifact-fails-verification', tamperedVerification.digestMatch, false);
    // Tampering with real content must move BOTH digests -- a valid envelope must never excuse
    // broken content, nor the reverse.
    assertEqual('tampered-content-digest-fails', tamperedVerification.contentDigestMatch, false);
    assertEqual('tampered-envelope-digest-fails', tamperedVerification.envelopeDigestMatch, false);

    // Case: the standalone digest file alone being edited must be caught.
    const digestFileTamperDir = path.join(scratchRoot, 'digest-file-tamper');
    await buildReleaseArtifact({ artifactDir: digestFileTamperDir, backendBuildDir: backendDir, frontendDistDir: frontendDir, validatedPackageDir: packageDir, metadata: {}, identity: identityFixture });
    fs.writeFileSync(path.join(digestFileTamperDir, 'release-artifact-digest.txt'), `sha256:${'0'.repeat(64)}\n`);
    const digestFileTampered = await verifyReleaseArtifact(digestFileTamperDir);
    assertEqual('digest-file-tamper-detected', digestFileTampered.digestFileMatch, false);
    assertEqual('digest-file-tamper-fails-overall', digestFileTampered.digestMatch, false);
    assertEqual('digest-file-tamper-leaves-content-intact', digestFileTampered.contentDigestMatch, true);

    // Case: post-build contamination under release/ must be rejected, not absorbed.
    const contaminatedDir = path.join(scratchRoot, 'contaminated-artifact');
    await buildReleaseArtifact({ artifactDir: contaminatedDir, backendBuildDir: backendDir, frontendDistDir: frontendDir, validatedPackageDir: packageDir, metadata: {}, identity: identityFixture });
    fs.mkdirSync(path.join(contaminatedDir, 'release', 'artifacts'), { recursive: true });
    fs.writeFileSync(path.join(contaminatedDir, 'release', 'artifacts', 'unexpected.json'), '{}');
    let contaminationRejected = false;
    try { await verifyReleaseArtifact(contaminatedDir); } catch (error) {
      contaminationRejected = error instanceof Error && error.message.startsWith('RELEASE_ARTIFACT_ENTRY_CLASSIFICATION_REQUIRED');
    }
    assertEqual('post-build-contamination-rejected', contaminationRejected, true);

    console.log('release artifact builder + verifier tests passed');
  } finally {
    fs.rmSync(scratchRoot, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
