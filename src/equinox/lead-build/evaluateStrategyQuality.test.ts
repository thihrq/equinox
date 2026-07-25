import { evaluateStrategyQuality } from './evaluateStrategyQuality';
import { OffensiveScoreBreakdown } from './StrategyQualityDiagnostics';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testEvaluateStrategyQuality() {
  console.log('[Equinox Test] Testando a avaliação de qualidade ofensiva contextualizada...');

  // Breakdown do Aggron-Mega + Sinistcha (Trick Room): score genérico = 39
  const trBreakdown: OffensiveScoreBreakdown = {
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

  // 1. Em Trick Room: legal + completo + primaryPressure 83 (>= 60) + coverage 39 (>= 30) -> VALID!
  const trResult = evaluateStrategyQuality({
    strategyId: 'trick_room',
    legal: true,
    strategyComplete: true,
    breakdown: trBreakdown,
  });

  assert(trResult.valid === true, 'Deve aceitar o time de Trick Room com breakdown de score 39');
  assert(trResult.profileId === 'trick_room', 'ProfileId deve ser trick_room');
  assert(trResult.generalOffensiveScore === 39, 'generalOffensiveScore deve ser preservado como 39');
  assert(trResult.contextualOffensiveScore > 50, 'contextualOffensiveScore deve ser satisfatório');

  // 2. Em Balanced: exige simetria e coverageBreadth >= 45 (coverage 39 < 45) -> REJEITADO
  const balancedResult = evaluateStrategyQuality({
    strategyId: 'balanced',
    legal: true,
    strategyComplete: true,
    breakdown: trBreakdown,
  });

  assert(balancedResult.valid === false, 'Deve rejeitar o mesmo breakdown quando avaliado como Balanced');
  assert(balancedResult.reasons.includes('INSUFFICIENT_COVERAGE'), 'Deve registrar INSUFFICIENT_COVERAGE para Balanced');

  // 3. Ilegalidade: sempre REJEITADO
  const illegalResult = evaluateStrategyQuality({
    strategyId: 'trick_room',
    legal: false,
    strategyComplete: true,
    breakdown: trBreakdown,
  });
  assert(illegalResult.valid === false, 'Time ilegal deve ser sempre rejeitado');

  // 4. Incompletude: sempre REJEITADO
  const incompleteResult = evaluateStrategyQuality({
    strategyId: 'trick_room',
    legal: true,
    strategyComplete: false,
    breakdown: trBreakdown,
  });
  assert(incompleteResult.valid === false, 'Estratégia incompleta deve ser sempre rejeitada');

  console.log('✅ Testes de evaluateStrategyQuality passaram com sucesso!');
}

if (require.main === module) {
  testEvaluateStrategyQuality();
}
