import { readActiveV2CanaryConfig, writeActiveV2CanaryConfig } from '../services/competitive-data/runtime-control/ActiveV2CanaryConfigStore';
import type { ActiveV2CanaryConfig } from '../services/competitive-data/runtime-control/ActiveV2CanaryConfigTypes';

function makeConnection(options: { existingDoc?: any | null; updateResult?: any }): any {
  return {
    db: {
      collection: () => ({
        findOne: async () => options.existingDoc ?? null,
        updateOne: async () => options.updateResult ?? { matchedCount: 0, upsertedCount: 0, upsertedId: null },
      }),
    },
  };
}

async function runTests(): Promise<void> {
  const originalFlag = process.env.EQUINOX_ACTIVE_V2_CANARY_CONFIG_WRITE_ROLE;

  try {
    // --- Caso de Teste 1: leitura sem documento retorna estado padrão (mode=off) ---
    const defaultConfig = await readActiveV2CanaryConfig(makeConnection({ existingDoc: null }));
    if (defaultConfig.mode !== 'off' || defaultConfig.version !== 0) {
      throw new Error('Test 1 failed: expected default config mode=off, version=0');
    }

    delete process.env.EQUINOX_ACTIVE_V2_CANARY_CONFIG_WRITE_ROLE;

    // --- Caso de Teste 2: escrita sem a role dedicada é bloqueada ---
    try {
      await writeActiveV2CanaryConfig(makeConnection({}), defaultConfig, {
        mode: 'shadow',
        percentage: null,
        canaryCampaignId: 'campaign-1',
        seed: 'seed-1',
        windowStartedAt: new Date().toISOString(),
        windowEndedAt: null,
      });
      throw new Error('Test 2 failed: expected write to be forbidden without write-role flag');
    } catch (error: any) {
      if (!error.message.includes('CANARY_CONFIG_WRITE_FORBIDDEN')) throw error;
    }

    process.env.EQUINOX_ACTIVE_V2_CANARY_CONFIG_WRITE_ROLE = 'true';

    // --- Caso de Teste 3: primeira campanha (seed+campaignId juntos) é permitida ---
    const firstWrite = await writeActiveV2CanaryConfig(
      makeConnection({ updateResult: { matchedCount: 0, upsertedCount: 1, upsertedId: 'x' } }),
      defaultConfig,
      { mode: 'shadow', percentage: null, canaryCampaignId: 'campaign-1', seed: 'seed-1', windowStartedAt: new Date().toISOString(), windowEndedAt: null }
    );
    if (firstWrite.version !== 1) throw new Error('Test 3 failed: expected version 1 after first campaign write');

    // --- Caso de Teste 4: mudar seed SEM mudar canaryCampaignId é rejeitado ---
    const currentConfig: ActiveV2CanaryConfig = { mode: 'percentage', percentage: 10, canaryCampaignId: 'campaign-1', seed: 'seed-1', windowStartedAt: new Date().toISOString(), windowEndedAt: null, version: 2 };
    try {
      await writeActiveV2CanaryConfig(makeConnection({ updateResult: { matchedCount: 1 } }), currentConfig, {
        mode: 'percentage',
        percentage: 25,
        canaryCampaignId: 'campaign-1',
        seed: 'seed-2',
        windowStartedAt: new Date().toISOString(),
        windowEndedAt: null,
      });
      throw new Error('Test 4 failed: expected seed change without new campaign to be rejected');
    } catch (error: any) {
      if (!error.message.includes('SEED_CHANGE_REQUIRES_NEW_CAMPAIGN')) throw error;
    }

    // --- Caso de Teste 5: mudar seed JUNTO com novo canaryCampaignId é permitido ---
    const newCampaignWrite = await writeActiveV2CanaryConfig(
      makeConnection({ updateResult: { matchedCount: 1, upsertedCount: 0, upsertedId: null } }),
      currentConfig,
      { mode: 'percentage', percentage: 5, canaryCampaignId: 'campaign-2', seed: 'seed-2', windowStartedAt: new Date().toISOString(), windowEndedAt: null }
    );
    if (newCampaignWrite.canaryCampaignId !== 'campaign-2' || newCampaignWrite.version !== 3) {
      throw new Error('Test 5 failed: expected new campaign + seed change to be applied with incremented version');
    }

    // --- Caso de Teste 6: percentual pode mudar sem alterar a seed, sem erro ---
    const percentageBump = await writeActiveV2CanaryConfig(
      makeConnection({ updateResult: { matchedCount: 1 } }),
      currentConfig,
      { mode: 'percentage', percentage: 25, canaryCampaignId: 'campaign-1', seed: 'seed-1', windowStartedAt: currentConfig.windowStartedAt, windowEndedAt: null }
    );
    if (percentageBump.percentage !== 25) throw new Error('Test 6 failed: expected percentage bump to succeed without touching seed');

    // --- Caso de Teste 7: conflito de versão gera CANARY_CONFIG_WRITE_CONFLICT ---
    try {
      await writeActiveV2CanaryConfig(makeConnection({ updateResult: { matchedCount: 0, upsertedCount: 0, upsertedId: null } }), currentConfig, {
        mode: 'percentage',
        percentage: 25,
        canaryCampaignId: 'campaign-1',
        seed: 'seed-1',
        windowStartedAt: currentConfig.windowStartedAt,
        windowEndedAt: null,
      });
      throw new Error('Test 7 failed: expected CANARY_CONFIG_WRITE_CONFLICT on stale version');
    } catch (error: any) {
      if (!error.message.includes('CANARY_CONFIG_WRITE_CONFLICT')) throw error;
    }

    console.log('[Equinox] Active V2 canary config store validation passed.');
  } finally {
    if (originalFlag === undefined) delete process.env.EQUINOX_ACTIVE_V2_CANARY_CONFIG_WRITE_ROLE;
    else process.env.EQUINOX_ACTIVE_V2_CANARY_CONFIG_WRITE_ROLE = originalFlag;
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
