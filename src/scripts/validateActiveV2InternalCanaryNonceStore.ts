import { tryConsumeActiveV2CanaryNonce, verifyActiveV2CanaryNonceStoreIndexes } from '../services/competitive-data/internal-canary-auth/ActiveV2InternalCanaryNonceStore';

function makeConnection(options: { throwDuplicateKey?: boolean; throwOther?: boolean; indexes?: any[] }): any {
  return {
    db: {
      collection: () => ({
        insertOne: async () => {
          if (options.throwDuplicateKey) {
            const error: any = new Error('duplicate key');
            error.code = 11000;
            throw error;
          }
          if (options.throwOther) throw new Error('connection lost');
          return { acknowledged: true };
        },
        listIndexes: () => ({
          toArray: async () => options.indexes ?? [],
        }),
      }),
    },
  };
}

async function runTests(): Promise<void> {
  // --- Caso de Teste 1: primeiro uso de um nonce é aceito ---
  const firstUse = await tryConsumeActiveV2CanaryNonce(makeConnection({}), 'alice', 'nonce-1');
  if (!firstUse) throw new Error('Test 1 failed: expected first use of a nonce to be accepted');

  // --- Caso de Teste 2: chave duplicada (replay) é detectada e retorna false, sem lançar ---
  const replay = await tryConsumeActiveV2CanaryNonce(makeConnection({ throwDuplicateKey: true }), 'alice', 'nonce-1');
  if (replay) throw new Error('Test 2 failed: expected replayed nonce to be rejected');

  // --- Caso de Teste 3: falha de conexão real propaga CANARY_NONCE_STORE_FAILED ---
  try {
    await tryConsumeActiveV2CanaryNonce(makeConnection({ throwOther: true }), 'alice', 'nonce-2');
    throw new Error('Test 3 failed: expected non-duplicate-key error to propagate');
  } catch (error: any) {
    if (!error.message.includes('CANARY_NONCE_STORE_FAILED')) throw error;
  }

  // --- Caso de Teste 4: preflight de índice TTL falha quando o índice está ausente ---
  try {
    await verifyActiveV2CanaryNonceStoreIndexes(makeConnection({ indexes: [] }));
    throw new Error('Test 4 failed: expected missing TTL index to fail preflight');
  } catch (error: any) {
    if (!error.message.includes('CANARY_NONCE_INDEX_PREFLIGHT_FAILED')) throw error;
  }

  // --- Caso de Teste 5: preflight passa quando o índice TTL existe ---
  await verifyActiveV2CanaryNonceStoreIndexes(makeConnection({ indexes: [{ key: { consumedAt: 1 }, expireAfterSeconds: 600 }] }));

  console.log('[Equinox] Active V2 internal canary nonce store validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
