import { createLeadBuildRequestContext } from './LeadBuildRequestContext';
import { AdaptiveStrategyRecovery } from './AdaptiveStrategyRecovery';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

export async function testGlobalRecoveryBudgetE2E() {
  console.log('[Equinox Test] Testando a imposição do orçamento global por requisição...');

  const mockSource = {
    async fetch() {
      return {
        candidates: [],
        rawCount: 30,
        sourceExhausted: false,
        endCursor: null,
      };
    },
  };

  const recovery = new AdaptiveStrategyRecovery(mockSource as any);
  const context = createLeadBuildRequestContext('req-global-budget-01');

  const mockPlan = {
    strategyId: 'sun_offense',
    eligible: true,
    eligibilityReasons: [],
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
  };

  const mockStrategy = { id: 'sun_offense', lead: ['Charizard-Mega-Y', 'Whimsicott'] } as any;
  const mockLead = [
    { name: 'Charizard-Mega-Y', types: ['Fire', 'Flying'] },
    { name: 'Whimsicott', types: ['Grass', 'Fairy'] },
  ] as any;

  // Execute strategy A recovery
  await recovery.execute({
    plan: mockPlan as any,
    strategy: mockStrategy,
    lead: mockLead,
    primaryCandidates: [],
    format: 'gen9vgc2024',
    context,
    resolveCompetitiveTeam: team => team,
  });

  // Verify budget decremented across strategy A
  assert(context.recoveryBudget.passesRemaining <= 0, 'As passagens de recovery devem ter sido consumidas pelo limite global.');
  assert(context.recoveryBudget.rawCandidatesRemaining <= 0, 'Candidatos brutos devem ter sido deduzidos do limite global de 60.');

  // Attempt strategy B recovery with exhausted budget
  const resB = await recovery.execute({
    plan: mockPlan as any,
    strategy: { ...mockStrategy, id: 'tailwind_rush' },
    lead: mockLead,
    primaryCandidates: [],
    format: 'gen9vgc2024',
    context,
    resolveCompetitiveTeam: team => team,
  });

  assert(resB.executed === false, 'Estratégia B não deve executar recovery após o orçamento global ser esgotado.');
  // Antes da 087-F, orçamento esgotado e plano inelegível compartilhavam o
  // mesmo rótulo (`NOT_ELIGIBLE`), o que escondeu a causa raiz real da
  // starvation confirmada na investigação 087-D/087-E. Agora são distintos.
  assert(resB.stopReason === 'PASS_BUDGET_EXHAUSTED', 'Stop reason deve ser PASS_BUDGET_EXHAUSTED devido ao orçamento esgotado (não PLAN_NOT_ELIGIBLE).');
  console.log('✅ Global recovery budget E2E passou com sucesso.');
}

if (require.main === module) {
  testGlobalRecoveryBudgetE2E().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
