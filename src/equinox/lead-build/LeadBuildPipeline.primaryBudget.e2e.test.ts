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

export async function testPrimaryBudgetStarvingRecoveryE2E() {
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

  assert(
    diagnostics !== undefined,
    'O serviço deve retornar runtimeDiagnostics na resposta.',
  );

  assert(
    diagnostics.primarySearchMs <= 6000,
    `Primary search não pode ultrapassar o orçamento reservado de 6.000ms. Atual: ${diagnostics.primarySearchMs}ms`,
  );

  assert(
    diagnostics.totalDurationMs < 10000,
    `Lead Build deve terminar abaixo de 10.000ms. Atual: ${diagnostics.totalDurationMs}ms`,
  );

  assert(
    diagnostics.recoverySkippedReason !== 'NO_REMAINING_TIME_BUDGET',
    'Primary search não pode esgotar o tempo a ponto de impedir a execução do recovery.',
  );
}

if (require.main === module) {
  testPrimaryBudgetStarvingRecoveryE2E()
    .then(async () => {
      await mongoose.disconnect();
      console.log('✅ Primary budget E2E test passou.');
    })
    .catch(async error => {
      console.error(error);
      await mongoose.disconnect();
      process.exit(1);
    });
}
