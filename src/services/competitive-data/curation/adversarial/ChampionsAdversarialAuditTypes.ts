import { CurationSetDraft, MatchupScenario, FullTeamEvaluation } from '../CompetitiveCurationTypes';

export type ChampionsAdversarialExpectedVerdict = 'rejected' | 'human-review-required' | 'agent-reviewed';
export type ChampionsAdversarialCategory = 'legality' | 'coherence' | 'role' | 'team-legality' | 'evidence' | 'promotion' | 'threshold' | 'diversity' | 'scenario' | 'agent-independence';
export interface ChampionsAdversarialCase {
  caseId: string;
  title: string;
  category: ChampionsAdversarialCategory;
  baseCandidateId?: string;
  candidate?: CurationSetDraft;
  teamFixtures?: FullTeamEvaluation[];
  scenarioFixtures?: MatchupScenario[];
  mutation: string;
  expectedVerdict: ChampionsAdversarialExpectedVerdict;
  expectedReasonCodes: string[];
  mustNotReachAgents?: string[];
  mustReachAgents?: string[];
  fixtureSource: 'adversarial-test-fixture';
  productionEligible: false;
}
export interface AdversarialCaseResult { caseId: string; expectedVerdict: ChampionsAdversarialExpectedVerdict; actualVerdict: ChampionsAdversarialExpectedVerdict; expectedReasonCodes: string[]; actualReasonCodes: string[]; passed: boolean; reachedAgents: string[]; fullTeamEvaluated: boolean; }
export interface ChampionsAdversarialAuditRunManifest { auditRunId: string; sourceCurationRunId: string; regulationId: 'M-B'; packageDigest: string; rosterDigest: string; mechanicsDigest: string; adversarialPolicyVersion: string; curationPolicyVersion: string; fixtureCount: number; rejectedExpected: number; humanReviewExpected: number; agentReviewedExpected: number; startedAt: string; finishedAt: string; mongoReads: 0; mongoWrites: 0; productionWrites: 0; artifactsDigest: string; }
