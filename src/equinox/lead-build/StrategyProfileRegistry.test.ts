process.env.EQUINOX_DATA_MODE = 'mongo';
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { connectDatabase } from '../../config/database';
import { resolveStrategyProfile } from './StrategyProfileRegistry';
import { LeadStrategyRecommendationService } from '../../services/LeadStrategyRecommendationService';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export async function testStrategyProfileRegistry() {
  console.log('[Equinox Test] Testando o StrategyProfileRegistry...');

  // 1. sun_offense -> weather + sun
  const sun = resolveStrategyProfile('sun_offense');
  assert(sun.profileId === 'weather', `Esperava profileId 'weather', obteve ${sun.profileId}`);
  assert(sun.weather === 'sun', `Esperava weather 'sun', obteve ${sun.weather}`);
  assert(sun.fallbackUsed === false, 'sun_offense não deve usar fallback');

  // 2. rain_offense -> weather + rain
  const rain = resolveStrategyProfile('rain_offense');
  assert(rain.profileId === 'weather', `Esperava profileId 'weather', obteve ${rain.profileId}`);
  assert(rain.weather === 'rain', `Esperava weather 'rain', obteve ${rain.weather}`);
  assert(rain.fallbackUsed === false, 'rain_offense não deve usar fallback');

  // 3. sand_rush -> weather + sand
  const sand = resolveStrategyProfile('sand_rush');
  assert(sand.profileId === 'weather', `Esperava profileId 'weather', obteve ${sand.profileId}`);
  assert(sand.weather === 'sand', `Esperava weather 'sand', obteve ${sand.weather}`);
  assert(sand.fallbackUsed === false, 'sand_rush não deve usar fallback');

  // 4. snow_offense -> weather + snow
  const snow = resolveStrategyProfile('snow_offense');
  assert(snow.profileId === 'weather', `Esperava profileId 'weather', obteve ${snow.profileId}`);
  assert(snow.weather === 'snow', `Esperava weather 'snow', obteve ${snow.weather}`);
  assert(snow.fallbackUsed === false, 'snow_offense não deve usar fallback');

  // 5. tailwind_rush -> tailwind
  const tailwind = resolveStrategyProfile('tailwind_rush');
  assert(tailwind.profileId === 'tailwind', `Esperava profileId 'tailwind', obteve ${tailwind.profileId}`);
  assert(tailwind.speedMode === 'tailwind', `Esperava speedMode 'tailwind', obteve ${tailwind.speedMode}`);
  assert(tailwind.fallbackUsed === false, 'tailwind_rush não deve usar fallback');

  // 6. trick_room -> trick_room
  const tr = resolveStrategyProfile('trick_room');
  assert(tr.profileId === 'trick_room', `Esperava profileId 'trick_room', obteve ${tr.profileId}`);
  assert(tr.fallbackUsed === false, 'trick_room não deve usar fallback');

  // 7. redirect_setup -> redirect_setup
  const redirect = resolveStrategyProfile('redirect_setup');
  assert(redirect.profileId === 'redirect_setup', `Esperava profileId 'redirect_setup', obteve ${redirect.profileId}`);
  assert(redirect.fallbackUsed === false, 'redirect_setup não deve usar fallback');

  // 8. defensive_core -> defensive_core
  const def = resolveStrategyProfile('defensive_core');
  assert(def.profileId === 'defensive_core', `Esperava profileId 'defensive_core', obteve ${def.profileId}`);
  assert(def.fallbackUsed === false, 'defensive_core não deve usar fallback');

  // 9. balanced -> balanced
  const bal = resolveStrategyProfile('balanced');
  assert(bal.profileId === 'balanced', `Esperava profileId 'balanced', obteve ${bal.profileId}`);
  assert(bal.fallbackUsed === false, 'balanced não deve usar fallback');

  // 10. unknown_custom -> balanced + fallbackUsed = true
  const unknown = resolveStrategyProfile('unknown_custom_strategy_x');
  assert(unknown.profileId === 'balanced', `Esperava profileId 'balanced', obteve ${unknown.profileId}`);
  assert(unknown.fallbackUsed === true, 'Estratégia desconhecida deve usar fallback');
  assert(unknown.reason === 'UNKNOWN_STRATEGY_PROFILE_FALLBACK', 'Deve registrar razão do fallback');

  console.log('✅ Validação unitária do StrategyProfileRegistry concluída!');

  // 11. Teste de integração de Resolução Única por Estratégia
  if (mongoose.connection.readyState !== 1) {
    await connectDatabase();
  }

  try {
    const service = new LeadStrategyRecommendationService();
    const result = await service.execute({
      lead: [{ name: 'Charizard-Mega-Y' }, { name: 'Whimsicott' }],
      format: 'champions_reg_m_b_doubles',
      leadMode: 'fixed-lead',
      allowLegendaries: false,
      teamIdentity: 'balanced',
    });

    assert(result.metrics.profileResolutionCount === result.generatedStrategies.length, 'profileResolutionCount deve ser igual ao número de estratégias geradas');
    assert(result.metrics.knownProfileFallbackCount === 0, 'knownProfileFallbackCount deve ser 0');
    assert(result.metrics.unknownProfileFallbackCount === 0, 'unknownProfileFallbackCount deve ser 0');

    console.log(`[Single Resolution Test]:
  strategyCount: ${result.metrics.strategyCount}
  profileResolutionCount: ${result.metrics.profileResolutionCount}
  knownProfileFallbackCount: ${result.metrics.knownProfileFallbackCount}
  unknownProfileFallbackCount: ${result.metrics.unknownProfileFallbackCount}`);

    console.log('✅ Teste de resolução única por estratégia passou com sucesso!');
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
}

if (require.main === module) {
  testStrategyProfileRegistry().catch(err => {
    console.error('❌ Erro no teste do StrategyProfileRegistry:', err);
    process.exit(1);
  });
}
