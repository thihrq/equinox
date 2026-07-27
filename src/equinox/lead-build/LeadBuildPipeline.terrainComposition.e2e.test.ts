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

export async function runTerrainCompositionTest() {
  if (mongoose.connection.readyState !== 1) {
    await connectDatabase();
  }

  const service = new LeadStrategyRecommendationService();

  console.log('[Test Sprint 2] Testando caminho de composicao Terrain (Indeedee-F + Hatterene)...');

  const startedAt = Date.now();
  const result = await service.execute({
    lead: [
      { name: 'Indeedee-F' },
      { name: 'Hatterene' },
    ],
    format: 'champions_reg_m_b_doubles',
    leadMode: 'fixed-lead',
    allowLegendaries: false,
    teamIdentity: 'balanced',
  });
  const elapsed = Date.now() - startedAt;

  console.log(`[Test Sprint 2] Concluído em ${elapsed}ms. Estratégias retornadas: ${result.strategies.length}`);

  assert(result.strategies.length >= 1, 'Deve retornar ao menos 1 estratégia para Indeedee-F + Hatterene.');
  const firstStrat = result.strategies[0];
  assert(firstStrat.completions.length >= 1, 'Primeira estratégia deve possuir ao menos 1 time completo.');
  assert(firstStrat.completions[0].fullTeam.length === 6, 'O time retornado deve possuir 6 membros.');
}

if (require.main === module) {
  runTerrainCompositionTest()
    .then(async () => {
      await mongoose.disconnect();
      console.log('✅ LeadBuildPipeline.terrainComposition.e2e.test PASS');
    })
    .catch(async (err) => {
      console.error('❌ LeadBuildPipeline.terrainComposition.e2e.test FAIL:', err);
      await mongoose.disconnect();
      process.exit(1);
    });
}
