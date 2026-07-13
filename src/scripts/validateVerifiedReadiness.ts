import pilotPack from '../equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json';
import evidenceFixture from '../equinox/data-packs/competitive/champions-reg-mb-doubles/verified-evidence.fixture.json';
import { CompetitiveSetValidationInput } from '../equinox/data-validation/CompetitiveValidationTypes';

type EvidenceReviewStatus = 'pending' | 'approved';

interface VerifiedEvidenceRecord {
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

interface ReadinessItem {
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

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function evaluateRecord(record: CompetitiveSetValidationInput, verifiedEvidence: VerifiedEvidenceRecord): ReadinessItem {
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

const records = (pilotPack as { sets: CompetitiveSetValidationInput[] }).sets;
const evidenceRecords = (evidenceFixture as { formatId: string; records: VerifiedEvidenceRecord[] }).records;
const evidenceBySetId = new Map(evidenceRecords.map(record => [record.setId, record]));

assert(evidenceFixture.formatId === 'champions_reg_m_b_doubles', `Verified evidence fixture formatId must be champions_reg_m_b_doubles, received ${evidenceFixture.formatId}.`);
assert(evidenceRecords.length === records.length, `Verified readiness expects ${records.length} evidence records, received ${evidenceRecords.length}.`);
for (const record of records) {
  assert(evidenceBySetId.has(String(record.setId)), `missing verified evidence record for ${String(record.setId)}`);
}

const results = records.map(record => evaluateRecord(record, evidenceBySetId.get(String(record.setId)) as VerifiedEvidenceRecord));
const promotionReady = results.filter(result => result.blockers.length === 0);
const blocked = results.filter(result => result.blockers.length > 0);

assert(records.length === 9, `Verified readiness expects 9 pilot records, received ${records.length}.`);
assert(records.every(record => record.status === 'reviewed'), 'Verified readiness gate requires all pilot records to remain reviewed.');
assert(promotionReady.length === 0, 'No pilot set may become verified before all human evidence gates are complete.');
assert(blocked.length === records.length, 'All current pilot records must remain blocked for verified promotion.');
assert(records.every(record => record.status !== 'verified' && record.status !== 'active'), 'Verified readiness gate forbids verified or active pilot records.');

const aggregate = {
  records: records.length,
  promotionReady: promotionReady.length,
  blocked: blocked.length,
  matchupTestingApprovedCount: results.filter(result => result.evidence.matchupTesting).length,
  sourceFreshnessReviewedCount: results.filter(result => result.evidence.sourceFreshnessReview).length,
  confidenceReadyCount: results.filter(result => result.evidence.confidenceReviewed).length,
  shadowReviewedCount: results.filter(result => result.evidence.shadowReview).length,
  stagingReviewedCount: results.filter(result => result.evidence.stagingReview).length,
  exportParityReviewedCount: results.filter(result => result.evidence.exportParityReview).length,
  rollbackEvidenceCount: results.filter(result => result.evidence.rollbackEvidence).length,
  limitationsResolvedCount: results.filter(result => result.evidence.limitationsResolved).length,
};

console.log('[Equinox] Verified readiness validation passed: promotion remains blocked.');
console.log(JSON.stringify({
  aggregate,
  blockedSets: blocked.map(result => ({
    setId: result.setId,
    pokemonName: result.pokemonName,
    status: result.status,
    sourceType: result.sourceType,
    confidence: result.confidence,
    coherenceScore: result.coherenceScore,
    blockers: result.blockers,
  })),
}, null, 2));
