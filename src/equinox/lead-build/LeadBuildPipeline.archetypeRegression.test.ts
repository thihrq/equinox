import { evaluateStrategyQuality } from './evaluateStrategyQuality';
import { getStrategyOffensiveProfile } from './StrategyOffensiveProfile';
import { OffensiveScoreBreakdown } from './StrategyQualityDiagnostics';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testArchetypeCrossRegression() {
  console.log('[Equinox Test] Executando regressão cruzada de qualidade por arquétipos estratégicos...');

  // Breakdown base com forte pressão física
  const trickRoomBreakdown: OffensiveScoreBreakdown = {
    physicalPressure: 83,
    specialPressure: 70,
    spreadDamage: 50,
    priorityPressure: 50,
    coverageBreadth: 39,
    strategyConversion: 50,
    outsideStrategyPlan: 50,
    setupDependencyPenalty: 0,
    finalScore: 39,
  };

  // 1. Arquétipo Trick Room (Aggron-Mega + Sinistcha)
  const trResult = evaluateStrategyQuality({
    strategyId: 'trick_room',
    legal: true,
    strategyComplete: true,
    breakdown: trickRoomBreakdown,
  });
  assert(trResult.valid === true, 'Trick Room deve aceitar o time de Aggron-Mega + Sinistcha');
  assert(trResult.profileId === 'trick_room', 'Profile ID deve ser trick_room');

  // 2. Arquétipo Tailwind
  const tailwindBreakdown: OffensiveScoreBreakdown = {
    physicalPressure: 75,
    specialPressure: 65,
    spreadDamage: 60,
    priorityPressure: 55,
    coverageBreadth: 40,
    strategyConversion: 55,
    outsideStrategyPlan: 50,
    setupDependencyPenalty: 0,
    finalScore: 48,
  };
  const twResult = evaluateStrategyQuality({
    strategyId: 'tailwind',
    legal: true,
    strategyComplete: true,
    breakdown: tailwindBreakdown,
  });
  assert(twResult.valid === true, 'Tailwind deve aceitar o time de vento favorável');

  // 3. Arquétipo Weather
  const weatherBreakdown: OffensiveScoreBreakdown = {
    physicalPressure: 70,
    specialPressure: 85,
    spreadDamage: 70,
    priorityPressure: 40,
    coverageBreadth: 42,
    strategyConversion: 60,
    outsideStrategyPlan: 45,
    setupDependencyPenalty: 0,
    finalScore: 52,
  };
  const weatherResult = evaluateStrategyQuality({
    strategyId: 'weather',
    legal: true,
    strategyComplete: true,
    breakdown: weatherBreakdown,
  });
  assert(weatherResult.valid === true, 'Weather deve aceitar o time de clima');

  // 4. Arquétipo Terrain
  const terrainBreakdown: OffensiveScoreBreakdown = {
    physicalPressure: 65,
    specialPressure: 80,
    spreadDamage: 65,
    priorityPressure: 45,
    coverageBreadth: 38,
    strategyConversion: 55,
    outsideStrategyPlan: 45,
    setupDependencyPenalty: 0,
    finalScore: 46,
  };
  const terrainResult = evaluateStrategyQuality({
    strategyId: 'terrain',
    legal: true,
    strategyComplete: true,
    breakdown: terrainBreakdown,
  });
  assert(terrainResult.valid === true, 'Terrain deve aceitar o time de terreno');

  // 5. Arquétipo Redirect Setup
  const redirectBreakdown: OffensiveScoreBreakdown = {
    physicalPressure: 80,
    specialPressure: 60,
    spreadDamage: 40,
    priorityPressure: 60,
    coverageBreadth: 35,
    strategyConversion: 50,
    outsideStrategyPlan: 45,
    setupDependencyPenalty: 0,
    finalScore: 44,
  };
  const redirectResult = evaluateStrategyQuality({
    strategyId: 'redirect_setup',
    legal: true,
    strategyComplete: true,
    breakdown: redirectBreakdown,
  });
  assert(redirectResult.valid === true, 'Redirect Setup deve aceitar o time de suporte/setup');

  // 6. Arquétipo Defensive Core
  const defensiveBreakdown: OffensiveScoreBreakdown = {
    physicalPressure: 55,
    specialPressure: 52,
    spreadDamage: 30,
    priorityPressure: 40,
    coverageBreadth: 32,
    strategyConversion: 45,
    outsideStrategyPlan: 45,
    setupDependencyPenalty: 0,
    finalScore: 40,
  };
  const defensiveResult = evaluateStrategyQuality({
    strategyId: 'defensive_core',
    legal: true,
    strategyComplete: true,
    breakdown: defensiveBreakdown,
  });
  assert(defensiveResult.valid === true, 'Defensive Core deve aceitar o time defensivo sustentável');

  // 7. Arquétipo Balanced
  const balancedBreakdown: OffensiveScoreBreakdown = {
    physicalPressure: 70,
    specialPressure: 68,
    spreadDamage: 55,
    priorityPressure: 50,
    coverageBreadth: 50,
    strategyConversion: 55,
    outsideStrategyPlan: 55,
    setupDependencyPenalty: 0,
    finalScore: 58,
  };
  const balancedResult = evaluateStrategyQuality({
    strategyId: 'balanced',
    legal: true,
    strategyComplete: true,
    breakdown: balancedBreakdown,
  });
  assert(balancedResult.valid === true, 'Balanced deve aceitar o time verdadeiramente equilibrado');

  // 8. Casos Negativos de Segurança
  // 8a. Pressão primária nula/insuficiente (passividade extrema)
  const passiveBreakdown: OffensiveScoreBreakdown = {
    ...defensiveBreakdown,
    physicalPressure: 20,
    specialPressure: 25,
  };
  const passiveResult = evaluateStrategyQuality({
    strategyId: 'defensive_core',
    legal: true,
    strategyComplete: true,
    breakdown: passiveBreakdown,
  });
  assert(passiveResult.valid === false, 'Deve rejeitar time totalmente passivo sem pressão');

  // 8b. Time Ilegal (ex: 2 Megas ou duplicatas de espécie)
  const illegalResult = evaluateStrategyQuality({
    strategyId: 'trick_room',
    legal: false,
    strategyComplete: true,
    breakdown: trickRoomBreakdown,
  });
  assert(illegalResult.valid === false, 'Time ilegal deve ser 100% rejeitado');

  // 8c. Estratégia Incompleta
  const incompleteResult = evaluateStrategyQuality({
    strategyId: 'trick_room',
    legal: true,
    strategyComplete: false,
    breakdown: trickRoomBreakdown,
  });
  assert(incompleteResult.valid === false, 'Estratégia incompleta deve ser 100% rejeitada');

  console.log('✅ Regressão cruzada de arquétipos estratégicos concluída com sucesso!');
}

if (require.main === module) {
  testArchetypeCrossRegression();
}
