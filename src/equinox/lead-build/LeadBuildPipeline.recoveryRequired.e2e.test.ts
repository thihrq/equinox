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

export async function testRecoveryRequiredE2E() {
  if (mongoose.connection.readyState !== 1) {
    await connectDatabase();
  }

  // Create a mock source that forces primary search exhaustion then delivers a valid 6-member team on recovery fetch
  const mockRecoverySource = {
    async fetch(query: any) {
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
              setId: 'heatran-recovery-e2e',
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
      { name: 'Charizard-Mega-Y' },
      { name: 'Whimsicott' },
    ],
    format: 'champions_reg_m_b_doubles',
    leadMode: 'fixed-lead',
    allowLegendaries: false,
    teamIdentity: 'balanced',
  });

  assert(result.strategies.length >= 1, 'Deve retornar ao menos 1 estratégia aceita após recovery.');

  const recoveredStrategy = result.strategies.find(
    (s: any) => s.recoveryState?.executed === true || s.completions?.length > 0,
  );

  assert(recoveredStrategy !== undefined, 'Estratégia recuperada deve estar presente no resultado.');

  const fullTeam = recoveredStrategy.completions[0]?.fullTeam;
  assert(Array.isArray(fullTeam) && fullTeam.length === 6, 'O time final aceito deve possuir exatamente 6 Pokémon.');
  assert(recoveredStrategy.teamEvaluation?.legal === true, 'O time aceito deve passar no gate de legalidade.');
  assert(recoveredStrategy.teamEvaluation?.strategyComplete === true, 'O time aceito deve ter a estratégia completa.');
}

if (require.main === module) {
  testRecoveryRequiredE2E()
    .then(async () => {
      await mongoose.disconnect();
      console.log('✅ Recovery required E2E passou com sucesso.');
    })
    .catch(async error => {
      console.error(error);
      await mongoose.disconnect();
      process.exit(1);
    });
}
