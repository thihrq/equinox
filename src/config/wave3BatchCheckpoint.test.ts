import { decideBatchResume, BatchCheckpoint, BatchDigests } from '../services/competitive-data/expert/wave3/BatchCheckpoint';

function fail(label: string): never { throw new Error(`WAVE3_BATCH_CHECKPOINT_TEST_FAILED:${label}`); }
function assertEqual(label: string, actual: unknown, expected: unknown): void { if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${label} -- expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }

const current: BatchDigests = { packageDigest: 'sha256:pkg', policyVersion: 'v1', targetCatalogDigest: 'sha256:cat', inputDigest: 'sha256:in' };
const completedCheckpoint: BatchCheckpoint = { batchId: 'wave3-batch-000', attemptCount: 1, status: 'completed', artifactDigest: 'sha256:art', candidateCount: 40, ...current };

// Case 1: no checkpoint at all -- fresh restart, not an error.
assertEqual('no-checkpoint', decideBatchResume({ checkpoint: null, checkpointParseError: false, current, artifactsPresent: false, currentArtifactDigest: null, maxRetryAttempts: 3 }), { action: 'process-fresh', reasonCode: 'RESUME_RESTART_REQUIRED', nextAttemptCount: 1 });

// Case 2: corrupt/unparseable checkpoint file -- must not silently trust it.
assertEqual('checkpoint-parse-error', decideBatchResume({ checkpoint: null, checkpointParseError: true, current, artifactsPresent: true, currentArtifactDigest: 'sha256:art', maxRetryAttempts: 3 }), { action: 'process-fresh', reasonCode: 'RESUME_CHECKPOINT_INVALID', nextAttemptCount: 1 });

// Case 3: genuinely complete batch, all digests match, artifact present and matches -- must skip, not reprocess.
assertEqual('already-complete-skip', decideBatchResume({ checkpoint: completedCheckpoint, checkpointParseError: false, current, artifactsPresent: true, currentArtifactDigest: 'sha256:art', maxRetryAttempts: 3 }), { action: 'skip-already-complete', reasonCode: 'RESUME_BATCH_ALREADY_COMPLETE', nextAttemptCount: 1 });

// Case 4: completed checkpoint but the input actually changed (e.g. roster/package edited since) -- must invalidate and create a new attempt, never silently skip a genuinely-changed batch.
assertEqual('input-digest-mismatch-reprocess', decideBatchResume({ checkpoint: completedCheckpoint, checkpointParseError: false, current: { ...current, inputDigest: 'sha256:different' }, artifactsPresent: true, currentArtifactDigest: 'sha256:art', maxRetryAttempts: 3 }), { action: 'process-fresh', reasonCode: 'RESUME_INPUT_DIGEST_MISMATCH', nextAttemptCount: 2 });

// Case 5: policy version drift must also invalidate (not just input).
assertEqual('policy-version-mismatch-reprocess', decideBatchResume({ checkpoint: completedCheckpoint, checkpointParseError: false, current: { ...current, policyVersion: 'v2' }, artifactsPresent: true, currentArtifactDigest: 'sha256:art', maxRetryAttempts: 3 }), { action: 'process-fresh', reasonCode: 'RESUME_POLICY_VERSION_MISMATCH', nextAttemptCount: 2 });

// Case 6: target catalog drift must also invalidate.
assertEqual('target-catalog-mismatch-reprocess', decideBatchResume({ checkpoint: completedCheckpoint, checkpointParseError: false, current: { ...current, targetCatalogDigest: 'sha256:different' }, artifactsPresent: true, currentArtifactDigest: 'sha256:art', maxRetryAttempts: 3 }), { action: 'process-fresh', reasonCode: 'RESUME_TARGET_CATALOG_MISMATCH', nextAttemptCount: 2 });

// Case 7: package source drift must also invalidate.
assertEqual('source-digest-mismatch-reprocess', decideBatchResume({ checkpoint: completedCheckpoint, checkpointParseError: false, current: { ...current, packageDigest: 'sha256:different' }, artifactsPresent: true, currentArtifactDigest: 'sha256:art', maxRetryAttempts: 3 }), { action: 'process-fresh', reasonCode: 'RESUME_SOURCE_DIGEST_MISMATCH', nextAttemptCount: 2 });

// Case 8: checkpoint claims completed but the artifact file is actually missing on disk -- must not trust the checkpoint's word alone.
assertEqual('artifact-missing-reprocess', decideBatchResume({ checkpoint: completedCheckpoint, checkpointParseError: false, current, artifactsPresent: false, currentArtifactDigest: null, maxRetryAttempts: 3 }), { action: 'process-fresh', reasonCode: 'RESUME_ARTIFACT_MISSING', nextAttemptCount: 2 });

// Case 9: artifact present but tampered/corrupted (its digest no longer matches the checkpoint's recorded digest) -- must reprocess, not trust a mismatched artifact.
assertEqual('artifact-digest-mismatch-reprocess', decideBatchResume({ checkpoint: completedCheckpoint, checkpointParseError: false, current, artifactsPresent: true, currentArtifactDigest: 'sha256:tampered', maxRetryAttempts: 3 }), { action: 'process-fresh', reasonCode: 'RESUME_CHECKPOINT_INVALID', nextAttemptCount: 2 });

// Case 10: a genuinely incomplete/interrupted prior attempt (status 'running' or 'failed') with matching digests -- must resume, not restart from scratch and not skip.
const incompleteCheckpoint: BatchCheckpoint = { ...completedCheckpoint, status: 'failed', attemptCount: 1 };
assertEqual('incomplete-resume', decideBatchResume({ checkpoint: incompleteCheckpoint, checkpointParseError: false, current, artifactsPresent: false, currentArtifactDigest: null, maxRetryAttempts: 3 }), { action: 'process-retry', reasonCode: 'RESUME_BATCH_INCOMPLETE', nextAttemptCount: 2 });

// Case 11: retry must be bounded -- once attemptCount reaches maxRetryAttempts, stop retrying forever.
const exhaustedCheckpoint: BatchCheckpoint = { ...completedCheckpoint, status: 'failed', attemptCount: 3 };
assertEqual('retry-exhausted-blocked', decideBatchResume({ checkpoint: exhaustedCheckpoint, checkpointParseError: false, current, artifactsPresent: false, currentArtifactDigest: null, maxRetryAttempts: 3 }), { action: 'blocked-retry-exhausted', reasonCode: 'RESUME_BATCH_INCOMPLETE', nextAttemptCount: 3 });

console.log('wave3 batch checkpoint decision tests passed');
