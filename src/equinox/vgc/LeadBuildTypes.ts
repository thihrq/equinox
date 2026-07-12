// src/equinox/vgc/LeadBuildTypes.ts
// Tipos e contratos centrais do pipeline Build-Around-Lead (Champions Doubles)

import { PokemonData } from '../core/AnalysisContext';
import { TeamLegalityResult } from '../competitive/CompetitiveTeamLegalityValidator';
import { TeamDataCoverage } from '../competitive/TeamDataCoverage';

// ─── Modo de Construção ───────────────────────────────────────────────────────

export type TeamBuildMode =
  | 'complete-core'       // Fluxo atual: 3 Pokémon → motor completa 3
  | 'build-around-lead';  // Novo fluxo: 2 Pokémon lead fixa → motor completa 4

// ─── Entrada da API ───────────────────────────────────────────────────────────

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

// ─── Perfil de Capacidades da Lead ────────────────────────────────────────────

export interface LeadWeatherCapability {
  family: 'rain' | 'sun' | 'sand' | 'snow';
  setter: string;           // Nome do Pokémon setter
  setterAbility: string;    // Habilidade que ativa o clima
}

export interface LeadSpeedControl {
  type: 'tailwind' | 'trick_room' | 'icy_wind' | 'electroweb' | 'thunder_wave' | 'swift_swim' | 'chlorophyll';
  source: string;            // Nome do Pokémon
  move?: string;             // Golpe que provê controle (se aplicável)
  ability?: string;          // Habilidade (se aplicável)
}

export interface LeadProtectionCapability {
  type: 'wide_guard' | 'fake_out' | 'follow_me' | 'rage_powder' | 'ally_switch' | 'protect' | 'quick_guard';
  source: string;
  move: string;
}

export interface LeadOffensiveCapability {
  type: string;              // Ex: 'stab_water', 'spread_rock_slide'
  source: string;
  stab: boolean;
  spread: boolean;
  priority: boolean;
  basePower: number;
}

export interface LeadDefensiveSynergy {
  description: string;       // Ex: 'Chuva reduz dano Fire contra Aggron-Mega'
  beneficiary: string;       // Pokémon que se beneficia
  mechanism: string;         // Ex: 'weather_reduction', 'type_immunity', 'levitate'
}

export interface LeadMissingRole {
  role: string;              // Ex: 'redirection', 'fake_out', 'trick_room_setter'
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

// ─── Estratégia de Lead ───────────────────────────────────────────────────────

export interface TurnOneOption {
  pokemonName: string;
  action: string;            // Ex: 'Tailwind', 'Fake Out on slot 2', 'Protect'
  target?: string;           // Ex: 'opponent_slot_1'
  reasoning: string;
}

export interface StrategyRoleRequirement {
  role: string;              // Ex: 'swift-swim-attacker', 'trick-room-setter'
  priority: 'required' | 'preferred' | 'optional';
  weight: number;            // Peso para scoring (0–100)
  description: string;       // Explicação do porquê a role é necessária
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

  feasibilityScore: number;  // 0–100
}

// ─── Busca de Complementos ────────────────────────────────────────────────────

export interface LeadCompletionSearchInput {
  lead: [PokemonData, PokemonData];
  strategy: LeadStrategyCandidate;
  candidates: PokemonData[];
  maxCandidatesPerStage: number;
  format: string;
}

export interface StrategyCoverage {
  fulfilledRequired: string[];
  fulfilledPreferred: string[];
  fulfilledOptional: string[];
  unresolved: string[];
  coverageScore: number;     // 0–100
}

export interface LeadCompletionResult {
  fullTeam: PokemonData[];          // 6 Pokémon (lead + 4 complementos)
  strategy: LeadStrategyCandidate;
  strategyCoverage: StrategyCoverage;
  fullTeamScore: number;
  dataCoverage?: TeamDataCoverage;
  unresolvedRequirements: string[];
}

// ─── Avaliação do Time Completo ───────────────────────────────────────────────

export interface TeamWeakness {
  type: string;
  severity: 'critical' | 'moderate' | 'minor';
  exposedPokemon: string[];
  mitigatedBy?: string;      // Pokémon ou mecânica que mitiga
}

export interface FullTeamEvaluation {
  legal: boolean;
  strategyComplete: boolean;
  teamLegality: TeamLegalityResult;
  roleCoverage: {
    fulfilled: string[];
    missing: string[];
    redundant: string[];
  };

  roleCoverageScore: number;          // 0–100
  offensiveBalanceScore: number;      // 0–100
  defensiveCoverageScore: number;     // 0–100
  speedControlScore: number;          // 0–100
  matchupFlexibilityScore: number;    // 0–100

  overallScore: number;               // Média ponderada

  weaknesses: TeamWeakness[];
  warnings: string[];
  strengths: string[];
}

// ─── Quarteto com Lead Travada ────────────────────────────────────────────────

export interface PlannedTurn {
  turn: number;
  pokemon: string;
  action: string;
  target?: string;
  reasoning: string;
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'risk';
}

export interface StrategyAssessment {
  contractErrors: ValidationIssue[];
  warnings: ValidationIssue[];
  matchupRisks: ValidationIssue[];
}

export interface PlannedActionLine {
  pokemon: string;
  action: string;
  reasoning: string;
}

export interface TurnPlanLine {
  id: string;
  actions: [PlannedActionLine, PlannedActionLine];
  objective: string;
  risks: string[];
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
  assessment: StrategyAssessment;
  turnPlanLines: TurnPlanLine[];
}

// ─── Playbook ─────────────────────────────────────────────────────────────────

export interface PlaybookAction {
  pokemon: string;
  action: string;
  target?: string;
  reasoning: string;
  conditionalOn?: string;    // Ex: 'opponent_has_trick_room_setter'
}

export interface PlaybookTransition {
  trigger: string;           // Ex: 'lead_pokemon_fainted', 'trick_room_expires'
  switchIn: string;          // Pokémon que entra
  switchOut?: string;        // Pokémon que sai (se aplicável)
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

  executionIndex: number;    // 0–100: quão fácil de executar o plano
  contractValid: boolean;
}

// ─── Resposta Final do Pipeline ───────────────────────────────────────────────

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
