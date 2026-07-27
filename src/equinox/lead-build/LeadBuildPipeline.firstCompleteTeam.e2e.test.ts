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

export async function runFirstCompleteTeamTest() {
  if (mongoose.connection.readyState !== 1) {
    await connectDatabase();
  }

  const service = new LeadStrategyRecommendationService();

  console.log('[Test Sprint 1] Testando caminho de produção Charizard-Mega-Y + Whimsicott...');

  const startedAt = Date.now();
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
  const elapsed = Date.now() - startedAt;

  console.log(`[Test Sprint 1] Concluído em ${elapsed}ms. Estratégias retornadas: ${result.strategies.length}`);

  assert(result.strategies.length >= 1, 'Deve retornar ao menos 1 estratégia para Charizard-Mega-Y + Whimsicott.');
  const firstStrat = result.strategies[0];
  assert(firstStrat.completions.length >= 1, 'Primeira estratégia deve possuir ao menos 1 time completo.');
  assert(firstStrat.completions[0].fullTeam.length === 6, 'O time retornado deve possuir 6 membros.');

  const diag = result.runtimeDiagnostics ?? {};
  assert(diag.phaseBudgetInstanceCount === 1, 'Deve haver exatamente 1 instância de relógio/orçamento por requisição.');
  assert(diag.allEligibleStrategiesReceivedFirstPass === true, 'Todas as estratégias elegíveis devem receber ao menos uma passagem inicial.');
}

if (require.main === module) {
  runFirstCompleteTeamTest()
    .then(async () => {
      await mongoose.disconnect();
      console.log('✅ LeadBuildPipeline.firstCompleteTeam.e2e.test PASS');
    })
    .catch(async (err) => {
      console.error('❌ LeadBuildPipeline.firstCompleteTeam.e2e.test FAIL:', err);
      await mongoose.disconnect();
      process.exit(1);
    });
}
