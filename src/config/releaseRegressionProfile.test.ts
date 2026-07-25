import fs from 'fs';
import path from 'path';
import {
  assertFullPipelineSourcesPresent,
  assertValidProfile,
  buildRuntimeSafetyCapabilityManifest,
  buildRuntimeSafetyPackageCapability,
  FULL_COMPETITIVE_PIPELINE_SOURCES_NOT_AVAILABLE,
  FULL_PIPELINE_REQUIRED_SOURCES,
  fullPipelineSourcesPresent,
  RELEASE_REGRESSION_PROFILE_REQUIRED,
  VALIDATED_PACKAGE_DIGEST,
} from './releaseRegressionProfile';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
function assertThrows(fn: () => void, expectedMessage: string, label: string): void {
  try {
    fn();
  } catch (error) {
    assert(error instanceof Error && error.message === expectedMessage, `${label}: expected message "${expectedMessage}", got "${error instanceof Error ? error.message : error}"`);
    return;
  }
  throw new Error(`${label}: expected to throw "${expectedMessage}" but did not throw.`);
}

// Explicit profile selection is mandatory.
assertThrows(() => assertValidProfile(undefined), RELEASE_REGRESSION_PROFILE_REQUIRED, 'undefined profile must be rejected');
assertThrows(() => assertValidProfile('not-a-real-profile'), RELEASE_REGRESSION_PROFILE_REQUIRED, 'invalid profile string must be rejected');
assertValidProfile('runtime-safety');
assertValidProfile('full-competitive-pipeline');

// fullPipelineSourcesPresent(): in THIS worktree (as of the runtime-safety-only commit chain),
// the Wave 1-3 QA orchestrators are known NOT to be committed -- verified against a synthetic
// empty directory (never against the real, possibly-uncommitted-but-present-on-disk shared
// worktree, so this test result is stable regardless of what else is lying around locally).
const emptyDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'equinox-profile-test-'));
try {
  assert(fullPipelineSourcesPresent(emptyDir) === false, 'an empty directory must never report full pipeline sources as present.');
  assertThrows(() => assertFullPipelineSourcesPresent(emptyDir), FULL_COMPETITIVE_PIPELINE_SOURCES_NOT_AVAILABLE, 'empty directory must block the full-competitive-pipeline profile');

  for (const relativePath of FULL_PIPELINE_REQUIRED_SOURCES) {
    fs.mkdirSync(path.join(emptyDir, path.dirname(relativePath)), { recursive: true });
    fs.writeFileSync(path.join(emptyDir, relativePath), '// stub\n', 'utf8');
  }
  assert(fullPipelineSourcesPresent(emptyDir) === true, 'once all three Wave QA sources exist, the closure must report present (even though this is only a shallow, level-0 check -- see dependency-closure evidence for the deeper levels this function intentionally does not attempt to verify).');
} finally {
  fs.rmSync(emptyDir, { recursive: true, force: true });
}

// Capability manifest: must not claim capabilities beyond what runtime-safety actually verifies.
const manifest = buildRuntimeSafetyCapabilityManifest();
assert(manifest.profile === 'runtime-safety', 'manifest profile must be runtime-safety.');
assert(manifest.capabilities.runtimeMongoOptional === true, 'runtime-safety must claim runtimeMongoOptional.');
assert(manifest.capabilities.syntheticFallbackFailClosed === true, 'runtime-safety must claim syntheticFallbackFailClosed.');
assert(manifest.capabilities.formatRegistryNormalization === true, 'runtime-safety must claim formatRegistryNormalization.');
assert(manifest.capabilities.localDevelopmentIsolation === true, 'runtime-safety must claim localDevelopmentIsolation.');
assert(manifest.capabilities.artifactSecretSanitization === true, 'runtime-safety must claim artifactSecretSanitization.');
assert(manifest.capabilities.wave1PipelineSources === false, 'runtime-safety must NOT claim wave1PipelineSources.');
assert(manifest.capabilities.wave2PipelineSources === false, 'runtime-safety must NOT claim wave2PipelineSources.');
assert(manifest.capabilities.wave3PipelineSources === false, 'runtime-safety must NOT claim wave3PipelineSources.');
assert(manifest.capabilities.competitivePackageRebuild === false, 'runtime-safety must NOT claim competitivePackageRebuild.');
assert(manifest.capabilities.historicalPipelineReplay === false, 'runtime-safety must NOT claim historicalPipelineReplay.');
assert(manifest.excludedCapabilities.length >= 5, 'every false capability above must be explained in excludedCapabilities.');
for (const excluded of manifest.excludedCapabilities) {
  assert(typeof excluded.reason === 'string' && excluded.reason.length > 0, `excludedCapabilities entry for ${excluded.capability} must have a non-empty reason.`);
}

// Package capability: runtime-safety verifies binding/integrity/runtime-load, never claims rebuild/replay.
const packageCapability = buildRuntimeSafetyPackageCapability(true, true, true);
assert(packageCapability.packageBindingVerified === true, 'package binding result must be passed through.');
assert(packageCapability.packageRebuiltFromSourcePipeline === false, 'runtime-safety package capability must never claim a rebuild from source.');
assert(packageCapability.fullPipelineReplayCompleted === false, 'runtime-safety package capability must never claim a full pipeline replay.');

// No hardcoded historical run IDs or release-candidate paths in this module's own source.
const ownSource = fs.readFileSync(__filename.replace(/\.test\.ts$/, '.ts'), 'utf8');
assert(!ownSource.includes('20260720T033504Z'), 'releaseRegressionProfile.ts must not contain the hardcoded historical Wave 1/2 mechanics run ID.');
assert(!ownSource.includes('release-rc-20260724T093857Z'), 'releaseRegressionProfile.ts must not reference a specific historical release candidate.');

assert(VALIDATED_PACKAGE_DIGEST.startsWith('sha256:'), 'VALIDATED_PACKAGE_DIGEST must be a well-formed sha256 digest string.');

console.log('[Equinox] releaseRegressionProfile test passed.');
