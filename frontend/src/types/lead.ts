// frontend/src/types/lead.ts

export interface PokemonInput {
  name: string;
  item?: string;
  ability?: string;
  moves?: string[];
  nature?: string;
}

export type LeadMode = 'fixed-lead' | 'core-pair';

export interface SuggestFromLeadRequest {
  lead: [PokemonInput, PokemonInput];
  format: string;
  leadMode: LeadMode;
  allowLegendaries: boolean;
  teamIdentity: string;
}

export interface LeadWeatherCapability {
  family: 'rain' | 'sun' | 'sand' | 'snow';
  setter: string;
  setterAbility: string;
}

export interface LeadSpeedControl {
  type: 'tailwind' | 'trick_room' | 'icy_wind' | 'electroweb' | 'thunder_wave' | 'swift_swim' | 'chlorophyll';
  source: string;
  move?: string;
  ability?: string;
}

export interface LeadProtectionCapability {
  type: 'wide_guard' | 'fake_out' | 'follow_me' | 'rage_powder' | 'ally_switch' | 'protect' | 'quick_guard';
  source: string;
  move: string;
}

export interface LeadOffensiveCapability {
  type: string;
  source: string;
  stab: boolean;
  spread: boolean;
  priority: boolean;
  basePower: number;
}

export interface LeadDefensiveSynergy {
  description: string;
  beneficiary: string;
  mechanism: string;
}

export interface LeadMissingRole {
  role: string;
  priority: 'critical' | 'important' | 'nice_to_have';
  reason: string;
}

export interface LeadConflict {
  description: string;
  severity: 'hard' | 'soft';
  pokemonInvolved: string[];
}

export interface LeadCapabilityProfile {
  lead: [string, string];
  weather: LeadWeatherCapability[];
  speedControl: LeadSpeedControl[];
  protection: LeadProtectionCapability[];
  offensivePressure: LeadOffensiveCapability[];
  defensiveSynergies: LeadDefensiveSynergy[];
  missingRoles: LeadMissingRole[];
  conflicts: LeadConflict[];
  warnings: string[];
  mechanicallyValid: boolean;
}

export interface TurnOneOption {
  pokemonName: string;
  action: string;
  target?: string;
  reasoning: string;
}

export interface StrategyRoleRequirement {
  role: string;
  priority: 'required' | 'preferred' | 'optional';
  weight: number;
  description: string;
}

export interface LeadStrategyCandidate {
  id: string;
  name: string;
  objective: string;
  lead: [string, string];
  turnOneOptions: TurnOneOption[];
  requiredRoles: StrategyRoleRequirement[];
  optionalRoles: StrategyRoleRequirement[];
  speedAxis: 'fast' | 'slow' | 'hybrid' | 'neutral';
  contractValid: boolean;
  validationErrors: string[];
  feasibilityScore: number;
}

export interface StrategyCoverage {
  fulfilledRequired: string[];
  fulfilledPreferred: string[];
  fulfilledOptional: string[];
  unresolved: string[];
  coverageScore: number;
}

export interface CompetitiveStatSpread {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface CompetitiveSetValidation {
  legal: boolean;
  errors: string[];
  warnings: string[];
}

export type CompetitiveSetSource = 'user' | 'curated' | 'database' | 'generated' | 'v2-draft' | 'v2-reviewed' | 'v2-verified' | 'legacy' | 'unknown';

export interface CompetitivePokemonSet {
  name: string;
  types: string[];
  item: string;
  ability: string;
  nature: string;
  evs: CompetitiveStatSpread;
  ivs: CompetitiveStatSpread;
  moves: [string, string, string, string];
  role?: string;
  level?: number;
  teraType?: string;
  setId?: string;
  confidence?: number;
  status?: string;
  sourceType?: string;
  setSource: CompetitiveSetSource;
  validation: CompetitiveSetValidation;
}

export interface TeamDataCoverage {
  verifiedSets: number;
  reviewedSets: number;
  draftSets: number;
  generatedFallbacks: number;
  legacyFallbacks: number;
  unknownSets: number;
  confidenceScore: number;
  verifiedCompetitiveLabel: boolean;
  competitiveIndexCap: number;
  notes: string[];
}

export interface PokemonData {
  name: string;
  types: string[];
  baseStats: {
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
  };
  ability?: string;
  abilities?: Record<string, string>;
  item?: string;
  moves?: string[];
  nature?: string;
  role?: string;
  competitiveSet?: CompetitivePokemonSet;
}

export interface LeadCompletionResult {
  fullTeam: PokemonData[];
  strategy: LeadStrategyCandidate;
  strategyCoverage: StrategyCoverage;
  fullTeamScore: number;
  dataCoverage?: TeamDataCoverage;
  unresolvedRequirements: string[];
}

export interface TeamWeakness {
  type: string;
  severity: 'critical' | 'moderate' | 'minor';
  exposedPokemon: string[];
  mitigatedBy?: string;
}

export interface FullTeamEvaluation {
  legal: boolean;
  strategyComplete: boolean;
  teamLegality: {
    legal: boolean;
    issues: Array<{
      code: string;
      severity: 'error' | 'warning';
      pokemon?: string[];
      message: string;
    }>;
  };
  roleCoverage: {
    fulfilled: string[];
    missing: string[];
    redundant: string[];
  };
  roleCoverageScore: number;
  offensiveBalanceScore: number;
  defensiveCoverageScore: number;
  speedControlScore: number;
  matchupFlexibilityScore: number;
  overallScore: number;
  weaknesses: TeamWeakness[];
  warnings: string[];
  strengths: string[];
}

export interface PlannedTurn {
  turn: number;
  pokemon: string;
  action: string;
  target?: string;
  reasoning: string;
}

export interface LeadLockedQuartet {
  selectedFour: [string, string, string, string];
  lead: [string, string];
  backline: [string, string];
  strategyId: string;
  contractValid: boolean;
  score: number;
  openingPlan: PlannedTurn[];
  transitionPlan: PlannedTurn[];
  winConditions: string[];
  risks: string[];
}

export interface PlaybookAction {
  pokemon: string;
  action: string;
  target?: string;
  reasoning: string;
  conditionalOn?: string;
}

export interface PlaybookTransition {
  trigger: string;
  switchIn: string;
  switchOut?: string;
  reasoning: string;
}

export interface LeadPlaybook {
  strategyName: string;
  selectedFour: string[];
  lead: [string, string];
  backline: [string, string];
  turnOneOptions: PlaybookAction[];
  transitionOptions: PlaybookTransition[];
  winConditions: string[];
  avoidWhen: string[];
  threats: string[];
  executionIndex: number;
  contractValid: boolean;
}

export interface LeadStrategyResult {
  strategy: LeadStrategyCandidate;
  completions: LeadCompletionResult[];
  quartets: LeadLockedQuartet[];
  playbooks: LeadPlaybook[];
  teamEvaluation: FullTeamEvaluation;
  dataCoverage?: TeamDataCoverage;
}

export interface LeadSuggestionResult {
  lead: [string, string];
  leadProfile: LeadCapabilityProfile;
  strategies: LeadStrategyResult[];
  bestOverallTeam: PokemonData[];
  dataCoverage?: TeamDataCoverage;
  warnings: string[];
}
