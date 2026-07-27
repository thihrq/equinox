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

export async function testCharizardWhimsicottE2E() {
  if (mongoose.connection.readyState !== 1) {
    await connectDatabase();
  }

  const service = new LeadStrategyRecommendationService();
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

  const durationMs = Date.now() - startedAt;

  assert(
    result.strategies.length >= 1,
    'Deve retornar ao menos uma estratégia válida.',
  );

  const fullTeam = result.strategies[0].completions[0]?.fullTeam;

  assert(
    Array.isArray(fullTeam) && fullTeam.length === 6,
    'A estratégia recuperada deve possuir seis Pokémon.',
  );

  assert(
    result.strategies[0].teamEvaluation?.legal === true,
    'O time recuperado deve ser legal.',
  );

  assert(
    result.strategies[0].teamEvaluation?.strategyComplete === true,
    'A estratégia deve estar completa.',
  );

  assert(
    result.runtimeDiagnostics.cache.hits > 0 || result.runtimeDiagnostics.cache.misses > 0,
    'O cache de requisição deve registrar consultas.',
  );

  assert(
    durationMs < 10_000,
    `A execução deve ficar abaixo de 10s; obtido ${durationMs}ms.`,
  );
}

if (require.main === module) {
  testCharizardWhimsicottE2E()
    .then(async () => {
      await mongoose.disconnect();
      console.log('✅ Charizard + Whimsicott E2E passou.');
    })
    .catch(async error => {
      console.error(error);
      await mongoose.disconnect();
      process.exit(1);
    });
}
