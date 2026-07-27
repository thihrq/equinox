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

export async function testRecoveryFailsClosedE2E() {
  if (mongoose.connection.readyState !== 1) {
    await connectDatabase();
  }

  // Mock source that returns an illegal set during recovery to verify it gets rejected and fails closed
  const mockIllegalRecoverySource = {
    async fetch(query: any) {
      return {
        candidates: [
          {
            name: 'Pikachu',
            types: ['Electric'],
            item: 'Choice Band',
            ability: 'Static',
            nature: 'Jolly',
            moves: ['Protect', 'Thunderbolt', 'Volt Tackle', 'Iron Tail'], // Choice Band + Protect is illegal
            competitiveSet: {
              name: 'Pikachu',
              setId: 'pikachu-illegal-recovery',
              setSource: 'mongodb-recovery',
              item: 'Choice Band',
              ability: 'Static',
              nature: 'Jolly',
              moves: ['Protect', 'Thunderbolt', 'Volt Tackle', 'Iron Tail'],
              types: ['Electric'],
              validation: { valid: false, errors: ['Choice Band + Protect'] },
            },
          },
        ],
        rawCount: 1,
        sourceExhausted: true,
      };
    },
  };

  const service = new LeadStrategyRecommendationService();
  (service as any).adaptiveRecovery = new AdaptiveStrategyRecovery(mockIllegalRecoverySource as any);

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

  assert(result.strategies.length === 0, 'Nenhuma estratégia deve ser aceita se a recuperação falhar nos quality gates.');
  assert(result.noStrategy !== undefined, 'Deve projetar diagnósticos públicos noStrategy.');
}

if (require.main === module) {
  testRecoveryFailsClosedE2E()
    .then(async () => {
      await mongoose.disconnect();
      console.log('✅ Recovery fails closed E2E passou com sucesso.');
    })
    .catch(async error => {
      console.error(error);
      await mongoose.disconnect();
      process.exit(1);
    });
}
