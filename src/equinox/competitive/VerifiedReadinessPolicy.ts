import { CompetitiveSetValidationInput } from '../data-validation/CompetitiveValidationTypes';

export type EvidenceReviewStatus = 'pending' | 'approved';

export interface VerifiedEvidenceRecord {
  setId: string;
  matchupTesting: EvidenceReviewStatus;
  sourceFreshnessReview: EvidenceReviewStatus;
  shadowReview: EvidenceReviewStatus;
  stagingReview: EvidenceReviewStatus;
  exportParityReview: EvidenceReviewStatus;
  rollbackEvidence: EvidenceReviewStatus;
  limitationsResolved: boolean;
  notes: string;
}

export interface VerifiedReadinessItem {
  setId: string;
  pokemonName: string;
  status: string;
  sourceType?: string;
  confidence: number;
  coherenceScore: number;
  blockers: string[];
  evidence: {
    matchupTesting: boolean;
    sourceFreshnessReview: boolean;
    confidenceReviewed: boolean;
    shadowReview: boolean;
    stagingReview: boolean;
    exportParityReview: boolean;
    rollbackEvidence: boolean;
    limitationsResolved: boolean;
  };
}

export interface VerifiedReadinessEvaluation {
  records: VerifiedReadinessItem[];
  promotionReady: VerifiedReadinessItem[];
  blocked: VerifiedReadinessItem[];
  aggregate: {
    records: number;
    promotionReady: number;
    blocked: number;
    activeCount: number;
    verifiedCount: number;
    generatedBlockedCount: number;
    matchupTestingApprovedCount: number;
    sourceFreshnessReviewedCount: number;
    confidenceReadyCount: number;
    shadowReviewedCount: number;
    stagingReviewedCount: number;
    exportParityReviewedCount: number;
    rollbackEvidenceCount: number;
    limitationsResolvedCount: number;
  };
}

export function evaluateVerifiedRecord(
  record: CompetitiveSetValidationInput,
  verifiedEvidence: VerifiedEvidenceRecord,
): VerifiedReadinessItem {
  const confidence = Number(record.confidence ?? 0);
  const coherenceScore = Number(record.coherenceScore ?? 0);
  const status = String(record.status ?? 'draft');

  const evidence = {
    matchupTesting: verifiedEvidence.matchupTesting === 'approved',
    sourceFreshnessReview: record.sourceType === 'curated'
      && Boolean(record.sourceUpdatedAt)
      && verifiedEvidence.sourceFreshnessReview === 'approved',
    confidenceReviewed: confidence >= 80 && coherenceScore >= 85,
    shadowReview: verifiedEvidence.shadowReview === 'approved',
    stagingReview: verifiedEvidence.stagingReview === 'approved',
    exportParityReview: verifiedEvidence.exportParityReview === 'approved',
    rollbackEvidence: verifiedEvidence.rollbackEvidence === 'approved',
    limitationsResolved: verifiedEvidence.limitationsResolved === true,
  };

  const blockers: string[] = [];
  if (status !== 'reviewed') blockers.push(`status must remain reviewed before verified promotion, received ${status}`);
  if (!evidence.matchupTesting) blockers.push('missing approved matchup testing evidence');
  if (!evidence.sourceFreshnessReview) blockers.push('missing curated source freshness or approved source freshness review evidence');
  if (!evidence.confidenceReviewed) blockers.push('confidence/coherence are below verified threshold');
  if (!evidence.shadowReview) blockers.push('missing approved shadow review evidence');
  if (!evidence.stagingReview) blockers.push('missing approved staging review evidence');
  if (!evidence.exportParityReview) blockers.push('missing approved export parity review evidence');
  if (!evidence.rollbackEvidence) blockers.push('missing approved rollback evidence');
  if (!evidence.limitationsResolved) blockers.push(`unresolved limitation: ${verifiedEvidence.notes}`);

  return {
    setId: String(record.setId ?? 'unknown'),
    pokemonName: String(record.pokemonName ?? 'unknown'),
    status,
    sourceType: record.sourceType,
    confidence,
    coherenceScore,
    blockers,
    evidence,
  };
}

export function evaluateVerifiedReadiness(
  records: CompetitiveSetValidationInput[],
  evidenceRecords: VerifiedEvidenceRecord[],
): VerifiedReadinessEvaluation {
  const evidenceBySetId = new Map(evidenceRecords.map(record => [record.setId, record]));
  const evaluatedRecords = records.map(record => evaluateVerifiedRecord(
    record,
    evidenceBySetId.get(String(record.setId)) as VerifiedEvidenceRecord,
  ));
  const promotionReady = evaluatedRecords.filter(record => record.blockers.length === 0);
  const blocked = evaluatedRecords.filter(record => record.blockers.length > 0);

  return {
    records: evaluatedRecords,
    promotionReady,
    blocked,
    aggregate: {
      records: evaluatedRecords.length,
      promotionReady: promotionReady.length,
      blocked: blocked.length,
      activeCount: evaluatedRecords.filter(record => record.status === 'active').length,
      verifiedCount: evaluatedRecords.filter(record => record.status === 'verified').length,
      generatedBlockedCount: blocked.filter(record => record.sourceType === 'generated').length,
      matchupTestingApprovedCount: evaluatedRecords.filter(record => record.evidence.matchupTesting).length,
      sourceFreshnessReviewedCount: evaluatedRecords.filter(record => record.evidence.sourceFreshnessReview).length,
      confidenceReadyCount: evaluatedRecords.filter(record => record.evidence.confidenceReviewed).length,
      shadowReviewedCount: evaluatedRecords.filter(record => record.evidence.shadowReview).length,
      stagingReviewedCount: evaluatedRecords.filter(record => record.evidence.stagingReview).length,
      exportParityReviewedCount: evaluatedRecords.filter(record => record.evidence.exportParityReview).length,
      rollbackEvidenceCount: evaluatedRecords.filter(record => record.evidence.rollbackEvidence).length,
      limitationsResolvedCount: evaluatedRecords.filter(record => record.evidence.limitationsResolved).length,
    },
  };
}
