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

export async function runRecoveryWithoutFinalistTest() {
  if (mongoose.connection.readyState !== 1) {
    await connectDatabase();
  }

  const service = new LeadStrategyRecommendationService();

  console.log('[Test Sprint 3] Testando recovery sem finalista completo prévio...');

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

  console.log(`[Test Sprint 3] Concluído. Resposta de fail-closed tratada. Warning count: ${result.warnings.length}`);

  const diag = result.runtimeDiagnostics ?? {};
  assert(diag.recoveryExecuted === true || result.strategies.length === 0, 'Deve executar recovery ou responder com fail-closed limpo.');
}

if (require.main === module) {
  runRecoveryWithoutFinalistTest()
    .then(async () => {
      await mongoose.disconnect();
      console.log('✅ LeadBuildPipeline.recoveryWithoutFinalist.e2e.test PASS');
    })
    .catch(async (err) => {
      console.error('❌ LeadBuildPipeline.recoveryWithoutFinalist.e2e.test FAIL:', err);
      await mongoose.disconnect();
      process.exit(1);
    });
}
