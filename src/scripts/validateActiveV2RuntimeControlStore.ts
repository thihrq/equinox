import { readActiveV2RuntimeControl, writeActiveV2RuntimeControl } from '../services/competitive-data/runtime-control/ActiveV2RuntimeControlStore';

function makeConnection(options: {
  existingDoc?: any | null;
  updateResult?: any;
  failOnFind?: boolean;
  failOnUpdate?: boolean;
}): any {
  return {
    db: {
      collection: () => ({
        findOne: async () => {
          if (options.failOnFind) throw new Error('boom');
          return options.existingDoc ?? null;
        },
        updateOne: async () => {
          if (options.failOnUpdate) throw new Error('boom');
          return options.updateResult ?? { matchedCount: 0, upsertedCount: 0, upsertedId: null };
        },
      }),
    },
  };
}

async function runTests(): Promise<void> {
  const originalFlag = process.env.EQUINOX_ACTIVE_V2_CIRCUIT_BREAKER_WRITE_ROLE;

  try {
    // --- Caso de Teste 1: leitura sem documento existente retorna estado padrão seguro ---
    const defaultState = await readActiveV2RuntimeControl(makeConnection({ existingDoc: null }));
    if (defaultState.mode !== 'normal' || defaultState.version !== 0) {
      throw new Error('Test 1 failed: expected default safe state (normal, version 0)');
    }

    // --- Caso de Teste 2: leitura mapeia documento existente ---
    const existing = {
      mode: 'force-baseline',
      reasonCode: 'AUTOMATIC_V2_ERROR_RATE',
      triggeredBy: 'automatic',
      triggeredAt: '2026-07-15T12:00:00.000Z',
      metricsWindowId: 'window-1',
      requiresManualRecovery: true,
      version: 3,
    };
    const readState = await readActiveV2RuntimeControl(makeConnection({ existingDoc: existing }));
    if (readState.mode !== 'force-baseline' || readState.version !== 3) {
      throw new Error('Test 2 failed: expected mapped state from existing document');
    }

    // --- Caso de Teste 3: escrita sem a role dedicada é bloqueada ---
    delete process.env.EQUINOX_ACTIVE_V2_CIRCUIT_BREAKER_WRITE_ROLE;
    try {
      await writeActiveV2RuntimeControl(makeConnection({}), 0, {
        mode: 'force-baseline',
        reasonCode: 'MANUAL_OPERATOR_TRIP',
        triggeredBy: 'manual',
        triggeredAt: new Date().toISOString(),
        metricsWindowId: null,
        requiresManualRecovery: true,
      });
      throw new Error('Test 3 failed: expected write to be forbidden without write-role flag');
    } catch (error: any) {
      if (!error.message.includes('CIRCUIT_BREAKER_WRITE_FORBIDDEN')) throw error;
    }

    process.env.EQUINOX_ACTIVE_V2_CIRCUIT_BREAKER_WRITE_ROLE = 'true';

    // --- Caso de Teste 4: primeira escrita (version=0) usa upsert e retorna version=1 ---
    const upserted = await writeActiveV2RuntimeControl(
      makeConnection({ updateResult: { matchedCount: 0, upsertedCount: 1, upsertedId: 'x' } }),
      0,
      { mode: 'force-baseline', reasonCode: 'MANUAL_OPERATOR_TRIP', triggeredBy: 'manual', triggeredAt: new Date().toISOString(), metricsWindowId: null, requiresManualRecovery: true }
    );
    if (upserted.version !== 1) throw new Error('Test 4 failed: expected version 1 after first upsert write');

    // --- Caso de Teste 5: escrita concorrente bem-sucedida incrementa a versão ---
    const updated = await writeActiveV2RuntimeControl(
      makeConnection({ updateResult: { matchedCount: 1, upsertedCount: 0, upsertedId: null } }),
      3,
      { mode: 'normal', reasonCode: null, triggeredBy: null, triggeredAt: null, metricsWindowId: null, requiresManualRecovery: false }
    );
    if (updated.version !== 4) throw new Error('Test 5 failed: expected version 4 after successful conditional update');

    // --- Caso de Teste 6: versão desatualizada gera CIRCUIT_BREAKER_WRITE_CONFLICT ---
    try {
      await writeActiveV2RuntimeControl(
        makeConnection({ updateResult: { matchedCount: 0, upsertedCount: 0, upsertedId: null } }),
        3,
        { mode: 'normal', reasonCode: null, triggeredBy: null, triggeredAt: null, metricsWindowId: null, requiresManualRecovery: false }
      );
      throw new Error('Test 6 failed: expected CIRCUIT_BREAKER_WRITE_CONFLICT on stale version');
    } catch (error: any) {
      if (!error.message.includes('CIRCUIT_BREAKER_WRITE_CONFLICT')) throw error;
    }

    // --- Caso de Teste 7: falha de leitura propaga CIRCUIT_BREAKER_READ_FAILED ---
    try {
      await readActiveV2RuntimeControl(makeConnection({ failOnFind: true }));
      throw new Error('Test 7 failed: expected read failure to throw');
    } catch (error: any) {
      if (!error.message.includes('CIRCUIT_BREAKER_READ_FAILED')) throw error;
    }

    console.log('[Equinox] Active V2 runtime control store validation passed.');
  } finally {
    if (originalFlag === undefined) delete process.env.EQUINOX_ACTIVE_V2_CIRCUIT_BREAKER_WRITE_ROLE;
    else process.env.EQUINOX_ACTIVE_V2_CIRCUIT_BREAKER_WRITE_ROLE = originalFlag;
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
