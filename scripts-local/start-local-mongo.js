const { MongoMemoryReplSet } = require('mongodb-memory-server');
const fs = require('fs');
const path = require('path');

const URI_FILE = path.join(__dirname, '.local-mongo-uri.txt');

async function main() {
  console.log('[local-mongo] starting a 1-node replica set (needed for transactions)...');
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const uri = replSet.getUri();
  fs.writeFileSync(URI_FILE, uri, 'utf8');
  console.log(`[local-mongo] ready. URI: ${uri}`);
  console.log(`[local-mongo] URI written to ${URI_FILE}`);
  console.log('[local-mongo] keeping process alive. Ctrl+C or kill this process to stop.');

  process.on('SIGTERM', async () => {
    await replSet.stop();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('[local-mongo] failed to start:', err);
  process.exit(1);
});
