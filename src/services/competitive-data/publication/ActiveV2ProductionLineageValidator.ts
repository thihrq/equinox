import { ACTIVE_V2_DATA_DIGEST_ALGORITHM, calculateCanonicalActiveV2DataDigest } from '../digest/ActiveV2CanonicalDataDigest';

/**
 * Valida a linhagem de digests, contagens e conformidade de portão contra o Acceptance Gate.
 */
export function validateLineageAndDigest(records: any[], acceptanceReport: any): void {
  if (!acceptanceReport) {
    throw new Error('LINEAGE_VALIDATION_FAILED: Missing acceptance report');
  }

  if (acceptanceReport.gateStatus !== 'approved') {
    throw new Error(`LINEAGE_VALIDATION_FAILED: Acceptance Gate status is not approved, got "${acceptanceReport.gateStatus}"`);
  }

  if (acceptanceReport.automaticRolloutApproved !== true) {
    throw new Error('LINEAGE_VALIDATION_FAILED: Automatic rollout is not approved');
  }

  if (acceptanceReport.activeV2DataDigestAlgorithm !== ACTIVE_V2_DATA_DIGEST_ALGORITHM) {
    throw new Error(`LINEAGE_VALIDATION_FAILED: Incompatible digest algorithm, expected "${ACTIVE_V2_DATA_DIGEST_ALGORITHM}", got "${acceptanceReport.activeV2DataDigestAlgorithm}"`);
  }

  if (!acceptanceReport.activeV2DataDigest || typeof acceptanceReport.activeV2DataDigest !== 'string') {
    throw new Error('LINEAGE_VALIDATION_FAILED: Missing activeV2DataDigest in acceptance report');
  }

  // 1. Validar contagem de registros
  if (records.length !== acceptanceReport.activeV2RecordCount) {
    throw new Error(`LINEAGE_VALIDATION_FAILED: Record count mismatch, staging has ${records.length}, acceptance report has ${acceptanceReport.activeV2RecordCount}`);
  }

  // 2. Validar digest canônico recalculado
  const calculatedDigest = calculateCanonicalActiveV2DataDigest(records);
  if (calculatedDigest !== acceptanceReport.activeV2DataDigest) {
    throw new Error(`LINEAGE_VALIDATION_FAILED: Data digest mismatch, recalculated ${calculatedDigest}, acceptance report has ${acceptanceReport.activeV2DataDigest}`);
  }
}
