import mongoose from 'mongoose';
import { resolveDataMode } from '../config/dataMode';
import { connectDatabase } from '../config/database';
import {
  assertActiveFinalState,
  assertActiveStagingTarget,
  assertReadyForActivation,
  buildActiveStagingSummary,
  printActiveStagingSummary,
} from '../equinox/competitive/VerifiedToActiveStagingPolicy';
import { VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST } from '../config/verifiedToActiveStagingAllowlist';

const expectedAllowlistedCount = VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST.length;

const requireActive = process.argv.includes('--require-active');

function printOfflineSummary(mode: string): void {
  printActiveStagingSummary({
    mode: mode as 'filesystem' | 'shadow',
    mongoRead: false,
    targetCollection: process.env.EQUINOX_TARGET_COLLECTION ?? 'not-configured',
    recordsAllowlisted: expectedAllowlistedCount,
    recordsFound: 0,
    recordsEligible: 0,
    recordsAlreadyActive: 0,
    recordsBlocked: 0,
    allowlistedVerified: 0,
    allowlistedActive: 0,
    allowlistedStillVerified: 0,
    blockedRecordsStillReviewed: 0,
    blockedRecordsActive: 0,
    generatedActive: 0,
    activeConflicts: 0,
    duplicateSetIds: 0,
    activeRunIds: [],
    sameActiveRunIdForAllowlist: false,
    productionWrites: 0,
    recordsWritten: 0,
  });
}

function assertCurrentState(summary: ReturnType<typeof buildActiveStagingSummary>): void {
  if (requireActive || summary.allowlistedActive === expectedAllowlistedCount) {
    assertActiveFinalState(summary);
    return;
  }

  assertReadyForActivation(summary);
}

async function main(): Promise<void> {
  const dataMode = resolveDataMode();
  if (dataMode !== 'mongo') {
    printOfflineSummary(dataMode);
    return;
  }

  const targetCollection = assertActiveStagingTarget(process.env.EQUINOX_TARGET_COLLECTION);

  try {
    await connectDatabase();
    const docs = await mongoose.connection.collection(targetCollection).find({}).toArray();
    const summary = buildActiveStagingSummary(docs as unknown as Parameters<typeof buildActiveStagingSummary>[0], targetCollection, 'mongo');
    assertCurrentState(summary);
    printActiveStagingSummary(summary);
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
