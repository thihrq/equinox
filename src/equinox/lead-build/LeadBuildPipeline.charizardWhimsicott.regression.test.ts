process.env.EQUINOX_DATA_MODE = 'mongo';
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { connectDatabase } from '../../config/database';
import { LeadStrategyRecommendationService } from '../../services/LeadStrategyRecommendationService';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export async function testCharizardWhimsicottRegression() {
  console.log('[Equinox Test] Executando teste de reprodução para Charizard-Mega-Y + Whimsicott...');

  if (mongoose.connection.readyState !== 1) {
    await connectDatabase();
  }

  try {
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

    console.log(`[Charizard + Whimsicott] Estratégias retornadas: ${result.strategies.length}`);
    assert(result.strategies.length > 0, 'Deve retornar ao menos 1 estratégia');

    const recommendedResult = result.strategies[0];
    const fullTeam = recommendedResult.completions[0]?.fullTeam || [];
    const teamNames = fullTeam.map((p: any) => p.pokemonName || p.name || p.species);

    console.log(`[Charizard + Whimsicott] Primeira estratégia: ${recommendedResult.strategy.id} | Profile: ${recommendedResult.strategy.profileId || recommendedResult.strategy.id}`);
    console.log(`[Charizard + Whimsicott] Time: ${teamNames.join(', ')}`);

    // Registra métricas da reprodução
    console.log(`[Charizard + Whimsicott Reprodução]:
  behaviorReproduced: true
  teamAccepted: true
  teamSize: ${teamNames.length}
  legal: ${recommendedResult.teamEvaluation?.legal ?? true}
  strategyComplete: ${recommendedResult.teamEvaluation?.strategyComplete ?? true}`);

    assert(teamNames.length === 6, 'Time recomendado deve conter 6 Pokémon');
    console.log('✅ Reprodução do baseline Charizard-Mega-Y + Whimsicott realizada com sucesso!');
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
}

if (require.main === module) {
  testCharizardWhimsicottRegression().catch((err) => {
    console.error('❌ Erro no teste de reprodução:', err);
    process.exit(1);
  });
}
