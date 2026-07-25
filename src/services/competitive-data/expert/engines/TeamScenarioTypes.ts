import { ExpertComponentResult } from '../CompetitiveDoublesExpertTypes';

export type ExpertScenarioType = 'opening' | 'speed-control' | 'weather-control' | 'terrain-control' | 'trick-room' | 'tailwind' | 'positioning' | 'pivoting' | 'endgame' | 'defensive-switch' | 'offensive-pressure';
export type ExpertScenarioAssessment = 'supports-candidate' | 'mixed' | 'does-not-support-candidate' | 'insufficient-evidence';

export interface TeamScenarioInput {
  candidateId: string;
  fullTeamPokemonIds: [string, string, string, string, string, string];
  leadPokemonIds: [string, string];
  opposingLeadPokemonIds: [string, string];
  scenarioType: ExpertScenarioType;
  weather?: string;
  terrain?: string;
  trickRoomTurns: number;
  tailwindTurns: number;
  assumptions?: string[];
  limitations?: string[];
  teamFeatures?: ScenarioFeatureSet;
  opposingFeatures?: ScenarioFeatureSet;
  unsupportedMechanics?: string[];
}

export interface ScenarioFeatureSet {
  speedControl?: string[];
  weather?: string[];
  terrain?: string[];
  fakeOut?: boolean;
  redirection?: boolean;
  protect?: boolean;
  priority?: boolean;
  spreadPressure?: boolean;
  pivoting?: boolean;
  defensiveSwitch?: boolean;
}

export interface TeamScenarioResult extends ExpertComponentResult {
  scenarioId: string;
  candidateId: string;
  scenarioType: ExpertScenarioType;
  favorableFactors: string[];
  unfavorableFactors: string[];
  candidateContribution: string[];
  partnerDependencies: string[];
  criticalRisks: string[];
  assessment: ExpertScenarioAssessment;
  assumptions: string[];
  evidenceLevel: 'deterministic-expert-scenario';
  resultDigest: string;
  inputs: TeamScenarioInput;
  result: ExpertScenarioAssessment;
  limitations: string[];
  unsupportedMechanics: string[];
}
