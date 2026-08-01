import { evaluateStrategyQuality } from './evaluateStrategyQuality';
import { OffensiveScoreBreakdown, OffensivePressureMetadata, OffensiveCoverageMetadata, toStructuredGateReason } from './StrategyQualityDiagnostics';
import { ALL_POKEMON_TYPES } from './TeamDefensiveProfile';
import { aggregateFinalistRejections } from './FinalistRejectionAggregator';
import { FinalistDecisionTrace } from './FinalistDecisionTrace';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

function baseBreakdown(overrides: Partial<OffensiveScoreBreakdown>): OffensiveScoreBreakdown {
  return {
    physicalPressure: 80,
    specialPressure: 80,
    spreadDamage: 50,
    priorityPressure: 50,
    coverageBreadth: 80,
    strategyConversion: 50,
    outsideStrategyPlan: 50,
    setupDependencyPenalty: 0,
    finalScore: 80,
    offensiveTypesPresent: ['Fire', 'Flying'],
    ...overrides,
  };
}

export function testOffensiveRejectionEvidence() {
  console.log('[Equinox Test] Testando o contrato estruturado de evidência de rejeição ofensiva (104)...');

  // 1. Pressão insuficiente: physical=40, special=45, min=50 (defensive_core).
  //    Isolada — coverageBreadth alto o bastante para não disparar o outro reason.
  const pressureResult = evaluateStrategyQuality({
    strategyId: 'defensive_core',
    legal: true,
    strategyComplete: true,
    breakdown: baseBreakdown({ physicalPressure: 40, specialPressure: 45, coverageBreadth: 80 }),
  });

  assert(pressureResult.valid === false, 'Caso 1: deve ser inválido (pressão abaixo do mínimo).');
  assert(pressureResult.reasons.length === 1, 'Caso 1: deve haver exatamente 1 reason.');
  assert(pressureResult.reasons[0].reasonCode === 'INSUFFICIENT_PRIMARY_PRESSURE', 'Caso 1: reasonCode deve ser INSUFFICIENT_PRIMARY_PRESSURE.');
  const pressureMetadata = pressureResult.reasons[0].metadata as OffensivePressureMetadata;
  assert(pressureMetadata.primaryPressure === 45, 'Caso 1: primaryPressure deve ser max(40,45)=45.');
  assert(
    pressureMetadata.deficientSides.length === 2 &&
      pressureMetadata.deficientSides.includes('physical') &&
      pressureMetadata.deficientSides.includes('special'),
    'Caso 1: deficientSides deve ser [physical, special] — os dois lados estão abaixo do mínimo quando o gate falha.',
  );
  assert(pressureMetadata.strongestSide === 'special', 'Caso 1: strongestSide deve ser special (45 > 40).');
  console.log('✅ Caso 1 (pressão insuficiente, metadata correta) PASS');

  // 2. Empate: physical=40, special=40 -> strongestSide = balanced.
  const tieResult = evaluateStrategyQuality({
    strategyId: 'defensive_core',
    legal: true,
    strategyComplete: true,
    breakdown: baseBreakdown({ physicalPressure: 40, specialPressure: 40, coverageBreadth: 80 }),
  });
  const tieMetadata = tieResult.reasons.find(r => r.reasonCode === 'INSUFFICIENT_PRIMARY_PRESSURE')?.metadata as OffensivePressureMetadata;
  assert(tieMetadata !== undefined, 'Caso 2: deve haver reason de pressão.');
  assert(tieMetadata.strongestSide === 'balanced', 'Caso 2: strongestSide deve ser balanced em empate.');
  console.log('✅ Caso 2 (empate → strongestSide balanced) PASS');

  // 3. Cobertura insuficiente, isolada (pressão alta o bastante para não disparar).
  const coverageResult = evaluateStrategyQuality({
    strategyId: 'defensive_core',
    legal: true,
    strategyComplete: true,
    breakdown: baseBreakdown({
      physicalPressure: 90,
      specialPressure: 90,
      coverageBreadth: 10,
      offensiveTypesPresent: ['Fire', 'Flying'],
    }),
  });
  assert(coverageResult.valid === false, 'Caso 3: deve ser inválido (cobertura abaixo do mínimo).');
  assert(coverageResult.reasons.length === 1, 'Caso 3: deve haver exatamente 1 reason.');
  assert(coverageResult.reasons[0].reasonCode === 'INSUFFICIENT_COVERAGE', 'Caso 3: reasonCode deve ser INSUFFICIENT_COVERAGE.');
  const coverageMetadata = coverageResult.reasons[0].metadata as OffensiveCoverageMetadata;
  assert(
    coverageMetadata.offensiveTypesPresent.length === 2 &&
      coverageMetadata.offensiveTypesPresent.includes('Fire') &&
      coverageMetadata.offensiveTypesPresent.includes('Flying'),
    'Caso 3: offensiveTypesPresent deve ser [Fire, Flying].',
  );
  assert(!coverageMetadata.uncoveredTypes.includes('Fire' as any), 'Caso 3: uncoveredTypes não deve conter Fire (já presente).');
  assert(coverageMetadata.uncoveredTypes.includes('Water' as any), 'Caso 3: uncoveredTypes deve conter Water (ausente).');
  assert(coverageMetadata.uncoveredTypes.length === 16, 'Caso 3: uncoveredTypes deve ter 18 - 2 = 16 tipos.');
  const expectedCanonicalOrder = ALL_POKEMON_TYPES.filter(t => t !== 'Fire' && t !== 'Flying');
  assert(
    JSON.stringify(coverageMetadata.uncoveredTypes) === JSON.stringify(expectedCanonicalOrder),
    'Caso 3: uncoveredTypes deve seguir a ordem canônica de ALL_POKEMON_TYPES, sem duplicatas.',
  );
  console.log('✅ Caso 3 (cobertura insuficiente, uncoveredTypes correto e ordenado) PASS');

  // 4. Dois reasons no mesmo gate, cada um com seu próprio metadata.
  const bothResult = evaluateStrategyQuality({
    strategyId: 'defensive_core',
    legal: true,
    strategyComplete: true,
    breakdown: baseBreakdown({ physicalPressure: 30, specialPressure: 35, coverageBreadth: 10 }),
  });
  assert(bothResult.reasons.length === 2, 'Caso 4: devem existir 2 reasons simultâneos.');
  const codes = bothResult.reasons.map(r => r.reasonCode).sort();
  assert(JSON.stringify(codes) === JSON.stringify(['INSUFFICIENT_COVERAGE', 'INSUFFICIENT_PRIMARY_PRESSURE']), 'Caso 4: os dois reasonCodes esperados devem estar presentes.');
  const pressureReason = bothResult.reasons.find(r => r.reasonCode === 'INSUFFICIENT_PRIMARY_PRESSURE')!;
  const coverageReason = bothResult.reasons.find(r => r.reasonCode === 'INSUFFICIENT_COVERAGE')!;
  assert('deficientSides' in (pressureReason.metadata as any), 'Caso 4: metadata de pressão deve ser distinto (deficientSides).');
  assert('uncoveredTypes' in (coverageReason.metadata as any), 'Caso 4: metadata de cobertura deve ser distinto (uncoveredTypes).');
  console.log('✅ Caso 4 (dois reasons no mesmo gate, metadata independente) PASS');

  // 5. Agregador preserva metadata (não só reasonCode) e não reavalia nada.
  const trace: FinalistDecisionTrace = {
    strategyId: 'defensive_core',
    teamKey: 'team-offensive-1',
    valid: false,
    failedGates: ['OffensiveQuality'],
    primaryReason: 'INSUFFICIENT_PRIMARY_PRESSURE',
    gates: [
      { gate: 'OffensiveQuality', valid: false, reasons: bothResult.reasons },
    ],
  };
  const aggregate = aggregateFinalistRejections('defensive_core', [trace]);
  const aggPressure = aggregate.failuresByReason.find(r => r.reasonCode === 'INSUFFICIENT_PRIMARY_PRESSURE');
  const aggCoverage = aggregate.failuresByReason.find(r => r.reasonCode === 'INSUFFICIENT_COVERAGE');
  assert(aggPressure !== undefined, 'Caso 5: agregador deve conter INSUFFICIENT_PRIMARY_PRESSURE.');
  assert(aggCoverage !== undefined, 'Caso 5: agregador deve conter INSUFFICIENT_COVERAGE.');
  assert(aggPressure!.metadata !== undefined, 'Caso 5: metadata de pressão deve estar preservada no agregado.');
  assert(aggCoverage!.metadata !== undefined, 'Caso 5: metadata de cobertura deve estar preservada no agregado.');
  assert(
    (aggPressure!.metadata as OffensivePressureMetadata).strongestSide === 'special',
    'Caso 5: metadata preservada deve ser a mesma calculada na origem (sem reavaliação) — strongestSide=special.',
  );
  assert(
    (aggCoverage!.metadata as OffensiveCoverageMetadata).offensiveTypesPresent.length === 2,
    'Caso 5: metadata de cobertura preservada deve refletir os 2 tipos originais, sem recomputar nada.',
  );
  console.log('✅ Caso 5 (agregador preserva metadata por reason, sem reavaliação) PASS');

  // 6. Gates preexistentes (sem metadata) continuam chegando normalmente.
  const legacyTrace: FinalistDecisionTrace = {
    strategyId: 'defensive_core',
    teamKey: 'team-legacy-1',
    valid: false,
    failedGates: ['DefensiveQuality', 'RoleCoverage'],
    primaryReason: 'NO_DEFENSIVE_SWITCH_IN:Ice',
    gates: [
      { gate: 'DefensiveQuality', valid: false, reasons: [toStructuredGateReason('NO_DEFENSIVE_SWITCH_IN:Ice')] },
      { gate: 'RoleCoverage', valid: false, reasons: [toStructuredGateReason('INSUFFICIENT_ROLE_COVERAGE')] },
    ],
  };
  const legacyAggregate = aggregateFinalistRejections('defensive_core', [legacyTrace]);
  assert(
    legacyAggregate.failuresByReason.some(r => r.reasonCode === 'NO_DEFENSIVE_SWITCH_IN' && r.attackType === 'Ice'),
    'Caso 6: reasonCode defensivo legado (com attackType) deve continuar funcionando.',
  );
  assert(
    legacyAggregate.failuresByReason.some(r => r.reasonCode === 'INSUFFICIENT_ROLE_COVERAGE' && r.metadata === undefined),
    'Caso 6: reasonCode de role legado deve chegar sem metadata (não regrediu).',
  );
  console.log('✅ Caso 6 (compatibilidade com gates preexistentes sem metadata) PASS');

  console.log('✅ OffensiveRejectionEvidence testado com sucesso!');
}

if (require.main === module) {
  testOffensiveRejectionEvidence();
}
