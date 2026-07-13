import pilotPack from '../equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json';
import evidenceFixture from '../equinox/data-packs/competitive/champions-reg-mb-doubles/verified-evidence.fixture.json';
import { CompetitiveSetValidationInput } from '../equinox/data-validation/CompetitiveValidationTypes';
import { evaluateVerifiedReadiness, VerifiedEvidenceRecord } from '../equinox/competitive/VerifiedReadinessPolicy';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const records = (pilotPack as { sets: CompetitiveSetValidationInput[] }).sets;
const evidenceRecords = (evidenceFixture as { formatId: string; records: VerifiedEvidenceRecord[] }).records;
const evidenceBySetId = new Map(evidenceRecords.map(record => [record.setId, record]));

assert(evidenceFixture.formatId === 'champions_reg_m_b_doubles', `Verified evidence fixture formatId must be champions_reg_m_b_doubles, received ${evidenceFixture.formatId}.`);
assert(evidenceRecords.length === records.length, `Verified readiness expects ${records.length} evidence records, received ${evidenceRecords.length}.`);
for (const record of records) {
  assert(evidenceBySetId.has(String(record.setId)), `missing verified evidence record for ${String(record.setId)}`);
}

const evaluation = evaluateVerifiedReadiness(records, evidenceRecords);

assert(records.length === 9, `Verified readiness expects 9 pilot records, received ${records.length}.`);
assert(records.every(record => record.status === 'reviewed'), 'Verified readiness gate requires all pilot records to remain reviewed.');
assert(evaluation.aggregate.activeCount === 0, 'Verified readiness gate forbids active pilot records.');
assert(evaluation.aggregate.verifiedCount === 0, 'Verified readiness gate forbids verified pilot records.');
assert(evaluation.promotionReady.every(record => record.sourceType === 'curated'), 'Only curated records may be promotion-ready.');
assert(evaluation.blocked.every(record => record.blockers.length > 0), 'Blocked records must have at least one readiness blocker.');

console.log('[Equinox] Verified readiness validation passed: promotion remains blocked.');
console.log(JSON.stringify({
  aggregate: evaluation.aggregate,
  blockedSets: evaluation.blocked.map(result => ({
    setId: result.setId,
    pokemonName: result.pokemonName,
    status: result.status,
    sourceType: result.sourceType,
    confidence: result.confidence,
    coherenceScore: result.coherenceScore,
    blockers: result.blockers,
  })),
}, null, 2));
