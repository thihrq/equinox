import { AdaptiveStrategyRecovery } from './AdaptiveStrategyRecovery';
import { deriveRecoveryCapabilityPlan } from './RecoveryCapabilityPlanner';
import { aggregateFinalistRejections } from './FinalistRejectionAggregator';
import { createLeadBuildRequestContext } from './LeadBuildRequestContext';
import { createFinalistDecisionTrace } from './FinalistDecisionTrace';
import { toStructuredGateReason } from './StrategyQualityDiagnostics';
import { PokemonData } from '../core/AnalysisContext';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

export async function testAdaptiveRecoveryReachabilityUnit() {
  let recoverySourceFetched = false;

  const mockCandidateSource = {
    async fetch() {
      recoverySourceFetched = true;
      return {
        candidates: [
          {
            name: 'Heatran',
            types: ['Steel', 'Fire'],
            item: 'Leftovers',
            ability: 'Flash Fire',
            nature: 'Modest',
            moves: ['Heat Wave', 'Earth Power', 'Flash Cannon', 'Protect'],
            competitiveSet: {
              name: 'Heatran',
              setId: 'heatran-recovery-unit',
              setSource: 'mongodb-recovery',
              item: 'Leftovers',
              ability: 'Flash Fire',
              nature: 'Modest',
              moves: ['Heat Wave', 'Earth Power', 'Flash Cannon', 'Protect'],
              evs: { hp: 252, spa: 252, spe: 4 },
              ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
              types: ['Steel', 'Fire'],
              validation: { valid: true, errors: [] },
            },
          },
        ],
        rawCount: 1,
        sourceExhausted: false,
        endCursor: null,
      };
    },
  };

  const recovery = new AdaptiveStrategyRecovery(mockCandidateSource as any);
  const context = createLeadBuildRequestContext('req-unit-recovery-reachability', 'champions_reg_m_b_doubles', 'render_free');

  const trace = createFinalistDecisionTrace('weather_sun', 'f1', [
    {
      gate: 'DefensiveQuality',
      valid: false,
      score: 0,
      reasons: [toStructuredGateReason('UNANSWERED_REPEATED_WEAKNESS:Ice')],
    },
  ]);

  const rejectionAggregate = aggregateFinalistRejections('weather_sun', [trace]);

  const plan = deriveRecoveryCapabilityPlan(rejectionAggregate, { parityValid: true });
  assert(plan.eligible === true, 'Plano de recuperação deve ser elegível após falha de gate na busca primária.');

  const strategy: any = {
    id: 'weather_sun',
    name: 'Sun Offense',
    // `lead` é lido por `calculateDefensiveCoverageBonus`
    // (LeadStrategyCandidateScore.ts) durante a busca real disparada pelo
    // recovery. Sem ele o mock não reproduzia um `LeadStrategyCandidate`
    // válido — um defeito que ficou invisível enquanto o bug de parsing do
    // reasonCode (FinalistRejectionAggregator) impedia o plano de recovery de
    // ter requests e o fluxo nunca alcançava esse código.
    lead: ['Charizard-Mega-Y', 'Whimsicott'],
    requiredRoles: [],
    optionalRoles: [],
  };

  const lead: [PokemonData, PokemonData] = [
    { name: 'Charizard-Mega-Y', types: ['Fire', 'Flying'] } as any,
    { name: 'Whimsicott', types: ['Grass', 'Fairy'] } as any,
  ];

  const primaryCandidates: PokemonData[] = [
    { name: 'Venusaur', types: ['Grass', 'Poison'] } as any,
    { name: 'Torkoal', types: ['Fire'] } as any,
    { name: 'Chi-Yu', types: ['Dark', 'Fire'] } as any,
    { name: 'Flutter Mane', types: ['Fairy', 'Ghost'] } as any,
  ];

  const result = await recovery.execute({
    plan,
    strategy,
    lead,
    primaryCandidates,
    format: 'champions_reg_m_b_doubles',
    context,
    resolveCompetitiveTeam: (team) => team,
  });

  assert(result.executed, 'Recovery deve ser executado quando elegível.');
  assert(recoverySourceFetched, 'Recovery Candidate Source deve ser consultado durante o recovery.');
  assert(result.stopReason !== 'DEADLINE_REACHED', 'Stop reason não pode ser estouro de tempo.');
  assert(result.stopReason !== 'PLAN_NOT_ELIGIBLE', 'Stop reason não pode ser ineligível.');
  assert(result.stopReason !== 'NO_CAPABILITY_REQUESTS_DERIVED', 'Stop reason não pode ser plano sem requests.');
  assert(context.phaseBudget.recoveryTimeAvailableMs() >= 2500, 'Tempo reservado para recovery no início deve ser >= 2.500ms.');

  console.log('✅ AdaptiveRecoveryReachability unit test passou.');
}

if (require.main === module) {
  testAdaptiveRecoveryReachabilityUnit();
}
