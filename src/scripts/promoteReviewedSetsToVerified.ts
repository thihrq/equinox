import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import pilotPack from '../equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json';
import evidenceFixture from '../equinox/data-packs/competitive/champions-reg-mb-doubles/verified-evidence.fixture.json';
import {
  CompetitivePayloadHashRecord,
  PRODUCTION_SET_COLLECTION,
  VERIFIED_STAGING_PROMOTION_ALLOWLIST,
  VERIFIED_STAGING_TARGET_COLLECTION,
  assertVerifiedStagingTarget,
  buildCompetitivePayloadHash,
  validateVerifiedPromotionEligibility,
} from '../equinox/competitive/VerifiedStagingPromotionPolicy';
import { evaluateVerifiedReadiness, VerifiedEvidenceRecord } from '../equinox/competitive/VerifiedReadinessPolicy';
import { CompetitiveSetValidationInput } from '../equinox/data-validation/CompetitiveValidationTypes';

const execute = process.argv.includes('--execute');
const dryRun = process.argv.includes('--dry-run') || !execute;

interface PromotionSummary {
  mode: 'dry-run' | 'execute';
  runId?: string;
  targetCollection: string;
  eligibleSetIds: string[];
  blockedSetIds: string[];
  recordsEligible: number;
  recordsBlocked: number;
  recordsAlreadyVerified: number;
  recordsPromotedToVerified: number;
  recordsWritten: number;
  recordsActive: number;
  generatedPromoted: number;
  productionWrites: number;
  competitivePayloadHashes?: CompetitivePayloadHashRecord[];
}

function buildEvaluation(): ReturnType<typeof validateVerifiedPromotionEligibility> {
  const records = (pilotPack as { sets: CompetitiveSetValidationInput[] }).sets;
  const evidenceRecords = (evidenceFixture as { records: VerifiedEvidenceRecord[] }).records;
  const evaluation = evaluateVerifiedReadiness(records, evidenceRecords);
  return validateVerifiedPromotionEligibility(evaluation, records);
}

function assertExecuteAuthorized(): string {
  const targetCollection = process.env.EQUINOX_TARGET_COLLECTION;
  const failures = [
    targetCollection === PRODUCTION_SET_COLLECTION ? 'production collection pokemonsets is not allowed' : null,
    targetCollection === VERIFIED_STAGING_TARGET_COLLECTION ? null : `EQUINOX_TARGET_COLLECTION=${VERIFIED_STAGING_TARGET_COLLECTION} is required`,
    process.env.EQUINOX_DATA_MODE === 'mongo' ? null : 'EQUINOX_DATA_MODE=mongo is required',
    process.env.EQUINOX_ALLOW_DATABASE_WRITES === 'true' ? null : 'EQUINOX_ALLOW_DATABASE_WRITES=true is required',
    process.env.EQUINOX_ENABLE_VERIFIED_PROMOTION === 'true' ? null : 'EQUINOX_ENABLE_VERIFIED_PROMOTION=true is required',
  ].filter((failure): failure is string => Boolean(failure));

  if (failures.length > 0) {
    console.log('recordsWritten: 0');
    console.log('productionWrites: 0');
    throw new Error(`Verified staging promotion execute refused:\n- ${failures.join('\n- ')}`);
  }

  return assertVerifiedStagingTarget(targetCollection);
}

function printSummary(summary: PromotionSummary): void {
  console.log(JSON.stringify(summary, null, 2));
  console.log(`recordsEligible: ${summary.recordsEligible}`);
  console.log(`recordsBlocked: ${summary.recordsBlocked}`);
  console.log(`recordsAlreadyVerified: ${summary.recordsAlreadyVerified}`);
  console.log(`recordsPromotedToVerified: ${summary.recordsPromotedToVerified}`);
  console.log(`recordsWritten: ${summary.recordsWritten}`);
  console.log(`recordsActive: ${summary.recordsActive}`);
  console.log(`generatedPromoted: ${summary.generatedPromoted}`);
  console.log(`productionWrites: ${summary.productionWrites}`);
}

async function executePromotion(targetCollection: string, baseSummary: ReturnType<typeof buildEvaluation>): Promise<void> {
  const runId = `verified-staging-${new Date().toISOString().replace(/[:.]/g, '-')}`;

  try {
    await connectDatabase();
    const collection = mongoose.connection.collection(targetCollection);
    const beforeDocs = await collection.find({ setId: { $in: VERIFIED_STAGING_PROMOTION_ALLOWLIST } }).toArray();
    const beforeBySetId = new Map(beforeDocs.map(doc => [String(doc.setId), doc as unknown as CompetitiveSetValidationInput]));
    const missing = VERIFIED_STAGING_PROMOTION_ALLOWLIST.filter(setId => !beforeBySetId.has(setId));
    if (missing.length > 0) {
      throw new Error(`Verified staging promotion blocked: missing staging records ${missing.join(', ')}.`);
    }

    const activeEnabled = beforeDocs.filter(doc => doc.active === true).map(doc => String(doc.setId));
    if (activeEnabled.length > 0) {
      throw new Error(`Verified staging promotion blocked: active must not be true for ${activeEnabled.join(', ')}.`);
    }

    const generatedCandidates = beforeDocs.filter(doc => doc.sourceType === 'generated').map(doc => String(doc.setId));
    if (generatedCandidates.length > 0) {
      throw new Error(`Verified staging promotion blocked: generated records in allowlist ${generatedCandidates.join(', ')}.`);
    }

    const invalidStatusDocs = beforeDocs
      .filter(doc => doc.status !== 'reviewed' && doc.status !== 'verified')
      .map(doc => `${String(doc.setId)}:${String(doc.status ?? 'missing')}`);
    if (invalidStatusDocs.length > 0) {
      throw new Error(`Verified staging promotion blocked: unexpected status before write ${invalidStatusDocs.join(', ')}.`);
    }

    const alreadyVerifiedBefore = beforeDocs.filter(doc => doc.status === 'verified' && doc.active !== true);
    const reviewedBefore = beforeDocs.filter(doc => doc.status === 'reviewed' && doc.active !== true);
    if (alreadyVerifiedBefore.length + reviewedBefore.length !== VERIFIED_STAGING_PROMOTION_ALLOWLIST.length) {
      throw new Error(`Verified staging promotion blocked: reviewed+verified count must be 4 before write, reviewed=${reviewedBefore.length} verified=${alreadyVerifiedBefore.length}.`);
    }

    const now = new Date();
    const updateResult = await collection.updateMany(
      {
        setId: { $in: VERIFIED_STAGING_PROMOTION_ALLOWLIST },
        status: 'reviewed',
        active: { $ne: true },
        sourceType: 'curated',
      },
      {
        $set: {
          status: 'verified',
          active: false,
          verifiedAt: now,
          verifiedRunId: runId,
          updatedAt: now,
        },
      },
    );

    const recordsPromotedToVerified = Number(updateResult.modifiedCount);
    const matchedCount = Number(updateResult.matchedCount);
    if (matchedCount + alreadyVerifiedBefore.length !== VERIFIED_STAGING_PROMOTION_ALLOWLIST.length) {
      throw new Error(`Verified staging promotion count mismatch after atomic update: matched=${matchedCount} alreadyVerified=${alreadyVerifiedBefore.length}.`);
    }
    if (recordsPromotedToVerified < 0 || recordsPromotedToVerified > VERIFIED_STAGING_PROMOTION_ALLOWLIST.length) {
      throw new Error(`Verified staging promotion modified count is invalid: ${recordsPromotedToVerified}.`);
    }

    const afterDocs = await collection.find({ setId: { $in: VERIFIED_STAGING_PROMOTION_ALLOWLIST } }).toArray();
    const afterBySetId = new Map(afterDocs.map(doc => [String(doc.setId), doc as unknown as CompetitiveSetValidationInput]));
    const payloadHashes = VERIFIED_STAGING_PROMOTION_ALLOWLIST.map(setId => {
      const before = beforeBySetId.get(setId);
      const after = afterBySetId.get(setId);
      if (!before || !after) throw new Error(`Verified staging promotion hash failed for ${setId}.`);
      const competitivePayloadHashBefore = buildCompetitivePayloadHash(before);
      const competitivePayloadHashAfter = buildCompetitivePayloadHash(after);
      return {
        setId,
        competitivePayloadHashBefore,
        competitivePayloadHashAfter,
        competitivePayloadChanged: competitivePayloadHashBefore !== competitivePayloadHashAfter,
      };
    });
    const changedHashes = payloadHashes.filter(hash => hash.competitivePayloadChanged);
    if (changedHashes.length > 0) {
      throw new Error(`Verified staging promotion changed competitive payloads: ${changedHashes.map(hash => hash.setId).join(', ')}.`);
    }

    const recordsAlreadyVerified = afterDocs.filter(doc => doc.status === 'verified' && doc.active !== true).length - recordsPromotedToVerified;
    const recordsActive = await collection.countDocuments({ setId: { $in: VERIFIED_STAGING_PROMOTION_ALLOWLIST }, active: true });
    const generatedPromoted = await collection.countDocuments({ verifiedRunId: runId, sourceType: 'generated' });

    printSummary({
      mode: 'execute',
      runId,
      targetCollection,
      eligibleSetIds: baseSummary.eligibleSetIds,
      blockedSetIds: baseSummary.blockedSetIds,
      recordsEligible: baseSummary.recordsEligible,
      recordsBlocked: baseSummary.recordsBlocked,
      recordsAlreadyVerified: Math.max(recordsAlreadyVerified, 0),
      recordsPromotedToVerified,
      recordsWritten: recordsPromotedToVerified,
      recordsActive,
      generatedPromoted,
      productionWrites: 0,
      competitivePayloadHashes: payloadHashes,
    });
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

async function main(): Promise<void> {
  const validation = buildEvaluation();

  if (dryRun) {
    printSummary({
      mode: 'dry-run',
      targetCollection: process.env.EQUINOX_TARGET_COLLECTION ?? 'not-configured',
      ...validation,
    });
    return;
  }

  const targetCollection = assertExecuteAuthorized();
  await executePromotion(targetCollection, validation);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
