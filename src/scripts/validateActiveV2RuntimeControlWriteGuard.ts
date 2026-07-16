import { assertActiveV2CircuitBreakerWriteRoleAllowed } from '../services/competitive-data/runtime-control/ActiveV2RuntimeControlWriteGuard';

async function runTests(): Promise<void> {
  const originalFlag = process.env.EQUINOX_ACTIVE_V2_CIRCUIT_BREAKER_WRITE_ROLE;
  const originalGeneralWrites = process.env.EQUINOX_ALLOW_DATABASE_WRITES;

  try {
    // --- Caso de Teste 1: sem nenhuma flag -> bloqueado ---
    delete process.env.EQUINOX_ACTIVE_V2_CIRCUIT_BREAKER_WRITE_ROLE;
    delete process.env.EQUINOX_ALLOW_DATABASE_WRITES;
    try {
      assertActiveV2CircuitBreakerWriteRoleAllowed({ operation: 'test' });
      throw new Error('Test 1 failed: expected write to be forbidden without any flag');
    } catch (error: any) {
      if (!error.message.includes('CIRCUIT_BREAKER_WRITE_FORBIDDEN')) throw error;
    }

    // --- Caso de Teste 2: apenas a flag geral de escrita NÃO é suficiente ---
    process.env.EQUINOX_ALLOW_DATABASE_WRITES = 'true';
    delete process.env.EQUINOX_ACTIVE_V2_CIRCUIT_BREAKER_WRITE_ROLE;
    try {
      assertActiveV2CircuitBreakerWriteRoleAllowed({ operation: 'test' });
      throw new Error('Test 2 failed: expected general write flag alone to be insufficient');
    } catch (error: any) {
      if (!error.message.includes('CIRCUIT_BREAKER_WRITE_FORBIDDEN')) throw error;
    }

    // --- Caso de Teste 3: a flag dedicada permite a escrita, mesmo sem a flag geral ---
    delete process.env.EQUINOX_ALLOW_DATABASE_WRITES;
    process.env.EQUINOX_ACTIVE_V2_CIRCUIT_BREAKER_WRITE_ROLE = 'true';
    assertActiveV2CircuitBreakerWriteRoleAllowed({ operation: 'test' });

    console.log('[Equinox] Active V2 circuit breaker write guard validation passed.');
  } finally {
    if (originalFlag === undefined) delete process.env.EQUINOX_ACTIVE_V2_CIRCUIT_BREAKER_WRITE_ROLE;
    else process.env.EQUINOX_ACTIVE_V2_CIRCUIT_BREAKER_WRITE_ROLE = originalFlag;
    if (originalGeneralWrites === undefined) delete process.env.EQUINOX_ALLOW_DATABASE_WRITES;
    else process.env.EQUINOX_ALLOW_DATABASE_WRITES = originalGeneralWrites;
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
