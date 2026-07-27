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

  const diag = result.runtimeDiagnostics ?? {};
  const counters = diag.invocationCounters ?? {};
  console.log('[Test Sprint 3] Invocations:', counters);
  console.log(`[Test Sprint 3] Concluído. Warning count: ${result.warnings.length}`);

  assert(counters.incompleteRecoveryPlannerInvocationCount === 1, 'IncompleteSearchRecoveryPlanner deve ser invocado (1).');
  assert(counters.anytimeRecoveryCoordinatorInvocationCount === 1, 'AnytimeRecoveryCoordinator deve ser invocado (1).');
  assert(counters.legacyExpandBeamInvocationCount === 0, 'legacyExpandBeam deve ter 0 invocacoes.');
  assert(counters.candidateQueryRawLimit <= 30, 'candidateQueryRawLimit deve ser <= 30.');

  assert(
    diag.recoveryExecuted === true || result.strategies.length > 0 || (result as any).noStrategy !== undefined,
    'Deve executar recovery, produzir estrategias completas ou responder com fail-closed limpo.',
  );
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
