process.env.EQUINOX_DATA_MODE = 'mongo';

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDatabase } from '../../config/database';
import { LeadStrategyRecommendationService } from '../../services/LeadStrategyRecommendationService';
import { AdaptiveStrategyRecovery } from './AdaptiveStrategyRecovery';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

export async function testRecoveryReachableE2E() {
  if (mongoose.connection.readyState !== 1) {
    await connectDatabase();
  }

  const mockRecoverySource = {
    async fetch() {
      return {
        candidates: [
          {
            name: 'Heatran',
            types: ['Steel', 'Fire'],
            item: 'Leftovers',
            ability: 'Flash Fire',
            nature: 'Modest',
            moves: ['Heat Wave', 'Earth Power', 'Flash Cannon', 'Protect'],
            competitiveSet: {
              name: 'Heatran',
              setId: 'heatran-reachable-e2e',
              setSource: 'mongodb-recovery',
              item: 'Leftovers',
              ability: 'Flash Fire',
              nature: 'Modest',
              moves: ['Heat Wave', 'Earth Power', 'Flash Cannon', 'Protect'],
              evs: { hp: 252, spa: 252, spe: 4 },
              ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
              types: ['Steel', 'Fire'],
              validation: { valid: true, errors: [] },
            },
          },
        ],
        rawCount: 1,
        sourceExhausted: false,
      };
    },
  };

  const service = new LeadStrategyRecommendationService();
  (service as any).adaptiveRecovery = new AdaptiveStrategyRecovery(mockRecoverySource as any);

  const result = await service.execute({
    lead: [
      { name: 'Unown' },
      { name: 'Magikarp' },
    ],
    format: 'champions_reg_m_b_doubles',
    leadMode: 'fixed-lead',
    allowLegendaries: false,
    teamIdentity: 'balanced',
  });

  const diagnostics = result.runtimeDiagnostics ?? (result as any).diagnostics;

  assert(diagnostics !== undefined, 'Deve retornar runtimeDiagnostics.');
  assert(diagnostics.recoveryExecuted === true, 'Recovery deve ter sido executado.');
  assert(diagnostics.recoveryTimeAvailableAtStartMs >= 2000, `Recovery deve ter tido tempo disponível >= 2.000ms. Atual: ${diagnostics.recoveryTimeAvailableAtStartMs}ms`);
}

if (require.main === module) {
  testRecoveryReachableE2E()
    .then(async () => {
      await mongoose.disconnect();
      console.log('✅ Recovery reachable E2E test passou.');
    })
    .catch(async error => {
      console.error(error);
      await mongoose.disconnect();
      process.exit(1);
    });
}
