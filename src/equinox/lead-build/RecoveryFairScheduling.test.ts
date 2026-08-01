import { AdaptiveStrategyRecovery, AdaptiveRecoveryResult, RecoverySessionState } from './AdaptiveStrategyRecovery';
import { RecoveryCapabilityPlan } from './RecoveryCapabilityPlanner';
import { createLeadBuildRequestContext } from './LeadBuildRequestContext';
import { buildAggregateRecoveryDiagnostic } from './RecoveryDiagnostics';
import { PokemonData } from '../core/AnalysisContext';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

interface SchedulingTask {
  plan: RecoveryCapabilityPlan;
  strategy: any;
  lead: [PokemonData, PokemonData];
  state?: RecoverySessionState;
  result?: AdaptiveRecoveryResult;
}

/**
 * Replica, de forma mínima, o laço de rodadas justas de
 * `LeadStrategyRecommendationService.runFairRecoveryRounds()` — a mesma
 * sequência de chamadas a `execute({ maxPassesThisCall: 1, priorState })`
 * que o orquestrador real usa, para validar o mecanismo de justiça isolado
 * de toda a infraestrutura de busca de time (candidatos reais, Mongo etc.).
 */
async function runFairRounds(
  recovery: AdaptiveStrategyRecovery,
  tasks: Array<{
    plan: RecoveryCapabilityPlan;
    strategy: any;
    lead: [PokemonData, PokemonData];
    state?: RecoverySessionState;
    result?: AdaptiveRecoveryResult;
  }>,
  context: ReturnType<typeof createLeadBuildRequestContext>,
): Promise<void> {
  const maxRounds = Math.max(...tasks.map(t => t.plan.maximumPasses), 1);
  let round = 0;

  while (round < maxRounds) {
    round += 1;
    let madeProgress = false;

    for (const task of tasks) {
      if (task.state?.done) continue;
      if (context.recoveryBudget.passesRemaining <= 0) break;

      const result = await recovery.execute({
        plan: task.plan,
        strategy: task.strategy,
        lead: task.lead,
        primaryCandidates: [],
        format: 'champions_reg_m_b_doubles',
        context,
        resolveCompetitiveTeam: team => team,
        maxPassesThisCall: 1,
        priorState: task.state,
      });

      task.result = result;
      task.state = result.state;
      if (result.passesExecuted > 0) madeProgress = true;
    }

    if (!madeProgress) break;
    if (context.recoveryBudget.passesRemaining <= 0) break;
  }

  for (const task of tasks) {
    if (!task.result) {
      const result = await recovery.execute({
        plan: task.plan,
        strategy: task.strategy,
        lead: task.lead,
        primaryCandidates: [],
        format: 'champions_reg_m_b_doubles',
        context,
        resolveCompetitiveTeam: team => team,
        maxPassesThisCall: 1,
        priorState: task.state,
      });
      task.result = result;
      task.state = result.state;
    }
  }
}

function buildPlan(overrides: Partial<RecoveryCapabilityPlan> = {}): RecoveryCapabilityPlan {
  return {
    strategyId: 'strategy',
    eligible: true,
    eligibilityReasons: ['PRIMARY_SEARCH_EXHAUSTED_QUALITY_GATES'],
    ineligibilityReasons: [],
    requests: [
      {
        capability: 'TYPE_RESISTANCE',
        attackType: 'Ice',
        priority: 'CRITICAL',
        minimumDistinctAnswers: 1,
        desiredDistinctAnswers: 2,
        appliesTo: 'BOTH',
        evidenceReasonCodes: ['UNANSWERED_REPEATED_WEAKNESS'],
      },
    ],
    maximumPasses: 2,
    maximumAdditionalRawCandidates: 60,
    maximumAdditionalUsableCandidates: 16,
    sourceLimitations: [],
    ...overrides,
  };
}

const emptyPlan = (): RecoveryCapabilityPlan =>
  buildPlan({ eligible: false, requests: [], ineligibilityReasons: ['NO_CAPABILITY_REQUESTS_DERIVED'] });

const mockLead: [PokemonData, PokemonData] = [
  { name: 'Charizard-Mega-Y', types: ['Fire', 'Flying'] } as any,
  { name: 'Whimsicott', types: ['Grass', 'Fairy'] } as any,
];

// Nunca encontra candidato compatível — força o teto de passes a ser a
// única coisa que determina quando cada tarefa termina, isolando o
// comportamento de agendamento do comportamento de aceitação de time.
const neverMatchesSource = {
  async fetch() {
    return { candidates: [], rawCount: 5, sourceExhausted: false, endCursor: null };
  },
};

export async function testRecoveryFairScheduling() {
  console.log('[Equinox Test] Testando o agendamento justo de recovery entre estratégias...');

  // Caso 2 — justiça mínima: 3 estratégias elegíveis, 3 passes de orçamento.
  // Nenhuma pode receber o 2º passe antes de todas terem recebido o 1º.
  {
    const context = createLeadBuildRequestContext('req-fair-case2');
    context.recoveryBudget.passesRemaining = 3;
    const recovery = new AdaptiveStrategyRecovery(neverMatchesSource);

    const tasks: SchedulingTask[] = ['A', 'B', 'C'].map(id => ({
      plan: buildPlan({ strategyId: id }),
      strategy: { id } as any,
      lead: mockLead,
    }));

    await runFairRounds(recovery, tasks, context);

    const [a, b, c] = tasks;
    assert(a.result!.diagnostic.passesConsumed === 1, `Caso 2: A deveria ter 1 passe, teve ${a.result!.diagnostic.passesConsumed}.`);
    assert(b.result!.diagnostic.passesConsumed === 1, `Caso 2: B deveria ter 1 passe, teve ${b.result!.diagnostic.passesConsumed}.`);
    assert(c.result!.diagnostic.passesConsumed === 1, `Caso 2: C deveria ter 1 passe, teve ${c.result!.diagnostic.passesConsumed}.`);
    console.log('✅ Caso 2 (justiça mínima) PASS');
  }

  // Caso 3 — redistribuição: 2 estratégias elegíveis, 3 passes de orçamento.
  // Rodada 1 dá 1 a cada (2 consumidos); o passe restante vai para uma delas.
  {
    const context = createLeadBuildRequestContext('req-fair-case3');
    context.recoveryBudget.passesRemaining = 3;
    const recovery = new AdaptiveStrategyRecovery(neverMatchesSource);

    const tasks: SchedulingTask[] = ['A', 'B'].map(id => ({
      plan: buildPlan({ strategyId: id }),
      strategy: { id } as any,
      lead: mockLead,
    }));

    await runFairRounds(recovery, tasks, context);

    const [a, b] = tasks;
    const totalConsumed = a.result!.diagnostic.passesConsumed + b.result!.diagnostic.passesConsumed;
    assert(totalConsumed === 3, `Caso 3: total consumido deveria ser 3, foi ${totalConsumed}.`);
    assert(a.result!.diagnostic.passesConsumed >= 1, 'Caso 3: A deveria ter recebido ao menos 1 passe na 1ª rodada.');
    assert(b.result!.diagnostic.passesConsumed >= 1, 'Caso 3: B deveria ter recebido ao menos 1 passe na 1ª rodada.');
    assert(
      a.result!.diagnostic.passesConsumed === 2 || b.result!.diagnostic.passesConsumed === 2,
      'Caso 3: o passe redistribuído deveria elevar uma das duas a 2 passes.',
    );
    console.log('✅ Caso 3 (redistribuição) PASS');
  }

  // Caso 4 — 1ª estratégia sem requests não deve consumir nenhum passe, e as
  // demais devem continuar recebendo orçamento normalmente.
  {
    const context = createLeadBuildRequestContext('req-fair-case4');
    context.recoveryBudget.passesRemaining = 2;
    const recovery = new AdaptiveStrategyRecovery(neverMatchesSource);

    const tasks: SchedulingTask[] = [
      { plan: emptyPlan(), strategy: { id: 'A' } as any, lead: mockLead },
      { plan: buildPlan({ strategyId: 'B' }), strategy: { id: 'B' } as any, lead: mockLead },
      { plan: buildPlan({ strategyId: 'C' }), strategy: { id: 'C' } as any, lead: mockLead },
    ];

    await runFairRounds(recovery, tasks, context);

    const [a, b, c] = tasks;
    assert(a.result!.diagnostic.passesConsumed === 0, `Caso 4: A (sem requests) não deveria consumir passes, consumiu ${a.result!.diagnostic.passesConsumed}.`);
    assert(a.result!.stopReason === 'NO_CAPABILITY_REQUESTS_DERIVED', `Caso 4: stopReason de A deveria ser NO_CAPABILITY_REQUESTS_DERIVED, foi ${a.result!.stopReason}.`);
    assert(b.result!.diagnostic.passesConsumed >= 1, 'Caso 4: B deveria ter recebido ao menos 1 passe.');
    assert(c.result!.diagnostic.passesConsumed >= 1, 'Caso 4: C deveria ter recebido ao menos 1 passe quando o orçamento permitir.');
    console.log('✅ Caso 4 (1ª estratégia sem requests não bloqueia as demais) PASS');
  }

  // Caso 5 — agregado preservado: A executa, B não. O agregado não pode ser
  // sobrescrito pelo resultado do último item processado.
  {
    const context = createLeadBuildRequestContext('req-fair-case5');
    context.recoveryBudget.passesRemaining = 1;
    const recovery = new AdaptiveStrategyRecovery(neverMatchesSource);

    const tasks: SchedulingTask[] = [
      { plan: buildPlan({ strategyId: 'A' }), strategy: { id: 'A' } as any, lead: mockLead },
      { plan: buildPlan({ strategyId: 'B' }), strategy: { id: 'B' } as any, lead: mockLead },
    ];

    await runFairRounds(recovery, tasks, context);

    const [a, b] = tasks;
    assert(a.result!.diagnostic.recoveryExecuted === true, 'Caso 5: A deveria ter recoveryExecuted=true.');
    assert(b.result!.diagnostic.recoveryExecuted === false, 'Caso 5: B deveria ter recoveryExecuted=false (orçamento esgotado por A).');

    const aggregate = buildAggregateRecoveryDiagnostic([a.result!.diagnostic, b.result!.diagnostic]);
    assert(aggregate.recoveryExecutedAny === true, 'Caso 5: aggregate.recoveryExecutedAny deveria ser true.');
    assert(aggregate.recoveryExecutedCount === 1, `Caso 5: aggregate.recoveryExecutedCount deveria ser 1, foi ${aggregate.recoveryExecutedCount}.`);
    console.log('✅ Caso 5 (agregado preservado, sem sobrescrita) PASS');
  }

  console.log('✅ RecoveryFairScheduling testado com sucesso!');
}

if (require.main === module) {
  testRecoveryFairScheduling().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
