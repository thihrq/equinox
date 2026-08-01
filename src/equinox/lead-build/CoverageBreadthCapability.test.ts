import { calculateMinimumAdditionalTypes } from './StrategyQualityDiagnostics';
import { classifyCoverageBreadth } from './CandidateCapabilityClassifier';
import { deriveRecoveryCapabilityPlan } from './RecoveryCapabilityPlanner';
import { FinalistRejectionAggregate } from './FinalistRejectionAggregator';
import { ALL_POKEMON_TYPES } from './TeamDefensiveProfile';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

function baseAggregate(overrides: Partial<FinalistRejectionAggregate>): FinalistRejectionAggregate {
  return {
    strategyId: 'sun_offense',
    evaluatedFinalists: 15,
    acceptedFinalists: 0,
    rejectedFinalists: 15,
    legalCompleteFinalists: 15,
    defensivelyValidFinalists: 15,
    offensivelyValidFinalists: 0,
    setCoherentFinalists: 15,
    failuresByGate: { OffensiveQuality: 15 },
    failuresByReason: [],
    failuresByAttackType: {},
    dominantFailureReasons: [],
    ...overrides,
  };
}

export function testCoverageBreadthCapability() {
  console.log('[Equinox Test] Testando a capability ofensiva COVERAGE_BREADTH (106)...');

  // ── Derivação do mínimo: 0 divergências contra a avaliação soberana ──────
  {
    let divergences = 0;
    function realCoverageBreadth(count: number): number {
      return Math.round((count / ALL_POKEMON_TYPES.length) * 100);
    }
    for (const minimum of [30, 35, 45]) {
      for (let present = 0; present <= 18; present++) {
        const needed = calculateMinimumAdditionalTypes(present, minimum);
        const finalCount = present + needed;
        if (needed > 0 && realCoverageBreadth(finalCount) < minimum) divergences++;
        // Também garante que NÃO exagera: um a menos não deveria já satisfazer.
        if (needed > 0 && realCoverageBreadth(finalCount - 1) >= minimum) divergences++;
      }
    }
    assert(divergences === 0, `derivação do mínimo: 0 divergências esperadas contra a avaliação soberana, obtido ${divergences}`);
  }
  console.log('✅ Caso 1 (derivação do mínimo, 0 divergências) PASS');

  // ── Request positiva: present=5, minimumCoverageBreadth=35 → target=7, minimumAdditionalTypes=2 ──
  {
    const needed = calculateMinimumAdditionalTypes(5, 35);
    assert(needed === 2, `request positiva: minimumAdditionalTypes deve ser 2, obtido ${needed}`);
  }
  console.log('✅ Caso 2 (request positiva: present=5, min=35 → minimumAdditionalTypes=2) PASS');

  // ── Request inválida: metadata ausente → planner não cria request ────────
  {
    const aggregate = baseAggregate({
      failuresByReason: [
        { reasonCode: 'INSUFFICIENT_COVERAGE', count: 15, gate: 'OffensiveQuality', finalistKeys: [] },
      ],
    });
    const plan = deriveRecoveryCapabilityPlan(aggregate, { parityValid: true });
    assert(
      !plan.requests.some(r => 'kind' in r && r.kind === 'COVERAGE_BREADTH'),
      'metadata ausente: nenhuma COVERAGE_BREADTH request deve ser criada',
    );
    assert(
      plan.ineligibilityReasons.includes('NO_CAPABILITY_REQUESTS_DERIVED'),
      'metadata ausente: deve cair em NO_CAPABILITY_REQUESTS_DERIVED (fail-closed)',
    );
  }
  console.log('✅ Caso 3 (metadata ausente → fail-closed, sem request) PASS');

  // ── Planner gera request corretamente com metadata válida ────────────────
  {
    const aggregate = baseAggregate({
      failuresByReason: [
        {
          reasonCode: 'INSUFFICIENT_COVERAGE',
          count: 15,
          gate: 'OffensiveQuality',
          finalistKeys: [],
          metadata: {
            coverageBreadth: 28,
            minimumCoverageBreadth: 35,
            offensiveTypesPresent: ['Fire', 'Water', 'Grass', 'Electric', 'Ice'],
            uncoveredTypes: ALL_POKEMON_TYPES.filter(t => !['Fire', 'Water', 'Grass', 'Electric', 'Ice'].includes(t)),
          },
        },
      ],
    });
    const plan = deriveRecoveryCapabilityPlan(aggregate, { parityValid: true });
    assert(plan.eligible === true, 'plano com metadata válida deve ser elegível');
    const coverageReq = plan.requests.find(r => 'kind' in r && r.kind === 'COVERAGE_BREADTH');
    assert(coverageReq !== undefined, 'deve haver exatamente uma request COVERAGE_BREADTH');
    assert('minimumAdditionalTypes' in coverageReq! && coverageReq.minimumAdditionalTypes === 2, 'minimumAdditionalTypes deve ser 2 (present=5, min=35)');
  }
  console.log('✅ Caso 4 (planner deriva COVERAGE_BREADTH request a partir de metadata válida) PASS');

  // ── Match positivo ─────────────────────────────────────────────────────
  {
    const result = classifyCoverageBreadth(
      ['Flying', 'Steel'],
      ['Fire', 'Water', 'Grass', 'Electric', 'Ice'],
      2,
      35,
    );
    assert(result.matched === true, 'match positivo: candidato Flying/Steel deve satisfazer minimumAdditionalTypes=2');
    assert(result.confidence === 'CONTEXTUAL', 'confidence deve ser sempre CONTEXTUAL');
  }
  console.log('✅ Caso 5 (match positivo) PASS');

  // ── Match parcial ───────────────────────────────────────────────────────
  {
    const result = classifyCoverageBreadth(['Flying'], ['Fire', 'Water'], 2, 35);
    assert(result.matched === false, 'match parcial: só 1 tipo novo não deve satisfazer minimumAdditionalTypes=2');
    assert(result.newTypesAdded.length === 1, 'newTypesAdded deve ter exatamente 1 elemento');
  }
  console.log('✅ Caso 6 (match parcial) PASS');

  // ── Tipos duplicados no candidato ────────────────────────────────────────
  {
    const result = classifyCoverageBreadth(['Fire', 'Flying'], ['Fire', 'Water'], 1, 30);
    assert(result.newTypesAdded.length === 1 && result.newTypesAdded[0] === 'Flying', 'tipo duplicado: só Flying deve contar como novo');
    assert(result.matched === true, 'tipo duplicado: 1 novo >= minimumAdditionalTypes=1 deve satisfazer');
  }
  console.log('✅ Caso 7 (tipos duplicados contados uma vez) PASS');

  // ── Candidato sem tipos novos ────────────────────────────────────────────
  {
    const result = classifyCoverageBreadth(['Fire', 'Water'], ['Fire', 'Water', 'Grass'], 1, 30);
    assert(result.newTypesAdded.length === 0, 'candidato sem tipos novos: newTypesAdded deve ser vazio');
    assert(result.matched === false, 'candidato sem tipos novos: nunca deve satisfazer');
  }
  console.log('✅ Caso 8 (candidato sem tipos novos, matched=false) PASS');

  // ── minimumAdditionalTypes <= 0 nunca deveria ter sido gerado pelo planner,
  //    mas o classificador também precisa fail-closed nesse caso defensivo. ──
  {
    const result = classifyCoverageBreadth(['Flying'], ['Fire'], 0, 30);
    assert(result.matched === false, 'minimumAdditionalTypes<=0 nunca deve produzir matched=true');
  }
  console.log('✅ Caso 9 (minimumAdditionalTypes<=0 defensivo) PASS');

  // ── Coexistência com requests defensivas (SAFE_SWITCH_IN + COVERAGE_BREADTH) ──
  {
    const aggregate = baseAggregate({
      failuresByReason: [
        { reasonCode: 'NO_DEFENSIVE_SWITCH_IN', count: 10, attackType: 'Ice', gate: 'DefensiveQuality', finalistKeys: [] },
        {
          reasonCode: 'INSUFFICIENT_COVERAGE',
          count: 15,
          gate: 'OffensiveQuality',
          finalistKeys: [],
          metadata: {
            coverageBreadth: 28,
            minimumCoverageBreadth: 35,
            offensiveTypesPresent: ['Fire', 'Water', 'Grass', 'Electric', 'Ice'],
            uncoveredTypes: [],
          },
        },
      ],
    });
    const plan = deriveRecoveryCapabilityPlan(aggregate, { parityValid: true });
    assert(
      plan.requests.some(r => 'capability' in r && r.capability === 'SAFE_SWITCH_IN' && r.attackType === 'Ice'),
      'deve coexistir SAFE_SWITCH_IN:Ice',
    );
    assert(
      plan.requests.some(r => 'kind' in r && r.kind === 'COVERAGE_BREADTH'),
      'deve coexistir COVERAGE_BREADTH',
    );
  }
  console.log('✅ Caso 10 (SAFE_SWITCH_IN:Ice e COVERAGE_BREADTH coexistem no mesmo plano) PASS');

  console.log('✅ CoverageBreadthCapability testado com sucesso!');
}

if (require.main === module) {
  testCoverageBreadthCapability();
}
