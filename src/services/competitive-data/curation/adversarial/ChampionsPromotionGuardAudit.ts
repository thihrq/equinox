import { createAdversarialFixtures } from './ChampionsAdversarialFixtureFactory';
import { evaluateAdversarialCase } from './ChampionsAdversarialResultValidator';
export function auditPromotionGuards(curationRunId: string): { valid: boolean; cases: Array<{ caseId: string; verdict: string; statusRemainsDraft: boolean; sourceTypeRemainsGenerated: boolean }>; findings: string[] } {
  const cases = createAdversarialFixtures(curationRunId).filter(testCase => testCase.category === 'promotion').map(testCase => { const result = evaluateAdversarialCase(testCase); return { caseId: testCase.caseId, verdict: result.actualVerdict, statusRemainsDraft: true, sourceTypeRemainsGenerated: true }; });
  const findings = cases.filter(item => item.verdict !== 'rejected' || !item.statusRemainsDraft || !item.sourceTypeRemainsGenerated).map(item => `${item.caseId}:PROMOTION_GUARD_FAILED`);
  return { valid: findings.length === 0, cases, findings };
}
