import mongoose, { ClientSession } from 'mongoose';
import { resolveDataMode } from '../config/dataMode';
import { connectDatabase } from '../config/database';
import { VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST } from '../config/verifiedToActiveStagingAllowlist';
import {
  ACTIVE_STAGING_SOURCE,
  ACTIVE_STAGING_TARGET_COLLECTION,
  ACTIVE_STAGING_UNIQUE_SET_KEY_INDEX,
  ActiveStagingDocument,
  ActiveStagingSummary,
  assertActivationExecuteAuthorized,
  assertActiveFinalState,
  assertActiveStagingTarget,
  assertReadyForActivation,
  buildActiveStagingSummary,
  printActiveStagingSummary,
  resolveActivationSetKey,
} from '../equinox/competitive/VerifiedToActiveStagingPolicy';

const execute = process.argv.includes('--execute');
const dryRun = process.argv.includes('--dry-run') || !execute;

function offlineSummary(): ActiveStagingSummary {
  return {
    mode: 'dry-run',
    mongoRead: false,
    targetCollection: process.env.EQUINOX_TARGET_COLLECTION ?? 'not-configured',
    recordsAllowlisted: VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST.length,
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
  };
}

function assertReadyOrFinal(summary: ActiveStagingSummary): void {
  if (summary.allowlistedActive === VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST.length) {
    assertActiveFinalState(summary);
    return;
  }

  assertReadyForActivation(summary);
}

async function readStagingDocuments(targetCollection: string, session?: ClientSession): Promise<ActiveStagingDocument[]> {
  return mongoose.connection
    .collection(targetCollection)
    .find({}, session ? { session } : undefined)
    .toArray() as unknown as ActiveStagingDocument[];
}

async function createActiveSetKeyIndex(targetCollection: string): Promise<void> {
  await mongoose.connection.collection(targetCollection).createIndex(
    { setKey: 1 },
    {
      name: ACTIVE_STAGING_UNIQUE_SET_KEY_INDEX,
      unique: true,
      partialFilterExpression: { active: true },
    },
  );
}

function buildBulkOperations(documents: ActiveStagingDocument[], activeRunId: string, now: Date): Parameters<ReturnType<typeof mongoose.connection.collection>['bulkWrite']>[0] {
  const bySetId = new Map(documents.map(document => [String(document.setId ?? ''), document]));

  return VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST.map(setId => {
    const document = bySetId.get(setId);
    if (!document) throw new Error(`Active staging promotion blocked: missing ${setId}.`);
    const setKey = resolveActivationSetKey(document);
    const previousVerifiedRunId = String(document.verifiedRunId ?? '').trim();
    if (!previousVerifiedRunId) throw new Error(`Active staging promotion blocked: missing verifiedRunId for ${setId}.`);

    return {
      updateOne: {
        filter: {
          setId,
          status: 'verified',
          active: { $ne: true },
          sourceType: 'curated',
          verifiedRunId: previousVerifiedRunId,
        },
        update: {
          $set: {
            status: 'active',
            active: true,
            setKey,
            activeRunId,
            activatedAt: now,
            activatedFromStatus: 'verified',
            previousVerifiedRunId,
            activationMetadata: {
              runId: activeRunId,
              targetCollection: ACTIVE_STAGING_TARGET_COLLECTION,
              executedAt: now,
              source: ACTIVE_STAGING_SOURCE,
            },
            updatedAt: now,
          },
        },
      },
    };
  });
}

async function executeActivation(targetCollection: string): Promise<void> {
  await connectDatabase();
  await createActiveSetKeyIndex(targetCollection);

  const session = await mongoose.startSession();
  let finalSummary: ActiveStagingSummary | undefined;

  try {
    await session.withTransaction(async () => {
      const beforeDocs = await readStagingDocuments(targetCollection, session);
      const beforeSummary = buildActiveStagingSummary(beforeDocs, targetCollection, 'execute');

      if (beforeSummary.allowlistedActive === VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST.length) {
        assertActiveFinalState(beforeSummary);
        finalSummary = { ...beforeSummary, recordsWritten: 0 };
        return;
      }

      assertReadyForActivation(beforeSummary);

      const activeRunId = `active-staging-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      const now = new Date();
      const operations = buildBulkOperations(beforeDocs, activeRunId, now);
      const result = await mongoose.connection.collection(targetCollection).bulkWrite(operations, { session, ordered: true });
      const recordsWritten = Number(result.modifiedCount);

      if (recordsWritten !== VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST.length) {
        throw new Error(`Active staging promotion write count mismatch: expected 4, received ${recordsWritten}.`);
      }

      const afterDocs = await readStagingDocuments(targetCollection, session);
      const afterSummary = buildActiveStagingSummary(afterDocs, targetCollection, 'execute', recordsWritten, activeRunId);
      assertActiveFinalState(afterSummary);
      finalSummary = afterSummary;
    });

    if (!finalSummary) throw new Error('Active staging promotion finished without summary.');
    printActiveStagingSummary(finalSummary);
  } finally {
    await session.endSession();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

async function runDryRun(): Promise<void> {
  if (resolveDataMode() !== 'mongo') {
    printActiveStagingSummary(offlineSummary());
    return;
  }

  const targetCollection = assertActiveStagingTarget(process.env.EQUINOX_TARGET_COLLECTION);
  try {
    await connectDatabase();
    const docs = await readStagingDocuments(targetCollection);
    const summary = buildActiveStagingSummary(docs, targetCollection, 'dry-run');
    assertReadyOrFinal(summary);
    printActiveStagingSummary(summary);
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

  const targetCollection = assertActivationExecuteAuthorized(execute);
  await executeActivation(targetCollection);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
