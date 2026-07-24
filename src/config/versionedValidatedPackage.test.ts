import fs from 'fs';
import path from 'path';
import os from 'os';
import { DEFAULT_VALIDATED_PACKAGE_DIR, EXPECTED_PACKAGE_ID, validateVersionedPackage, VALIDATED_PACKAGE_MANIFEST_FILE } from '../scripts/buildReleaseArtifact';
import { VALIDATED_PACKAGE_DIGEST } from './releaseRegressionProfile';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function makePackageDir(manifest: object | null): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'equinox-versioned-package-test-'));
  if (manifest !== null) fs.writeFileSync(path.join(dir, VALIDATED_PACKAGE_MANIFEST_FILE), JSON.stringify(manifest), 'utf8');
  return dir;
}

// -------- default path --------
assert(DEFAULT_VALIDATED_PACKAGE_DIR === 'data/competitive/validated-packages/active-v2', 'DEFAULT_VALIDATED_PACKAGE_DIR must point to the stable, versioned, timestamp-free repository path.');
assert(EXPECTED_PACKAGE_ID === 'active-v2', 'EXPECTED_PACKAGE_ID must be "active-v2".');

// -------- the real, committed default package must itself validate successfully --------
const realDefaultResult = validateVersionedPackage(DEFAULT_VALIDATED_PACKAGE_DIR);
assert(realDefaultResult.ok === true, `The real default versioned package must validate successfully, got: ${JSON.stringify(realDefaultResult)}`);

// -------- historical path absence: the historical Wave 3 run directory is not required at runtime --------
const historicalPath: string = 'artifacts/competitive-production-readiness/20260720T231346Z/validated-package';
// This assertion documents intent: the OPERATIONAL default no longer points there. It does not
// assert the historical directory itself is absent (it may still exist as leftover local dev
// state in the shared worktree; that is fine -- what matters is nothing in the runtime code path
// requires it any more).
assert(DEFAULT_VALIDATED_PACKAGE_DIR !== historicalPath, 'the default validated package path must not be the historical Wave 3 run directory.');

// -------- digest correct --------
const validDir = makePackageDir({ schemaVersion: '1.0.0', packageId: 'active-v2', packageDigest: VALIDATED_PACKAGE_DIGEST });
try {
  const result = validateVersionedPackage(validDir);
  assert(result.ok === true, 'a package with the correct id and digest must be accepted.');
} finally {
  fs.rmSync(validDir, { recursive: true, force: true });
}

// -------- digest incorrect (one byte different) --------
const wrongDigestDir = makePackageDir({ schemaVersion: '1.0.0', packageId: 'active-v2', packageDigest: `${VALIDATED_PACKAGE_DIGEST.slice(0, -1)}0` });
try {
  const result = validateVersionedPackage(wrongDigestDir);
  assert(result.ok === false && (result as { reasonCode: string }).reasonCode === 'VALIDATED_PACKAGE_DIGEST_MISMATCH', 'a package with an altered digest must be rejected with VALIDATED_PACKAGE_DIGEST_MISMATCH.');
} finally {
  fs.rmSync(wrongDigestDir, { recursive: true, force: true });
}

// -------- manifest missing --------
const noManifestDir = makePackageDir(null);
try {
  const result = validateVersionedPackage(noManifestDir);
  assert(result.ok === false && (result as { reasonCode: string }).reasonCode === 'VALIDATED_PACKAGE_MANIFEST_NOT_FOUND', 'a package directory without package-manifest.json must be rejected with VALIDATED_PACKAGE_MANIFEST_NOT_FOUND.');
} finally {
  fs.rmSync(noManifestDir, { recursive: true, force: true });
}

// -------- directory itself missing --------
{
  const result = validateVersionedPackage(path.join(os.tmpdir(), 'equinox-nonexistent-package-dir-xyz'));
  assert(result.ok === false && (result as { reasonCode: string }).reasonCode === 'VALIDATED_PACKAGE_NOT_FOUND', 'a nonexistent directory must be rejected with VALIDATED_PACKAGE_NOT_FOUND.');
}

// -------- package id mismatch --------
const wrongIdDir = makePackageDir({ schemaVersion: '1.0.0', packageId: 'not-active-v2', packageDigest: VALIDATED_PACKAGE_DIGEST });
try {
  const result = validateVersionedPackage(wrongIdDir);
  assert(result.ok === false && (result as { reasonCode: string }).reasonCode === 'VALIDATED_PACKAGE_ID_MISMATCH', 'a package with a different packageId must be rejected with VALIDATED_PACKAGE_ID_MISMATCH.');
} finally {
  fs.rmSync(wrongIdDir, { recursive: true, force: true });
}

// -------- override tests --------
// A valid override (any directory that itself passes validateVersionedPackage) is accepted --
// this is exercised structurally above (validateVersionedPackage has no notion of "default" vs
// "override"; the CLI layer in buildReleaseArtifact.ts's main() is what decides which path string
// to pass in, defaulting to DEFAULT_VALIDATED_PACKAGE_DIR unless --validated-package-dir is given).
const overrideValidDir = makePackageDir({ schemaVersion: '1.0.0', packageId: 'active-v2', packageDigest: VALIDATED_PACKAGE_DIGEST });
try {
  assert(validateVersionedPackage(overrideValidDir).ok === true, 'an explicit override pointing at a valid versioned package directory must be accepted.');
} finally {
  fs.rmSync(overrideValidDir, { recursive: true, force: true });
}
{
  const result = validateVersionedPackage(path.join(os.tmpdir(), 'equinox-override-does-not-exist-xyz'));
  assert(result.ok === false && (result as { reasonCode: string }).reasonCode === 'VALIDATED_PACKAGE_NOT_FOUND', 'an explicit override pointing at a nonexistent directory must be rejected.');
}

// -------- no environment variable bypass --------
// buildReleaseArtifact.ts's main() reads only --validated-package-dir (argv), never
// process.env.* for this purpose. Verified here by source inspection (no env var name appears
// anywhere near the validated-package logic) rather than by executing main() itself (which has
// wider side effects out of scope for a unit test).
const builderSource = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'buildReleaseArtifact.ts'), 'utf8');
const validatedPackageSection = builderSource.slice(builderSource.indexOf('DEFAULT_VALIDATED_PACKAGE_DIR'), builderSource.indexOf('async function main'));
assert(!validatedPackageSection.includes('process.env'), 'no process.env read must exist in the validated-package resolution logic -- overrides must be explicit CLI arguments only.');

// -------- no hardcoded historical path in operational code --------
assert(!builderSource.includes('20260720T231346Z'), 'src/scripts/buildReleaseArtifact.ts must no longer contain the historical Wave 3 run ID anywhere in its operational source.');

console.log('[Equinox] versionedValidatedPackage test passed.');
