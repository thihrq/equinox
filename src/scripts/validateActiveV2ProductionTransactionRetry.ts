import {
  runInTransactionWithRetry,
  hasErrorLabel,
  isKnownAtlasTransientQuotaCheckError,
} from '../services/competitive-data/publication/ActiveV2ProductionTransactionRetry';

function makeTransientError(message = 'transient'): Error {
  const error = new Error(message) as Error & { hasErrorLabel: (label: string) => boolean };
  error.hasErrorLabel = (label: string) => label === 'TransientTransactionError';
  return error;
}

function makeNonTransientError(message = 'permanent'): Error {
  const error = new Error(message) as Error & { hasErrorLabel: (label: string) => boolean };
  error.hasErrorLabel = () => false;
  return error;
}

interface FakeSession {
  startTransaction: () => void;
  commitTransaction: () => Promise<void>;
  abortTransaction: () => Promise<void>;
  endSession: () => void;
  inTransaction: () => boolean;
}

function makeFakeConnection(sessionsCreated: FakeSession[]) {
  return {
    startSession: async () => {
      let active = false;
      const session: FakeSession = {
        startTransaction: () => {
          active = true;
        },
        commitTransaction: async () => {
          active = false;
        },
        abortTransaction: async () => {
          active = false;
        },
        endSession: () => {},
        inTransaction: () => active,
      };
      sessionsCreated.push(session);
      return session;
    },
  } as any;
}

async function runTests(): Promise<void> {
  // --- Caso de Teste 1: hasErrorLabel identifica corretamente o rotulo ---
  const transient = makeTransientError();
  const nonTransient = makeNonTransientError();
  if (!hasErrorLabel(transient, 'TransientTransactionError')) {
    throw new Error('Test 1 failed: expected transient error to carry TransientTransactionError label');
  }
  if (hasErrorLabel(nonTransient, 'TransientTransactionError')) {
    throw new Error('Test 1 failed: expected non-transient error to not carry the label');
  }
  if (hasErrorLabel({}, 'TransientTransactionError') || hasErrorLabel(null, 'TransientTransactionError')) {
    throw new Error('Test 1 failed: expected non-error-like values to safely return false');
  }

  // --- Caso de Teste 2: sucesso na primeira tentativa nao gera retry ---
  const sessions1: FakeSession[] = [];
  const conn1 = makeFakeConnection(sessions1);
  let onRetryCalls1 = 0;
  const result1 = await runInTransactionWithRetry(conn1, async () => 'ok', {
    retryDelayMs: 1,
    onRetry: () => onRetryCalls1++,
  });
  if (result1 !== 'ok') throw new Error('Test 2 failed: expected result "ok"');
  if (sessions1.length !== 1) throw new Error(`Test 2 failed: expected exactly 1 session, got ${sessions1.length}`);
  if (onRetryCalls1 !== 0) throw new Error('Test 2 failed: expected zero retries on first-attempt success');

  // --- Caso de Teste 3: TransientTransactionError e' retentado ate' funcionar ---
  const sessions2: FakeSession[] = [];
  const conn2 = makeFakeConnection(sessions2);
  let attemptCount2 = 0;
  let onRetryCalls2 = 0;
  const result2 = await runInTransactionWithRetry(
    conn2,
    async () => {
      attemptCount2++;
      if (attemptCount2 < 3) throw makeTransientError();
      return 'succeeded-on-third-try';
    },
    { retryDelayMs: 1, onRetry: () => onRetryCalls2++ }
  );
  if (result2 !== 'succeeded-on-third-try') throw new Error('Test 3 failed: expected success on third attempt');
  if (attemptCount2 !== 3) throw new Error(`Test 3 failed: expected 3 attempts, got ${attemptCount2}`);
  if (sessions2.length !== 3) throw new Error(`Test 3 failed: expected 3 sessions created (nova sessao por tentativa), got ${sessions2.length}`);
  if (onRetryCalls2 !== 2) throw new Error(`Test 3 failed: expected 2 onRetry calls, got ${onRetryCalls2}`);

  // --- Caso de Teste 4: erro nao-transiente propaga imediatamente, sem retry ---
  const sessions3: FakeSession[] = [];
  const conn3 = makeFakeConnection(sessions3);
  let attemptCount3 = 0;
  let threw3 = false;
  try {
    await runInTransactionWithRetry(
      conn3,
      async () => {
        attemptCount3++;
        throw makeNonTransientError('lineage failure');
      },
      { retryDelayMs: 1 }
    );
  } catch (error) {
    threw3 = true;
    if (!(error instanceof Error) || error.message !== 'lineage failure') {
      throw new Error(`Test 4 failed: expected the original error to propagate, got: ${error}`);
    }
  }
  if (!threw3) throw new Error('Test 4 failed: expected error to propagate');
  if (attemptCount3 !== 1) throw new Error(`Test 4 failed: expected exactly 1 attempt (no retry), got ${attemptCount3}`);

  // --- Caso de Teste 5: esgotar o teto de tentativas propaga o ultimo erro transiente ---
  const sessions4: FakeSession[] = [];
  const conn4 = makeFakeConnection(sessions4);
  let attemptCount4 = 0;
  let threw4 = false;
  try {
    await runInTransactionWithRetry(
      conn4,
      async () => {
        attemptCount4++;
        throw makeTransientError('sempre falha');
      },
      { retryDelayMs: 1, maxRetries: 3 }
    );
  } catch (error) {
    threw4 = true;
    if (!(error instanceof Error) || error.message !== 'sempre falha') {
      throw new Error(`Test 5 failed: expected the last transient error to propagate, got: ${error}`);
    }
  }
  if (!threw4) throw new Error('Test 5 failed: expected error to propagate after exhausting retries');
  if (attemptCount4 !== 3) throw new Error(`Test 5 failed: expected exactly maxRetries=3 attempts, got ${attemptCount4}`);

  // --- Caso de Teste 6: sessao sempre commitada em sucesso, abortada em falha ---
  const sessions5: FakeSession[] = [];
  const conn5 = makeFakeConnection(sessions5);
  await runInTransactionWithRetry(conn5, async () => 'ok', { retryDelayMs: 1 });
  if (sessions5[0].inTransaction()) throw new Error('Test 6 failed: expected session to be out of transaction after commit');

  // --- Caso de Teste 7: reconhece o erro de checagem de quota transitoria do Atlas M0/Flex ---
  const atlasQuotaError = new Error(
    'Error determining if update will go over space quota: Error computing current atlas size: internal atlas error checking things: Failure getting dbStats: (MaxTimeMSExpired) operation exceeded time limit: context deadline exceeded'
  );
  if (!isKnownAtlasTransientQuotaCheckError(atlasQuotaError)) {
    throw new Error('Test 7 failed: expected the real Atlas quota-check error message to be recognized as retryable');
  }
  const unrelatedError = new Error('RUN_ID_CONTENT_CONFLICT: something else entirely');
  if (isKnownAtlasTransientQuotaCheckError(unrelatedError)) {
    throw new Error('Test 7 failed: expected an unrelated error message to NOT be recognized as the Atlas quota-check error');
  }

  // --- Caso de Teste 8: retry tambem dispara para o erro de quota do Atlas (sem hasErrorLabel) ---
  const sessions6: FakeSession[] = [];
  const conn6 = makeFakeConnection(sessions6);
  let attemptCount6 = 0;
  let onRetryCalls6 = 0;
  const result6 = await runInTransactionWithRetry(
    conn6,
    async () => {
      attemptCount6++;
      if (attemptCount6 < 2) {
        throw new Error(
          'Error determining if update will go over space quota: Error computing current atlas size: internal atlas error checking things: Failure getting dbStats: (MaxTimeMSExpired) operation exceeded time limit: context deadline exceeded'
        );
      }
      return 'succeeded-after-atlas-quota-retry';
    },
    { retryDelayMs: 1, onRetry: () => onRetryCalls6++ }
  );
  if (result6 !== 'succeeded-after-atlas-quota-retry') throw new Error('Test 8 failed: expected success after retrying the Atlas quota-check error');
  if (attemptCount6 !== 2) throw new Error(`Test 8 failed: expected 2 attempts, got ${attemptCount6}`);
  if (onRetryCalls6 !== 1) throw new Error(`Test 8 failed: expected 1 onRetry call, got ${onRetryCalls6}`);

  console.log('[Equinox] Active V2 production transaction retry validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
