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

export async function testCandidatePoolReuseE2E() {
  if (mongoose.connection.readyState !== 1) {
    await connectDatabase();
  }

  const service = new LeadStrategyRecommendationService();

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

  const diagnostics = result.runtimeDiagnostics ?? (result as any).diagnostics;

  assert(diagnostics !== undefined, 'Deve conter runtimeDiagnostics.');
  assert(diagnostics.primaryCandidateFetchCount === 1, `Candidate fetch deve ser executado exatamente 1 vez. Atual: ${diagnostics.primaryCandidateFetchCount}`);
  assert(diagnostics.primaryCandidatePoolReused === true, 'Pool de candidatos deve ser reutilizado entre estratégias.');
}

if (require.main === module) {
  testCandidatePoolReuseE2E()
    .then(async () => {
      await mongoose.disconnect();
      console.log('✅ Candidate pool reuse E2E test passou.');
    })
    .catch(async error => {
      console.error(error);
      await mongoose.disconnect();
      process.exit(1);
    });
}
