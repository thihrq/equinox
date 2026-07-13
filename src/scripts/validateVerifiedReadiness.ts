import pilotPack from '../equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json';
import { CompetitiveSetValidationInput } from '../equinox/data-validation/CompetitiveValidationTypes';

interface HumanReview {
  reviewResult?: string;
  reviewScope?: string;
  legalityReview?: string;
  teamBuilderReview?: string;
  exportReview?: string;
  limitations?: string;
  nextGate?: string;
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
    sourceFreshness: boolean;
    confidenceReviewed: boolean;
    teamBuilderReviewed: boolean;
    shadowReviewed: boolean;
    stagingReviewed: boolean;
    exportReviewed: boolean;
    rollbackEvidence: boolean;
    noOpenLimitations: boolean;
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function humanReviewOf(record: CompetitiveSetValidationInput & { humanReview?: HumanReview }): HumanReview {
  return record.humanReview ?? {};
}

function includesAny(value: string | undefined, needles: string[]): boolean {
  const normalized = String(value ?? '').toLowerCase();
  return needles.some(needle => normalized.includes(needle));
}

function evaluateRecord(record: CompetitiveSetValidationInput & { humanReview?: HumanReview }): ReadinessItem {
  const review = humanReviewOf(record);
  const limitations = String(review.limitations ?? '').trim();
  const nextGate = String(review.nextGate ?? '').trim();
  const sourceType = String(record.sourceType ?? '');
  const confidence = Number(record.confidence ?? 0);
  const coherenceScore = Number(record.coherenceScore ?? 0);
  const status = String(record.status ?? 'draft');

  const evidence = {
    sourceFreshness: sourceType === 'curated' && Boolean(record.sourceUpdatedAt),
    confidenceReviewed: confidence >= 80 && coherenceScore >= 85,
    teamBuilderReviewed: includesAny(review.teamBuilderReview, ['approved']),
    shadowReviewed: includesAny(review.reviewScope, ['shadow']) || includesAny(review.reviewResult, ['shadow']),
    stagingReviewed: includesAny(review.reviewScope, ['staging']) || includesAny(review.reviewResult, ['staging']),
    exportReviewed: includesAny(review.exportReview, ['showdown', 'json', 'export']),
    rollbackEvidence: includesAny(nextGate, ['rollback']) && includesAny(nextGate, ['evidence']),
    noOpenLimitations: limitations.length === 0,
  };

  const blockers: string[] = [];
  if (status !== 'reviewed') blockers.push(`status must remain reviewed before verified promotion, received ${status}`);
  if (!evidence.sourceFreshness) blockers.push('missing curated source freshness evidence');
  if (!evidence.confidenceReviewed) blockers.push('confidence/coherence are below verified threshold');
  if (!evidence.teamBuilderReviewed) blockers.push('missing Team Builder review evidence');
  if (!evidence.shadowReviewed) blockers.push('missing shadow review evidence');
  if (!evidence.stagingReviewed) blockers.push('missing staging review evidence');
  if (!evidence.exportReviewed) blockers.push('missing export review evidence');
  if (!evidence.rollbackEvidence) blockers.push('missing rollback evidence');
  if (!evidence.noOpenLimitations) blockers.push(`open limitation: ${limitations}`);

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

const records = (pilotPack as { sets: Array<CompetitiveSetValidationInput & { humanReview?: HumanReview }> }).sets;
const results = records.map(evaluateRecord);
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
  curatedSourceCount: results.filter(result => result.evidence.sourceFreshness).length,
  confidenceReadyCount: results.filter(result => result.evidence.confidenceReviewed).length,
  teamBuilderReviewedCount: results.filter(result => result.evidence.teamBuilderReviewed).length,
  shadowReviewedCount: results.filter(result => result.evidence.shadowReviewed).length,
  stagingReviewedCount: results.filter(result => result.evidence.stagingReviewed).length,
  exportReviewedCount: results.filter(result => result.evidence.exportReviewed).length,
  rollbackEvidenceCount: results.filter(result => result.evidence.rollbackEvidence).length,
  noOpenLimitationsCount: results.filter(result => result.evidence.noOpenLimitations).length,
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
