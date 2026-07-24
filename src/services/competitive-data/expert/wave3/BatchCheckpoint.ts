// Wave 3 -- pure resume/isolation decision logic for batch processing. Kept separate from the
// batch runner CLI/engine so the resume contract (digest checks, reason codes, bounded retry) can
// be unit-tested directly against BatchCheckpointDecision without running the real pipeline.
import { FullRosterExpansionPolicy } from './FullRosterExpansionPolicy';

export interface BatchDigests {
  packageDigest: string;
  policyVersion: string;
  targetCatalogDigest: string;
  inputDigest: string;
}

export interface BatchCheckpoint extends BatchDigests {
  batchId: string;
  attemptCount: number;
  status: 'completed' | 'failed' | 'running';
  artifactDigest: string;
  candidateCount: number;
}

export type ResumeReasonCode = FullRosterExpansionPolicy['resumePolicy']['reasonCodes'][number];

export interface BatchCheckpointDecision {
  action: 'skip-already-complete' | 'process-fresh' | 'process-retry' | 'blocked-retry-exhausted';
  reasonCode: ResumeReasonCode;
  nextAttemptCount: number;
}

export interface ResumeDecisionInput {
  checkpoint: BatchCheckpoint | null;
  checkpointParseError: boolean;
  current: BatchDigests;
  artifactsPresent: boolean;
  currentArtifactDigest: string | null;
  maxRetryAttempts: number;
}

/**
 * Pure decision function -- no I/O. Given a (possibly absent/corrupt) checkpoint and the real,
 * freshly-computed current digests/artifact state, decides whether to skip, (re)process fresh, or
 * report retry exhaustion. Every branch maps to exactly one of FullRosterExpansionPolicy's real
 * reasonCodes so the mapping stays enforced by assertFullRosterExpansionPolicyConsistency().
 */
export function decideBatchResume(input: ResumeDecisionInput): BatchCheckpointDecision {
  const { checkpoint, checkpointParseError, current, artifactsPresent, currentArtifactDigest, maxRetryAttempts } = input;

  if (checkpointParseError) return { action: 'process-fresh', reasonCode: 'RESUME_CHECKPOINT_INVALID', nextAttemptCount: 1 };
  if (!checkpoint) return { action: 'process-fresh', reasonCode: 'RESUME_RESTART_REQUIRED', nextAttemptCount: 1 };

  if (checkpoint.packageDigest !== current.packageDigest) return { action: 'process-fresh', reasonCode: 'RESUME_SOURCE_DIGEST_MISMATCH', nextAttemptCount: checkpoint.attemptCount + 1 };
  if (checkpoint.policyVersion !== current.policyVersion) return { action: 'process-fresh', reasonCode: 'RESUME_POLICY_VERSION_MISMATCH', nextAttemptCount: checkpoint.attemptCount + 1 };
  if (checkpoint.targetCatalogDigest !== current.targetCatalogDigest) return { action: 'process-fresh', reasonCode: 'RESUME_TARGET_CATALOG_MISMATCH', nextAttemptCount: checkpoint.attemptCount + 1 };
  if (checkpoint.inputDigest !== current.inputDigest) return { action: 'process-fresh', reasonCode: 'RESUME_INPUT_DIGEST_MISMATCH', nextAttemptCount: checkpoint.attemptCount + 1 };

  if (checkpoint.status === 'completed') {
    if (!artifactsPresent) return { action: 'process-fresh', reasonCode: 'RESUME_ARTIFACT_MISSING', nextAttemptCount: checkpoint.attemptCount + 1 };
    if (currentArtifactDigest !== checkpoint.artifactDigest) return { action: 'process-fresh', reasonCode: 'RESUME_CHECKPOINT_INVALID', nextAttemptCount: checkpoint.attemptCount + 1 };
    return { action: 'skip-already-complete', reasonCode: 'RESUME_BATCH_ALREADY_COMPLETE', nextAttemptCount: checkpoint.attemptCount };
  }

  // status is 'failed' or 'running' with matching digests -- a genuine incomplete/interrupted
  // attempt. Retry is bounded: never loop forever on a batch that keeps failing.
  if (checkpoint.attemptCount >= maxRetryAttempts) return { action: 'blocked-retry-exhausted', reasonCode: 'RESUME_BATCH_INCOMPLETE', nextAttemptCount: checkpoint.attemptCount };
  return { action: 'process-retry', reasonCode: 'RESUME_BATCH_INCOMPLETE', nextAttemptCount: checkpoint.attemptCount + 1 };
}
