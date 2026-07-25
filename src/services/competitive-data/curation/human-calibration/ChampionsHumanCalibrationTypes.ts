import { CurationSetDraft, FullTeamEvaluation, MatchupScenario } from '../CompetitiveCurationTypes';

export type ChampionsHumanVerdict = 'approved' | 'revise' | 'rejected';
export type ChampionsHumanConfidence = 'high' | 'medium' | 'low';
export type ChampionsHumanCalibrationState = 'awaiting-human-review' | 'reviews-incomplete' | 'ready-for-analysis' | 'finalized';
export type ChampionsHumanReviewerRole = 'competitive-player' | 'team-builder' | 'format-specialist' | 'technical-reviewer' | 'other';

export interface HumanReviewFullTeamContext {
  structureId: string;
  identity: string;
  basePokemonIds: string[];
  recommendedPokemonIds: string[];
  teamPokemonIds: string[];
}
export interface HumanReviewMatchupContext {
  scenarioId: string;
  resultCategory: 'favorable' | 'neutral' | 'adverse';
  opposingPokemonIds: string[];
  partnerPokemonIds: string[];
  assumptions: string[];
  limitations: string[];
  evidenceLevel: 'agent-scenario-review';
}
export interface ChampionsHumanCalibrationReviewItem {
  reviewItemId: string;
  candidateId: string;
  candidateDigest: string;
  pokemonId: string;
  speciesId: string;
  formId?: string;
  displayName: string;
  set: Pick<CurationSetDraft, 'itemId' | 'abilityId' | 'natureId' | 'evs' | 'ivs' | 'moveIds'>;
  declaredRoles: string[];
  targetArchetypes: string[];
  mechanicalEvidence: {
    pokemonEligible: boolean;
    formResolved: boolean;
    abilityLegal: boolean;
    itemExists: boolean;
    movesInLearnset: boolean;
    natureValid: boolean;
    evsValid: boolean;
    ivsValid: boolean;
  };
  fullTeamContext: HumanReviewFullTeamContext[];
  matchupContext: HumanReviewMatchupContext[];
  knownLimitations: string[];
  hiddenDuringBlindReview: { agentVerdict: true; aggregateScores: true; candidatePairPosition: true; finalConsolidationRationale: true };
}
export interface ChampionsHumanCalibrationBatch {
  calibrationBatchId: string;
  sourceCurationRunId: string;
  sourceAuditRunId: string;
  regulationId: 'M-B';
  packageDigest: string;
  rosterDigest: string;
  mechanicsDigest: string;
  reviewPolicyVersion: string;
  anonymizationVersion: string;
  candidateCount: 20;
  reviewOrderSeed: string;
  reviewItems: ChampionsHumanCalibrationReviewItem[];
  createdAt: string;
  mongoReads: 0;
  mongoWrites: 0;
  productionWrites: 0;
}
export interface ChampionsHumanFinding { code: string; category: string; note?: string; }
export interface ChampionsHumanSuggestedChange {
  field: 'item' | 'ability' | 'nature' | 'evs' | 'ivs' | 'moves' | 'roles' | 'archetypes' | 'full-team-context' | 'other';
  currentValue: unknown;
  suggestedValue: unknown;
  rationale: string;
  reasonCodes: string[];
  requiresDamageCalculation: boolean;
  requiresSpeedCalculation: boolean;
  requiresMetaValidation: boolean;
  requiresBattleTesting: boolean;
}
export interface ChampionsHumanCalibrationReview {
  reviewId: string;
  calibrationBatchId: string;
  reviewItemId: string;
  candidateId: string;
  candidateDigest: string;
  reviewerId: string;
  reviewerRole: ChampionsHumanReviewerRole;
  humanVerdict: ChampionsHumanVerdict;
  confidence: ChampionsHumanConfidence;
  legalityConfirmed: true | false | 'uncertain';
  coherenceConfirmed: true | false | 'uncertain';
  abilityConfirmed: true | false | 'uncertain';
  itemConfirmed: true | false | 'uncertain';
  natureConfirmed: true | false | 'uncertain';
  evSpreadConfirmed: true | false | 'uncertain';
  movesConfirmed: true | false | 'uncertain';
  roleConfirmed: true | false | 'uncertain';
  archetypeFitConfirmed: true | false | 'uncertain';
  fullTeamFitConfirmed: true | false | 'uncertain';
  matchupAssessmentConfirmed: true | false | 'uncertain';
  findings: ChampionsHumanFinding[];
  suggestedChanges: ChampionsHumanSuggestedChange[];
  reviewNotes: string;
  reviewedAt: string;
  attestation: { performedByHuman: true; agentGeneratedDecision: false; reviewedCandidateDigest: string };
}
export interface HumanCalibrationRunManifest {
  calibrationBatchId: string;
  sourceCurationRunId: string;
  sourceAuditRunId: string;
  regulationId: 'M-B';
  packageDigest: string;
  rosterDigest: string;
  mechanicsDigest: string;
  reviewPolicyVersion: string;
  calibrationMetricVersion: string;
  anonymizationVersion: string;
  reviewMode: 'single-reviewer' | 'dual-reviewer';
  candidateCount: 20;
  expectedReviewCount: number;
  completedReviewCount: number;
  state: ChampionsHumanCalibrationState;
  createdAt: string;
  mongoReads: 0;
  mongoWrites: 0;
  productionWrites: 0;
  artifactsDigest: string;
}
