import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { resolveDataMode } from '../config/dataMode';
import {
  PRODUCTION_SET_COLLECTION,
  VERIFIED_STAGING_PROMOTION_ALLOWLIST,
  VERIFIED_STAGING_TARGET_COLLECTION,
  assertVerifiedStagingTarget,
} from '../equinox/competitive/VerifiedStagingPromotionPolicy';

const execute = process.argv.includes('--execute');
const dryRun = process.argv.includes('--dry-run') || !execute;
const runIdArg = process.argv.find(arg => arg.startsWith('--run-id='));
const runId = runIdArg?.slice('--run-id='.length);

interface RollbackSummary {
  mode: 'dry-run' | 'execute';
  targetCollection: string;
  runId?: string;
  recordsEligibleForRollback: number;
  recordsRolledBack: number;
  recordsWritten: number;
  recordsActive: number;
  generatedChanged: number;
  productionWrites: number;
}

function printSummary(summary: RollbackSummary): void {
  console.log(JSON.stringify(summary, null, 2));
  console.log(`recordsEligibleForRollback: ${summary.recordsEligibleForRollback}`);
  console.log(`recordsRolledBack: ${summary.recordsRolledBack}`);
  console.log(`recordsWritten: ${summary.recordsWritten}`);
  console.log(`recordsActive: ${summary.recordsActive}`);
  console.log(`generatedChanged: ${summary.generatedChanged}`);
  console.log(`productionWrites: ${summary.productionWrites}`);
}

function assertRollbackAuthorized(): string {
  const targetCollection = process.env.EQUINOX_TARGET_COLLECTION;
  const failures = [
    runId ? null : 'Verified staging rollback execute requires --run-id=<RUN_ID>.',
    targetCollection === PRODUCTION_SET_COLLECTION ? 'production collection pokemonsets is not allowed' : null,
    targetCollection === VERIFIED_STAGING_TARGET_COLLECTION ? null : `EQUINOX_TARGET_COLLECTION=${VERIFIED_STAGING_TARGET_COLLECTION} is required`,
    process.env.EQUINOX_DATA_MODE === 'mongo' ? null : 'EQUINOX_DATA_MODE=mongo is required.',
    process.env.EQUINOX_ALLOW_DATABASE_WRITES === 'true' ? null : 'EQUINOX_ALLOW_DATABASE_WRITES=true is required.',
  ].filter((failure): failure is string => Boolean(failure));

  if (failures.length > 0) {
    console.log('recordsWritten: 0');
    console.log('productionWrites: 0');
    throw new Error(`Verified staging rollback execute refused:\n- ${failures.join('\n- ')}`);
  }

  return assertVerifiedStagingTarget(targetCollection);
}

async function countRollbackCandidates(targetCollection: string): Promise<number> {
  await connectDatabase();
  const collection = mongoose.connection.collection(targetCollection);
  return collection.countDocuments({
    setId: { $in: VERIFIED_STAGING_PROMOTION_ALLOWLIST },
    status: 'verified',
    active: false,
    verifiedRunId: runId,
  });
}

async function main(): Promise<void> {
  if (dryRun && resolveDataMode() !== 'mongo') {
    printSummary({
      mode: 'dry-run',
      targetCollection: process.env.EQUINOX_TARGET_COLLECTION ?? 'not-configured',
      runId,
      recordsEligibleForRollback: 0,
      recordsRolledBack: 0,
      recordsWritten: 0,
      recordsActive: 0,
      generatedChanged: 0,
      productionWrites: 0,
    });
    return;
  }

  const targetCollection = execute
    ? assertRollbackAuthorized()
    : assertVerifiedStagingTarget(process.env.EQUINOX_TARGET_COLLECTION);

  try {
    if (dryRun) {
      const recordsEligibleForRollback = runId ? await countRollbackCandidates(targetCollection) : 0;
      printSummary({
        mode: 'dry-run',
        targetCollection,
        runId,
        recordsEligibleForRollback,
        recordsRolledBack: 0,
        recordsWritten: 0,
        recordsActive: 0,
        generatedChanged: 0,
        productionWrites: 0,
      });
      return;
    }

    await connectDatabase();
    const collection = mongoose.connection.collection(targetCollection);
    const filter = {
      setId: { $in: VERIFIED_STAGING_PROMOTION_ALLOWLIST },
      status: 'verified',
      active: false,
      verifiedRunId: runId,
    };
    const recordsEligibleForRollback = await collection.countDocuments(filter);
    const result = await collection.updateMany(filter, {
      $set: {
        status: 'reviewed',
        updatedAt: new Date(),
      },
      $unset: {
        verifiedAt: '',
        verifiedRunId: '',
      },
    });
    const recordsRolledBack = Number(result.modifiedCount);
    const recordsActive = await collection.countDocuments({ setId: { $in: VERIFIED_STAGING_PROMOTION_ALLOWLIST }, active: true });
    const generatedChanged = await collection.countDocuments({ verifiedRunId: runId, sourceType: 'generated' });

    printSummary({
      mode: 'execute',
      targetCollection,
      runId,
      recordsEligibleForRollback,
      recordsRolledBack,
      recordsWritten: recordsRolledBack,
      recordsActive,
      generatedChanged,
      productionWrites: 0,
    });
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
