import { assertActiveV2CanaryConfigWriteRoleAllowed } from '../services/competitive-data/runtime-control/ActiveV2CanaryConfigWriteGuard';

async function runTests(): Promise<void> {
  const originalFlag = process.env.EQUINOX_ACTIVE_V2_CANARY_CONFIG_WRITE_ROLE;
  const originalGeneralWrites = process.env.EQUINOX_ALLOW_DATABASE_WRITES;

  try {
    // --- Caso de Teste 1: sem flag -> bloqueado ---
    delete process.env.EQUINOX_ACTIVE_V2_CANARY_CONFIG_WRITE_ROLE;
    try {
      assertActiveV2CanaryConfigWriteRoleAllowed({ operation: 'test' });
      throw new Error('Test 1 failed: expected write to be forbidden without the flag');
    } catch (error: any) {
      if (!error.message.includes('CANARY_CONFIG_WRITE_FORBIDDEN')) throw error;
    }

    // --- Caso de Teste 2: flag geral de escrita sozinha não é suficiente ---
    process.env.EQUINOX_ALLOW_DATABASE_WRITES = 'true';
    delete process.env.EQUINOX_ACTIVE_V2_CANARY_CONFIG_WRITE_ROLE;
    try {
      assertActiveV2CanaryConfigWriteRoleAllowed({ operation: 'test' });
      throw new Error('Test 2 failed: expected general write flag alone to be insufficient');
    } catch (error: any) {
      if (!error.message.includes('CANARY_CONFIG_WRITE_FORBIDDEN')) throw error;
    }

    // --- Caso de Teste 3: flag dedicada permite a escrita ---
    process.env.EQUINOX_ACTIVE_V2_CANARY_CONFIG_WRITE_ROLE = 'true';
    assertActiveV2CanaryConfigWriteRoleAllowed({ operation: 'test' });

    console.log('[Equinox] Active V2 canary config write guard validation passed.');
  } finally {
    if (originalFlag === undefined) delete process.env.EQUINOX_ACTIVE_V2_CANARY_CONFIG_WRITE_ROLE;
    else process.env.EQUINOX_ACTIVE_V2_CANARY_CONFIG_WRITE_ROLE = originalFlag;
    if (originalGeneralWrites === undefined) delete process.env.EQUINOX_ALLOW_DATABASE_WRITES;
    else process.env.EQUINOX_ALLOW_DATABASE_WRITES = originalGeneralWrites;
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
