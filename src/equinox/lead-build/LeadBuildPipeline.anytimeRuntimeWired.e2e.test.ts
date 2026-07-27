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

export async function runAnytimeRuntimeWiredTest() {
  if (mongoose.connection.readyState !== 1) {
    await connectDatabase();
  }

  const service = new LeadStrategyRecommendationService();

  console.log('[Test Sprint v1.1.7] Testando integracao de runtime do Anytime Search...');

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

  const diag = result.runtimeDiagnostics ?? {};
  const counters = diag.invocationCounters ?? {};

  console.log('[Test Sprint v1.1.7] Invocations:', counters);

  assert(counters.anytimeCoordinatorInvocationCount === 1, 'AnytimeSearchCoordinator deve ter sido invocado exatamente 1 vez.');
  assert(counters.legacyExpandBeamInvocationCount === 0, 'O feixe legado expandBeam deve ter 0 invocacoes.');
  assert(diag.allEligibleStrategiesReceivedFirstPass === true, 'Todas as estrategias elegiveis devem ter recebido primeira passagem.');
  assert(result.strategies.length >= 1, 'Deve retornar ao menos 1 estrategia aprovada.');
  assert(result.strategies[0].completions[0].fullTeam.length === 6, 'O time retornado deve possuir 6 membros.');
}

if (require.main === module) {
  runAnytimeRuntimeWiredTest()
    .then(async () => {
      await mongoose.disconnect();
      console.log('✅ LeadBuildPipeline.anytimeRuntimeWired.e2e.test PASS');
    })
    .catch(async (err) => {
      console.error('❌ LeadBuildPipeline.anytimeRuntimeWired.e2e.test FAIL:', err);
      await mongoose.disconnect();
      process.exit(1);
    });
}
