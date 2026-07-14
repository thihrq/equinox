import { ACTIVE_STAGING_SET_ALLOWLIST } from '../equinox/competitive/active-staging/ActiveStagingHomologationAllowlist';
import {
  assertActiveStagingHomologationConfig,
  ActiveStagingConfigError,
  readActiveStagingHomologationConfig,
} from '../equinox/competitive/active-staging/ActiveStagingHomologationConfig';
import { CollectionReadMonitor } from '../equinox/competitive/active-staging/ActiveStagingCollectionReadMonitor';
import { MongoCommandMonitor } from '../equinox/competitive/active-staging/ActiveStagingMongoCommandMonitor';
import { ActiveStagingSetRepository } from '../equinox/competitive/active-staging/ActiveStagingSetRepository';
import {
  activeStagingRepositoryExitCodeFor,
  assertActiveStagingRepositoryFunctionalGates,
  createActiveStagingMongoClient,
} from '../equinox/competitive/active-staging/ActiveStagingRepositoryValidation';

function requireMongoUri(env: NodeJS.ProcessEnv): string {
  const mongoUri = env.MONGO_URI ?? env.MONGODB_URI;
  if (!mongoUri) throw new ActiveStagingConfigError('MONGO_URI or MONGODB_URI is required');
  return mongoUri;
}

async function main(): Promise<void> {
  const config = assertActiveStagingHomologationConfig(readActiveStagingHomologationConfig(process.env));
  const client = createActiveStagingMongoClient(requireMongoUri(process.env));
  const commandMonitor = new MongoCommandMonitor();
  const readMonitor = new CollectionReadMonitor();

  client.on('commandStarted', (event) => {
    const collectionName = event.command[event.commandName];
    commandMonitor.record({
      commandName: event.commandName,
      collectionName: typeof collectionName === 'string' ? collectionName : undefined,
    });
  });

  await client.connect();
  try {
    const repository = new ActiveStagingSetRepository({ client, config, commandMonitor, readMonitor });
    const records = await repository.loadActiveAllowlistedSets();
    const report = {
      targetCollection: config.collectionName,
      recordsFound: records.length,
      setIds: records.map((record) => record.setId).sort(),
      writeReport: commandMonitor.report(),
      readReport: readMonitor.report(),
    };
    console.log(JSON.stringify(report, null, 2));
    assertActiveStagingRepositoryFunctionalGates(
      records.length,
      ACTIVE_STAGING_SET_ALLOWLIST.length,
      report.writeReport.observedMongoWriteCommands,
      report.writeReport.productionCollectionReads,
      report.readReport.productionCollectionReads,
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = activeStagingRepositoryExitCodeFor(error);
});
