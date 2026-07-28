process.env.EQUINOX_DATA_MODE = 'mongo';

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDatabase } from '../../config/database';
import { LeadStrategyRecommendationService } from '../../services/LeadStrategyRecommendationService';
import { DataSyncService } from '../../services/DataSyncService';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

export async function runAnytimeRuntimeWiredTest() {
  if (mongoose.connection.readyState !== 1) {
    await connectDatabase();
  }

  await DataSyncService.bootstrap();

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
  assert(counters.roundRobinSchedulerInvocationCount === 1, 'StrategyRoundRobinScheduler deve ter sido invocado exatamente 1 vez.');
  assert(counters.firstPassStrategyAttemptCount >= 2, 'firstPassStrategyAttemptCount deve contabilizar tentativas por estrategia.');
  assert(counters.capabilityIndexBuildCount === 1, 'CandidateCapabilityIndex deve ter sido construido exatamente 1 vez.');
  assert(counters.capabilityIndexReuseCount >= 1, 'CandidateCapabilityIndex deve ser reutilizado pelas estrategias elegiveis.');
  assert(counters.acceptedTeamWithoutAcceptanceDecision === 0, 'acceptedTeamWithoutAcceptanceDecision deve ser 0.');
  assert(counters.candidateQueryRawLimit <= 30, 'candidateQueryRawLimit deve ser <= 30.');
  assert(counters.candidateQueryReturnedCount <= 30, 'candidateQueryReturnedCount deve ser <= 30.');
  assert(diag.allEligibleStrategiesReceivedFirstPass === true, 'Todas as estrategias elegiveis devem ter recebido primeira passagem.');
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
