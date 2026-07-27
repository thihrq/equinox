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

export async function testNoRecoveryOnSuccessE2E() {
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
    'Deve retornar ao menos 1 estratégia.',
  );

  assert(
    result.runtimeDiagnostics.recoverySearchMs === 0 || result.strategies[0].recoveryState?.executed === false,
    'Recovery não deve ser executado quando a busca primária for bem-sucedida.',
  );
}

if (require.main === module) {
  testNoRecoveryOnSuccessE2E()
    .then(async () => {
      await mongoose.disconnect();
      console.log('✅ No recovery on primary success E2E passou.');
    })
    .catch(async error => {
      console.error(error);
      await mongoose.disconnect();
      process.exit(1);
    });
}
