import pilotPack from '../equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json';
import evidenceFixture from '../equinox/data-packs/competitive/champions-reg-mb-doubles/verified-evidence.fixture.json';
import { evaluateVerifiedReadiness, VerifiedEvidenceRecord } from '../equinox/competitive/VerifiedReadinessPolicy';
import { CompetitiveSetValidationInput } from '../equinox/data-validation/CompetitiveValidationTypes';

const dryRun = process.argv.includes('--dry-run');

if (!dryRun) {
  throw new Error('Verified promotion requires a separate approved non-dry-run command.');
}

const records = (pilotPack as { sets: CompetitiveSetValidationInput[] }).sets;
const evidenceRecords = (evidenceFixture as { records: VerifiedEvidenceRecord[] }).records;
const evaluation = evaluateVerifiedReadiness(records, evidenceRecords);

console.log(`recordsEligible: ${evaluation.promotionReady.length}`);
console.log(`recordsBlocked: ${evaluation.blocked.length}`);
console.log('recordsWritten: 0');
console.log('activeWritten: 0');
