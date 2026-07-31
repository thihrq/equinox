import { AdaptiveStrategyRecovery } from './AdaptiveStrategyRecovery';
import { createLeadBuildRequestContext } from './LeadBuildRequestContext';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export async function testAdaptiveStrategyRecovery() {
  console.log('[Equinox Test] Testando o motor de recuperação adaptativa...');

  const mockSource = {
    async fetch() {
      return {
        candidates: [],
        rawCount: 0,
        sourceExhausted: true,
        endCursor: null,
      };
    },
  };

  const recovery = new AdaptiveStrategyRecovery(mockSource);
  const ctx = createLeadBuildRequestContext('req-rec-01');

  const mockPlan = {
    strategyId: 'sun_offense',
    eligible: false,
    eligibilityReasons: [],
    ineligibilityReasons: ['PRIMARY_SEARCH_SUCCEEDED'],
    requests: [],
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

  const result = await recovery.execute({
    plan: mockPlan,
    strategy: mockStrategy,
    lead: mockLead,
    primaryCandidates: [],
    format: 'gen9vgc2024',
    context: ctx,
    resolveCompetitiveTeam: team => team,
  });

  assert(result.executed === false, 'Não deve executar quando o plano não for elegível');
  assert(result.stopReason === 'PLAN_NOT_ELIGIBLE', 'stopReason deve ser PLAN_NOT_ELIGIBLE');
  assert(result.diagnostic.passesConsumed === 0, 'Plano inelegível não pode consumir passes.');

  console.log('✅ AdaptiveStrategyRecovery testado com sucesso!');
}

if (require.main === module) {
  testAdaptiveStrategyRecovery().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
