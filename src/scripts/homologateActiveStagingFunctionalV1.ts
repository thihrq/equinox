import type { MongoClient } from 'mongodb';
import {
  assertActiveStagingHomologationConfig,
  ActiveStagingConfigError,
  readActiveStagingHomologationConfig,
} from '../equinox/competitive/active-staging/ActiveStagingHomologationConfig';
import { CollectionReadMonitor } from '../equinox/competitive/active-staging/ActiveStagingCollectionReadMonitor';
import { runActiveStagingHomologationWithRecords } from '../equinox/competitive/active-staging/ActiveStagingHomologationRunner';
import { MongoCommandMonitor } from '../equinox/competitive/active-staging/ActiveStagingMongoCommandMonitor';
import { ActiveStagingSetRepository } from '../equinox/competitive/active-staging/ActiveStagingSetRepository';
import {
  activeStagingRepositoryExitCodeFor,
  assertActiveStagingRepositoryFunctionalGates,
  ActiveStagingRepositoryFunctionalGateError,
  createActiveStagingMongoClient,
} from '../equinox/competitive/active-staging/ActiveStagingRepositoryValidation';
import {
  ACTIVE_STAGING_FUNCTIONAL_GATE_EXIT_CODE,
  ACTIVE_STAGING_MONGO_READ_EXIT_CODE,
  type ActiveStagingOperationalEvidence,
  type FunctionalHomologationExitCode,
} from '../equinox/competitive/active-staging/ActiveStagingHomologationTypes';
import { ACTIVE_STAGING_SET_ALLOWLIST } from '../equinox/competitive/active-staging/ActiveStagingHomologationAllowlist';

function requireMongoUri(env: NodeJS.ProcessEnv): string {
  const mongoUri = env.MONGO_URI ?? env.MONGODB_URI;
  if (!mongoUri) throw new ActiveStagingConfigError('MONGO_URI or MONGODB_URI is required');
  return mongoUri;
}

function attachCommandMonitor(client: MongoClient, commandMonitor: MongoCommandMonitor): void {
  client.on('commandStarted', (event) => {
    const collectionName = event.command[event.commandName];
    commandMonitor.record({
      commandName: event.commandName,
      collectionName: typeof collectionName === 'string' ? collectionName : undefined,
    });
  });
}

async function main(): Promise<FunctionalHomologationExitCode> {
  let client: MongoClient | undefined;
  let exitCode: FunctionalHomologationExitCode = ACTIVE_STAGING_MONGO_READ_EXIT_CODE;

  try {
    const config = assertActiveStagingHomologationConfig(readActiveStagingHomologationConfig(process.env));
    client = createActiveStagingMongoClient(requireMongoUri(process.env));

    const commandMonitor = new MongoCommandMonitor();
    const readMonitor = new CollectionReadMonitor();
    attachCommandMonitor(client, commandMonitor);

    await client.connect();
    const repository = new ActiveStagingSetRepository({ client, config, commandMonitor, readMonitor });
    const records = await repository.loadActiveAllowlistedSets();

    let report;
    try {
      report = runActiveStagingHomologationWithRecords(records);
    } catch (error) {
      throw new ActiveStagingRepositoryFunctionalGateError(
        error instanceof Error ? error.message : String(error),
      );
    }

    const mongo = commandMonitor.report();
    const reads = readMonitor.report();
    const productionCollectionReads = mongo.productionCollectionReads + reads.productionCollectionReads;
    const recordsWritten = mongo.observedMongoWriteCommands;
    const productionWrites = mongo.observedProductionWriteCommands;
    const evidence: ActiveStagingOperationalEvidence & { mongo: typeof mongo; reads: typeof reads } = {
      ...report,
      targetCollection: config.collectionName,
      productionCollectionReads,
      observedMongoWriteCommands: mongo.observedMongoWriteCommands,
      observedStagingWriteCommands: mongo.observedStagingWriteCommands,
      observedProductionWriteCommands: mongo.observedProductionWriteCommands,
      productionWrites,
      recordsWritten,
      mongo,
      reads,
    };
    console.log(JSON.stringify(evidence, null, 2));

    assertActiveStagingRepositoryFunctionalGates(
      records.length,
      ACTIVE_STAGING_SET_ALLOWLIST.length,
      evidence.observedMongoWriteCommands,
      mongo.productionCollectionReads,
      reads.productionCollectionReads,
    );
    if (evidence.productionCollectionReads !== 0) {
      throw new ActiveStagingRepositoryFunctionalGateError('production reads must be zero');
    }
    if (evidence.productionWrites !== 0 || evidence.recordsWritten !== 0) {
      throw new ActiveStagingRepositoryFunctionalGateError('active staging homologation must not write records');
    }
    exitCode = report.aggregate.readyForAtlasReadOnlyHomologation
      ? 0
      : ACTIVE_STAGING_FUNCTIONAL_GATE_EXIT_CODE;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    exitCode = activeStagingRepositoryExitCodeFor(error);
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        exitCode = ACTIVE_STAGING_MONGO_READ_EXIT_CODE;
      }
    }
  }

  return exitCode;
}

main().then((code) => {
  process.exitCode = code;
});
