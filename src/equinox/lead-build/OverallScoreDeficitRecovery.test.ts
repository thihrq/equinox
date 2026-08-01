import { deriveRecoveryCapabilityPlan } from './RecoveryCapabilityPlanner';
import { FinalistRejectionAggregate } from './FinalistRejectionAggregator';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

function baseAggregate(overrides: Partial<FinalistRejectionAggregate>): FinalistRejectionAggregate {
  return {
    strategyId: 'sun_offense',
    evaluatedFinalists: 5,
    acceptedFinalists: 0,
    rejectedFinalists: 5,
    legalCompleteFinalists: 5,
    defensivelyValidFinalists: 5,
    offensivelyValidFinalists: 5,
    setCoherentFinalists: 5,
    failuresByGate: { OverallScore: 5 },
    failuresByReason: [],
    failuresByAttackType: {},
    dominantFailureReasons: [],
    ...overrides,
  };
}

/**
 * Reproduz achado real de produção (lead Charizard-Mega-Y+Whimsicott,
 * champions_reg_m_b_doubles): 15 finalistas rejeitados com DefensiveQuality,
 * RoleCoverage e OffensiveQuality individualmente válidos, só o overallScore
 * ponderado abaixo de 60 — antes deste fix, `NO_CAPABILITY_REQUESTS_DERIVED`
 * para as 3 estratégias, `candidatesExamined: 0` em todas, recovery
 * estruturalmente incapaz de agir mesmo com candidatos reais disponíveis.
 */
export function testOverallScoreDeficitRecovery() {
  console.log('[Equinox Test] Testando recovery para OVERALL_SCORE_BELOW_THRESHOLD sem gate granular falho...');

  // ── Metadata ausente/malformada → fail-closed, nenhuma request ───────────
  {
    const aggregate = baseAggregate({
      failuresByReason: [
        { reasonCode: 'OVERALL_SCORE_BELOW_THRESHOLD', count: 5, gate: 'OverallScore', finalistKeys: [] },
      ],
    });
    const plan = deriveRecoveryCapabilityPlan(aggregate, { parityValid: true });
    assert(
      !plan.requests.some(r => 'capability' in r && r.capability === 'POSITIONING'),
      'sem metadata: nenhuma request POSITIONING deve ser criada',
    );
    assert(
      !plan.requests.some(r => 'kind' in r && r.kind === 'COVERAGE_BREADTH'),
      'sem metadata: nenhuma request COVERAGE_BREADTH deve ser criada',
    );
    assert(
      plan.ineligibilityReasons.includes('NO_CAPABILITY_REQUESTS_DERIVED'),
      'sem metadata: deve cair em NO_CAPABILITY_REQUESTS_DERIVED (fail-closed)',
    );
  }
  console.log('✅ Caso 1 (metadata ausente → fail-closed) PASS');

  // ── weakestDimension=roleCoverage → deriva POSITIONING (reaproveitado) ───
  {
    const aggregate = baseAggregate({
      failuresByReason: [
        {
          reasonCode: 'OVERALL_SCORE_BELOW_THRESHOLD',
          count: 5,
          gate: 'OverallScore',
          finalistKeys: [],
          metadata: {
            weakestDimension: 'roleCoverage',
            roleCoverageScore: 40,
            offensiveBalanceScore: 65,
            defensiveCoverageScore: 70,
            speedControlScore: 60,
            matchupFlexibilityScore: 55,
            overallScore: 57,
          },
        },
      ],
    });
    const plan = deriveRecoveryCapabilityPlan(aggregate, { parityValid: true });
    assert(plan.eligible === true, 'weakestDimension=roleCoverage: plano deve ser elegível');
    assert(
      plan.requests.some(r => 'capability' in r && r.capability === 'POSITIONING'),
      'weakestDimension=roleCoverage: deve derivar POSITIONING',
    );
  }
  console.log('✅ Caso 2 (weakestDimension=roleCoverage → POSITIONING) PASS');

  // ── weakestDimension=offensiveBalance → deriva COVERAGE_BREADTH ──────────
  {
    const aggregate = baseAggregate({
      failuresByReason: [
        {
          reasonCode: 'OVERALL_SCORE_BELOW_THRESHOLD',
          count: 5,
          gate: 'OverallScore',
          finalistKeys: [],
          metadata: {
            weakestDimension: 'offensiveBalance',
            roleCoverageScore: 76,
            offensiveBalanceScore: 20,
            defensiveCoverageScore: 92,
            speedControlScore: 5,
            matchupFlexibilityScore: 72,
            overallScore: 58,
            offensiveTypesPresent: ['Grass', 'Ghost', 'Dark', 'Steel'],
            targetOffensiveCoverageBreadth: 45,
          },
        },
      ],
    });
    const plan = deriveRecoveryCapabilityPlan(aggregate, { parityValid: true });
    assert(plan.eligible === true, 'weakestDimension=offensiveBalance: plano deve ser elegível');
    const coverageReq = plan.requests.find(r => 'kind' in r && r.kind === 'COVERAGE_BREADTH');
    assert(coverageReq !== undefined, 'weakestDimension=offensiveBalance: deve derivar COVERAGE_BREADTH');
    assert(
      'minimumAdditionalTypes' in coverageReq! && coverageReq.minimumAdditionalTypes > 0,
      'weakestDimension=offensiveBalance: minimumAdditionalTypes deve ser > 0',
    );
  }
  console.log('✅ Caso 3 (weakestDimension=offensiveBalance → COVERAGE_BREADTH) PASS');

  // ── weakestDimension=speedControl → nenhuma capability (deliberado) ──────
  {
    const aggregate = baseAggregate({
      failuresByReason: [
        {
          reasonCode: 'OVERALL_SCORE_BELOW_THRESHOLD',
          count: 5,
          gate: 'OverallScore',
          finalistKeys: [],
          metadata: {
            weakestDimension: 'speedControl',
            roleCoverageScore: 70,
            offensiveBalanceScore: 65,
            defensiveCoverageScore: 70,
            speedControlScore: 5,
            matchupFlexibilityScore: 60,
            overallScore: 58,
          },
        },
      ],
    });
    const plan = deriveRecoveryCapabilityPlan(aggregate, { parityValid: true });
    assert(
      plan.ineligibilityReasons.includes('NO_CAPABILITY_REQUESTS_DERIVED'),
      'weakestDimension=speedControl: nenhuma capability deve ser derivada (métrica agregada, sem sinal por candidato) — mesmo critério já aplicado a PRIMARY_PRESSURE',
    );
  }
  console.log('✅ Caso 4 (weakestDimension=speedControl → sem capability, deliberado) PASS');

  // ── Coexistência: OVERALL_SCORE_BELOW_THRESHOLD(roleCoverage) + INSUFFICIENT_COVERAGE no mesmo plano ──
  {
    const aggregate = baseAggregate({
      failuresByReason: [
        {
          reasonCode: 'OVERALL_SCORE_BELOW_THRESHOLD',
          count: 3,
          gate: 'OverallScore',
          finalistKeys: [],
          metadata: {
            weakestDimension: 'roleCoverage',
            roleCoverageScore: 40,
            offensiveBalanceScore: 65,
            defensiveCoverageScore: 70,
            speedControlScore: 60,
            matchupFlexibilityScore: 55,
            overallScore: 57,
          },
        },
        {
          reasonCode: 'INSUFFICIENT_COVERAGE',
          count: 2,
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
      plan.requests.some(r => 'capability' in r && r.capability === 'POSITIONING'),
      'coexistência: POSITIONING (via OVERALL_SCORE_BELOW_THRESHOLD) deve estar presente',
    );
    assert(
      plan.requests.some(r => 'kind' in r && r.kind === 'COVERAGE_BREADTH'),
      'coexistência: COVERAGE_BREADTH (via INSUFFICIENT_COVERAGE) deve estar presente',
    );
  }
  console.log('✅ Caso 5 (coexistência com INSUFFICIENT_COVERAGE) PASS');

  console.log('✅ OverallScoreDeficitRecovery testado com sucesso!');
}

if (require.main === module) {
  testOverallScoreDeficitRecovery();
}
