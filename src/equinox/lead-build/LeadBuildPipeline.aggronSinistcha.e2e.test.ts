process.env.EQUINOX_DATA_MODE = 'mongo';

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDatabase } from '../../config/database';
import { LeadStrategyRecommendationService } from '../../services/LeadStrategyRecommendationService';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

export async function testAggronSinistchaE2E() {
  if (mongoose.connection.readyState !== 1) {
    await connectDatabase();
  }

  const service = new LeadStrategyRecommendationService();

  const result = await service.execute({
    lead: [
      { name: 'Aggron-Mega' },
      { name: 'Sinistcha' },
    ],
    format: 'champions_reg_m_b_doubles',
    leadMode: 'fixed-lead',
    allowLegendaries: false,
    teamIdentity: 'balanced',
  });

  assert(
    result.strategies.length >= 1,
    'Aggron + Sinistcha deve retornar ao menos uma estratégia válida.',
  );

  const fullTeam = result.strategies[0].completions[0]?.fullTeam;
  assert(
    Array.isArray(fullTeam) && fullTeam.length === 6,
    'O time deve conter 6 Pokémon.',
  );
}

if (require.main === module) {
  testAggronSinistchaE2E()
    .then(async () => {
      await mongoose.disconnect();
      console.log('✅ Aggron + Sinistcha E2E passou.');
    })
    .catch(async error => {
      console.error(error);
      await mongoose.disconnect();
      process.exit(1);
    });
}
