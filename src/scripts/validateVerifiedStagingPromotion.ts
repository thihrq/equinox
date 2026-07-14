import mongoose from 'mongoose';
import { resolveDataMode } from '../config/dataMode';
import { connectDatabase } from '../config/database';
import pilotPack from '../equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json';
import {
  VERIFIED_STAGING_PROMOTION_ALLOWLIST,
  assertVerifiedStagingTarget,
} from '../equinox/competitive/VerifiedStagingPromotionPolicy';
import { CompetitiveSetValidationInput } from '../equinox/data-validation/CompetitiveValidationTypes';

const requireVerified = process.argv.includes('--require-verified');
const pilotRecords = (pilotPack as { sets: CompetitiveSetValidationInput[] }).sets;
const blockedSetIds = pilotRecords
  .map(record => String(record.setId ?? 'unknown'))
  .filter(setId => !VERIFIED_STAGING_PROMOTION_ALLOWLIST.includes(setId as never));

interface StagingCheckSummary {
  mode: string;
  mongoRead: boolean;
  targetCollection: string;
  allowlistedVerified: number;
  allowlistedActive: number;
  generatedVerifiedByRun: number;
  blockedRecordsStillReviewed: number;
  duplicateSetIds: number;
  productionWrites: number;
  sameVerifiedRunIdForAllowlist: boolean;
  recordsWritten: number;
}

function assertCheck(summary: StagingCheckSummary): void {
  const failures: string[] = [];
  if (requireVerified && summary.allowlistedVerified !== 4) failures.push(`allowlistedVerified must be 4, received ${summary.allowlistedVerified}`);
  if (!requireVerified && summary.allowlistedVerified !== 0 && summary.allowlistedVerified !== 4) failures.push(`allowlistedVerified must be 0 or 4 before --require-verified, received ${summary.allowlistedVerified}`);
  if (summary.allowlistedActive !== 0) failures.push(`allowlistedActive must be 0, received ${summary.allowlistedActive}`);
  if (summary.generatedVerifiedByRun !== 0) failures.push(`generatedVerifiedByRun must be 0, received ${summary.generatedVerifiedByRun}`);
  if (summary.duplicateSetIds !== 0) failures.push(`duplicateSetIds must be 0, received ${summary.duplicateSetIds}`);
  if (summary.productionWrites !== 0) failures.push(`productionWrites must be 0, received ${summary.productionWrites}`);
  if (requireVerified && summary.blockedRecordsStillReviewed !== 5) failures.push(`blockedRecordsStillReviewed must be 5, received ${summary.blockedRecordsStillReviewed}`);
  if (requireVerified && !summary.sameVerifiedRunIdForAllowlist) failures.push('sameVerifiedRunIdForAllowlist must be true.');

  if (failures.length > 0) {
    throw new Error(`Verified staging check failed:\n- ${failures.join('\n- ')}`);
  }
}

async function main(): Promise<void> {
  const dataMode = resolveDataMode();
  if (dataMode !== 'mongo') {
    const summary: StagingCheckSummary = {
      mode: dataMode,
      mongoRead: false,
      targetCollection: process.env.EQUINOX_TARGET_COLLECTION ?? 'not-configured',
      allowlistedVerified: 0,
      allowlistedActive: 0,
      generatedVerifiedByRun: 0,
      blockedRecordsStillReviewed: 0,
      duplicateSetIds: 0,
      productionWrites: 0,
      sameVerifiedRunIdForAllowlist: false,
      recordsWritten: 0,
    };
    console.log(JSON.stringify(summary, null, 2));
    console.log('recordsWritten: 0');
    return;
  }

  const targetCollection = assertVerifiedStagingTarget(process.env.EQUINOX_TARGET_COLLECTION);
  try {
    await connectDatabase();
    const collection = mongoose.connection.collection(targetCollection);
    const docs = await collection.find({}).toArray();
    const allowlistedDocs = docs.filter(doc => VERIFIED_STAGING_PROMOTION_ALLOWLIST.includes(String(doc.setId) as never));
    const verifiedRunIds = new Set(allowlistedDocs.filter(doc => doc.status === 'verified').map(doc => String(doc.verifiedRunId ?? 'missing')));
    const duplicateSetIds = docs.length - new Set(docs.map(doc => String(doc.setId))).size;
    const summary: StagingCheckSummary = {
      mode: dataMode,
      mongoRead: true,
      targetCollection,
      allowlistedVerified: allowlistedDocs.filter(doc => doc.status === 'verified').length,
      allowlistedActive: allowlistedDocs.filter(doc => doc.active === true).length,
      generatedVerifiedByRun: docs.filter(doc => doc.sourceType === 'generated' && doc.status === 'verified' && doc.verifiedRunId).length,
      blockedRecordsStillReviewed: docs.filter(doc => blockedSetIds.includes(String(doc.setId)) && doc.status === 'reviewed' && doc.active === false).length,
      duplicateSetIds,
      productionWrites: 0,
      sameVerifiedRunIdForAllowlist: verifiedRunIds.size === 1 && !verifiedRunIds.has('missing'),
      recordsWritten: 0,
    };
    assertCheck(summary);
    console.log(JSON.stringify(summary, null, 2));
    console.log('recordsWritten: 0');
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
