process.env.EQUINOX_DATA_MODE = 'mongo';
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { connectDatabase } from '../../config/database';
import { LeadStrategyRecommendationService } from '../../services/LeadStrategyRecommendationService';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

export async function runAggronSinistchaRegressionTest() {
  console.log('[Equinox Test] Executando teste de regressão para Aggron-Mega + Sinistcha...');

  if (mongoose.connection.readyState !== 1) {
    await connectDatabase();
    console.log('📦 Conectado ao MongoDB para o teste de regressão.');
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

  console.log(`[Aggron-Mega + Sinistcha] Estratégias nativas retornadas: ${result.strategies.length}`);

  // Teste de regressão determinístico: espera que ao menos 1 estratégia seja retornada
  if (result.strategies.length === 0) {
    console.error(`[Aggron-Mega + Sinistcha REPRODUÇÃO CONFIRMADA] result.strategies.length === 0`);
  }

  // Asserção que deve falhar na Task 1 (espera > 0, recebe 0)
  assert(
    result.strategies.length > 0,
    `Esperado result.strategies.length > 0 para Aggron-Mega + Sinistcha, mas recebeu ${result.strategies.length}`,
  );
}

if (require.main === module) {
  runAggronSinistchaRegressionTest()
    .then(async () => {
      if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
      }
    })
    .catch(async err => {
      console.error('❌ Teste de regressão falhou conforme esperado:', err.message);
      if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
      }
      process.exit(1);
    });
}
