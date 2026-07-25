const { spawn } = require('node:child_process');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: 'inherit',
      windowsHide: false,
    });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} encerrou com code=${code ?? 'null'} signal=${signal ?? 'null'}`));
    });
  });
}

async function main() {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const env = {
    ...process.env,
    EQUINOX_DATA_MODE: 'mongo',
    EQUINOX_ALLOW_DATABASE_WRITES: 'true',
    EQUINOX_SEED_ON_START: 'false',
    EQUINOX_FORCE_SEED_ON_START: 'false',
    EQUINOX_DATA_SYNC_REMOTE: 'false',
    MONGO_URI: replSet.getUri('equinox_local'),
  };

  let server;

  try {
    console.log('[local-dev] MongoDB efêmero iniciado.');
    console.log('[local-dev] Banco isolado: equinox_local');
    console.log('[local-dev] Executando seed local...');
    await run(process.execPath, ['node_modules/ts-node/dist/bin.js', 'src/workers/runWorker.ts'], env);

    env.EQUINOX_ALLOW_DATABASE_WRITES = 'false';
    console.log('[local-dev] Seed concluído. Iniciando API em modo read-only.');
    server = spawn(process.execPath, ['node_modules/ts-node/dist/bin.js', 'src/server.ts'], {
      env,
      stdio: 'inherit',
      windowsHide: false,
    });

    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.once('exit', (code, signal) => {
        if (code === 0 || signal === 'SIGINT' || signal === 'SIGTERM') {
          resolve();
          return;
        }

        reject(new Error(`API local encerrou com code=${code ?? 'null'} signal=${signal ?? 'null'}`));
      });
    });
  } finally {
    if (server && !server.killed) {
      server.kill('SIGTERM');
    }

    await replSet.stop();
    console.log('[local-dev] MongoDB efêmero encerrado. Nenhum banco externo foi utilizado.');
  }
}

main().catch(error => {
  console.error('[local-dev] Falha:', error);
  process.exitCode = 1;
});
