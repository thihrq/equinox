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

export async function testFailClosedE2E() {
  if (mongoose.connection.readyState !== 1) {
    await connectDatabase();
  }

  const service = new LeadStrategyRecommendationService();

  // Passing an illegal/impossible combination lead to force fail-closed
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

  assert(
    result.strategies.length === 0,
    'Não deve aceitar estratégias para lead sem capacidade.',
  );

  assert(
    result.noStrategy !== undefined,
    'Deve incluir diagnósticos estruturados em noStrategy.',
  );
}

if (require.main === module) {
  testFailClosedE2E()
    .then(async () => {
      await mongoose.disconnect();
      console.log('✅ Fail-closed E2E passou.');
    })
    .catch(async error => {
      console.error(error);
      await mongoose.disconnect();
      process.exit(1);
    });
}
