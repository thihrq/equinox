import mongoose, { ClientSession } from 'mongoose';
import { resolveDataMode } from '../config/dataMode';
import { connectDatabase } from '../config/database';
import { VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST } from '../config/verifiedToActiveStagingAllowlist';
import {
  ActiveStagingDocument,
  RollbackActiveStagingSummary,
  assertActivationExecuteAuthorized,
  assertActiveStagingTarget,
  assertReadyForActivation,
  buildActiveStagingSummary,
  printActiveStagingSummary,
} from '../equinox/competitive/VerifiedToActiveStagingPolicy';

const execute = process.argv.includes('--execute');
const dryRun = process.argv.includes('--dry-run') || !execute;
const runIdArg = process.argv.find(arg => arg.startsWith('--run-id='));
const runId = runIdArg?.slice('--run-id='.length).trim();

function printRollbackSummary(summary: RollbackActiveStagingSummary): void {
  printActiveStagingSummary(summary);
}

function offlineSummary(): RollbackActiveStagingSummary {
  return {
    mode: 'dry-run',
    mongoRead: false,
    targetCollection: process.env.EQUINOX_TARGET_COLLECTION ?? 'not-configured',
    activeRunId: runId,
    recordsEligibleForRollback: 0,
    recordsRolledBack: 0,
    allowlistedActive: 0,
    allowlistedVerified: 0,
    blockedRecordsActive: 0,
    generatedActive: 0,
    productionWrites: 0,
    recordsWritten: 0,
  };
}

async function readStagingDocuments(targetCollection: string, session?: ClientSession): Promise<ActiveStagingDocument[]> {
  return mongoose.connection
    .collection(targetCollection)
    .find({}, session ? { session } : undefined)
    .toArray() as unknown as ActiveStagingDocument[];
}

function toRollbackSummary(
  documents: ActiveStagingDocument[],
  targetCollection: string,
  mode: RollbackActiveStagingSummary['mode'],
  recordsRolledBack = 0,
): RollbackActiveStagingSummary {
  const activeSummary = buildActiveStagingSummary(documents, targetCollection, mode, recordsRolledBack, runId);
  const rollbackCandidates = documents.filter(document => (
    VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST.includes(String(document.setId ?? '') as never)
    && document.status === 'active'
    && document.active === true
    && document.activeRunId === runId
  ));

  return {
    mode,
    mongoRead: true,
    targetCollection,
    activeRunId: runId,
    recordsEligibleForRollback: rollbackCandidates.length,
    recordsRolledBack,
    allowlistedActive: activeSummary.allowlistedActive,
    allowlistedVerified: activeSummary.allowlistedVerified,
    blockedRecordsActive: activeSummary.blockedRecordsActive,
    generatedActive: activeSummary.generatedActive,
    productionWrites: 0,
    recordsWritten: recordsRolledBack,
  };
}

function assertRollbackExecuteAuthorized(): string {
  const targetCollection = assertActivationExecuteAuthorized(execute);
  if (!runId) {
    console.log('recordsWritten: 0');
    console.log('productionWrites: 0');
    throw new Error('Active staging rollback execute refused: --run-id=<ACTIVE_RUN_ID> is required.');
  }
  return targetCollection;
}

async function executeRollback(targetCollection: string): Promise<void> {
  await connectDatabase();
  const session = await mongoose.startSession();
  let finalSummary: RollbackActiveStagingSummary | undefined;

  try {
    await session.withTransaction(async () => {
      const beforeDocs = await readStagingDocuments(targetCollection, session);
      const beforeSummary = toRollbackSummary(beforeDocs, targetCollection, 'execute');

      if (beforeSummary.recordsEligibleForRollback === 0) {
        finalSummary = beforeSummary;
        return;
      }

      if (beforeSummary.recordsEligibleForRollback !== VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST.length) {
        throw new Error(`Active staging rollback blocked: expected 4 rollback candidates, received ${beforeSummary.recordsEligibleForRollback}.`);
      }

      const now = new Date();
      const result = await mongoose.connection.collection(targetCollection).updateMany(
        {
          setId: { $in: VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST },
          status: 'active',
          active: true,
          activeRunId: runId,
        },
        {
          $set: {
            status: 'verified',
            active: false,
            rolledBackAt: now,
            rolledBackFromActiveRunId: runId,
            updatedAt: now,
          },
          $unset: {
            activeRunId: '',
            activatedAt: '',
            activatedFromStatus: '',
            previousVerifiedRunId: '',
            activationMetadata: '',
          },
        },
        { session },
      );

      const recordsRolledBack = Number(result.modifiedCount);
      if (recordsRolledBack !== VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST.length) {
        throw new Error(`Active staging rollback write count mismatch: expected 4, received ${recordsRolledBack}.`);
      }

      const afterDocs = await readStagingDocuments(targetCollection, session);
      const activeSummary = buildActiveStagingSummary(afterDocs, targetCollection, 'execute', recordsRolledBack, runId);
      assertReadyForActivation(activeSummary);
      finalSummary = toRollbackSummary(afterDocs, targetCollection, 'execute', recordsRolledBack);
    });

    if (!finalSummary) throw new Error('Active staging rollback finished without summary.');
    printRollbackSummary(finalSummary);
  } finally {
    await session.endSession();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

async function runDryRun(): Promise<void> {
  if (resolveDataMode() !== 'mongo') {
    printRollbackSummary(offlineSummary());
    return;
  }

  const targetCollection = assertActiveStagingTarget(process.env.EQUINOX_TARGET_COLLECTION);
  try {
    await connectDatabase();
    const docs = await readStagingDocuments(targetCollection);
    printRollbackSummary(toRollbackSummary(docs, targetCollection, 'dry-run'));
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

async function main(): Promise<void> {
  if (dryRun) {
    await runDryRun();
    return;
  }

  const targetCollection = assertRollbackExecuteAuthorized();
  await executeRollback(targetCollection);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
