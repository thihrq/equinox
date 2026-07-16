import { validateActiveV2InternalCanaryRequest } from '../services/competitive-data/internal-canary-auth/ActiveV2InternalCanaryAuthValidator';
import { computeActiveV2InternalCanarySignature } from '../services/competitive-data/internal-canary-auth/ActiveV2InternalCanarySignature';

const SECRET_ENV = 'EQUINOX_ACTIVE_V2_CANARY_HMAC_SECRETS';
const ALLOWLIST_ENV = 'EQUINOX_ACTIVE_V2_CANARY_SUBJECT_ALLOWLIST';

const SUBJECT = 'alice';
const REQUEST_PATH = '/api/team-builder';
const SECRET_VALUE = 'test-secret-value';

function makeConnection(options: {
  nonceThrowsDuplicate?: boolean;
  rateLimitCount?: number;
} = {}): any {
  return {
    db: {
      collection: (name: string) => {
        if (name === 'active-v2-canary-nonce-store') {
          return {
            insertOne: async () => {
              if (options.nonceThrowsDuplicate) {
                const error: any = new Error('duplicate key');
                error.code = 11000;
                throw error;
              }
              return { acknowledged: true };
            },
          };
        }
        return {
          updateOne: async () => ({ matchedCount: 1, upsertedCount: 0 }),
          findOne: async () => ({ count: options.rateLimitCount ?? 1 }),
        };
      },
    },
  };
}

function setupEnv(): { originalSecrets: string | undefined; originalAllowlist: string | undefined } {
  const originalSecrets = process.env[SECRET_ENV];
  const originalAllowlist = process.env[ALLOWLIST_ENV];
  process.env[SECRET_ENV] = JSON.stringify([
    { secretId: 'v1', secret: SECRET_VALUE, activeFrom: '2020-01-01T00:00:00.000Z', activeUntil: null },
  ]);
  process.env[ALLOWLIST_ENV] = 'alice,bob';
  return { originalSecrets, originalAllowlist };
}

function restoreEnv(saved: { originalSecrets: string | undefined; originalAllowlist: string | undefined }): void {
  if (saved.originalSecrets === undefined) delete process.env[SECRET_ENV];
  else process.env[SECRET_ENV] = saved.originalSecrets;
  if (saved.originalAllowlist === undefined) delete process.env[ALLOWLIST_ENV];
  else process.env[ALLOWLIST_ENV] = saved.originalAllowlist;
}

async function runTests(): Promise<void> {
  const saved = setupEnv();

  try {
    const now = new Date();
    const timestamp = String(now.getTime());
    const nonce = 'nonce-happy-path';
    const validSignature = computeActiveV2InternalCanarySignature(SUBJECT, timestamp, nonce, REQUEST_PATH, SECRET_VALUE);

    // --- Caso de Teste 1: caminho feliz -> autorizado ---
    const authorized = await validateActiveV2InternalCanaryRequest(
      makeConnection(),
      { subject: SUBJECT, timestamp, nonce, signature: validSignature },
      REQUEST_PATH,
      now
    );
    if (!authorized.authorized) throw new Error(`Test 1 failed: expected happy path to be authorized, got denialReason=${authorized.denialReason}`);

    // --- Caso de Teste 2: headers ausentes ---
    const missingHeaders = await validateActiveV2InternalCanaryRequest(makeConnection(), { subject: SUBJECT }, REQUEST_PATH, now);
    if (missingHeaders.denialReason !== 'MISSING_HEADERS') throw new Error('Test 2 failed: expected MISSING_HEADERS');

    // --- Caso de Teste 3: timestamp fora da janela ---
    const staleTimestamp = String(now.getTime() - 60 * 60 * 1000); // 1h atrás
    const staleSignature = computeActiveV2InternalCanarySignature(SUBJECT, staleTimestamp, nonce, REQUEST_PATH, SECRET_VALUE);
    const outOfWindow = await validateActiveV2InternalCanaryRequest(
      makeConnection(),
      { subject: SUBJECT, timestamp: staleTimestamp, nonce, signature: staleSignature },
      REQUEST_PATH,
      now
    );
    if (outOfWindow.denialReason !== 'TIMESTAMP_OUT_OF_WINDOW') throw new Error('Test 3 failed: expected TIMESTAMP_OUT_OF_WINDOW');

    // --- Caso de Teste 4: subject fora da allowlist ---
    const mallorySignature = computeActiveV2InternalCanarySignature('mallory', timestamp, nonce, REQUEST_PATH, SECRET_VALUE);
    const notAllowlisted = await validateActiveV2InternalCanaryRequest(
      makeConnection(),
      { subject: 'mallory', timestamp, nonce, signature: mallorySignature },
      REQUEST_PATH,
      now
    );
    if (notAllowlisted.denialReason !== 'SUBJECT_NOT_ALLOWLISTED') throw new Error('Test 4 failed: expected SUBJECT_NOT_ALLOWLISTED');

    // --- Caso de Teste 5: assinatura inválida ---
    const invalidSignature = await validateActiveV2InternalCanaryRequest(
      makeConnection(),
      { subject: SUBJECT, timestamp, nonce, signature: 'deadbeef'.repeat(8) },
      REQUEST_PATH,
      now
    );
    if (invalidSignature.denialReason !== 'INVALID_SIGNATURE') throw new Error('Test 5 failed: expected INVALID_SIGNATURE');

    // --- Caso de Teste 6: nonce já utilizado (replay) ---
    const replayed = await validateActiveV2InternalCanaryRequest(
      makeConnection({ nonceThrowsDuplicate: true }),
      { subject: SUBJECT, timestamp, nonce, signature: validSignature },
      REQUEST_PATH,
      now
    );
    if (replayed.denialReason !== 'NONCE_ALREADY_USED') throw new Error('Test 6 failed: expected NONCE_ALREADY_USED');

    // --- Caso de Teste 7: rate limit excedido ---
    const rateLimited = await validateActiveV2InternalCanaryRequest(
      makeConnection({ rateLimitCount: 9999 }),
      { subject: SUBJECT, timestamp, nonce, signature: validSignature },
      REQUEST_PATH,
      now
    );
    if (rateLimited.denialReason !== 'RATE_LIMIT_EXCEEDED') throw new Error('Test 7 failed: expected RATE_LIMIT_EXCEEDED');

    // --- Caso de Teste 8: nenhum segredo ativo ---
    delete process.env[SECRET_ENV];
    const noSecret = await validateActiveV2InternalCanaryRequest(
      makeConnection(),
      { subject: SUBJECT, timestamp, nonce, signature: validSignature },
      REQUEST_PATH,
      now
    );
    if (noSecret.denialReason !== 'NO_ACTIVE_SECRET') throw new Error('Test 8 failed: expected NO_ACTIVE_SECRET');

    console.log('[Equinox] Active V2 internal canary auth validator (end-to-end) validation passed.');
  } finally {
    restoreEnv(saved);
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
