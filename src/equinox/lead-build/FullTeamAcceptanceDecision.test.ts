import { decideFullTeamAcceptance } from './FullTeamAcceptanceDecision';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testFullTeamAcceptanceDecision() {
  console.log('[Equinox Test] Testando a centralização das decisões de aceite de time...');

  const mockLegality = { legal: true, issues: [] };
  const mockEvaluation = {
    overallScore: 80,
    roleCoverageScore: 70,
    offensiveBalanceScore: 60,
    strategyComplete: true,
    qualityResult: { valid: true, reasons: [] },
    defensiveQuality: { valid: true, score: 75, reasons: [] },
  } as any;

  const decision = decideFullTeamAcceptance({
    legality: mockLegality,
    evaluation: mockEvaluation,
  });

  assert(decision.accepted === true, 'Time com métricas ideais deve ser aceito');
  assert(decision.failedReasonCodes.length === 0, 'Não deve possuir razões de falha');

  console.log('✅ FullTeamAcceptanceDecision testado com sucesso!');
}

if (require.main === module) {
  testFullTeamAcceptanceDecision();
}
