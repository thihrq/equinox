import { PokemonData } from '../core/AnalysisContext';
import type { TeamIdentity } from '../recommendation/CandidateScoreEngine';
import type { CoverageRequirement } from '../recommendation/DiversityCandidateSelector';

export type EquinoxFormatMode =
  | 'vanilla'
  | 'radical_red'
  | 'champions_singles'
  | 'champions_doubles';

export type FormatSetWeatherPlan = 'rain' | 'sun' | 'sand' | 'snow';
export type FormatSetSpeedPlan = 'trick_room' | 'tailwind' | 'weather_speed' | 'standard';

export interface FormatSetPlanContext {
  primaryWeather?: FormatSetWeatherPlan;
  speedPlan?: FormatSetSpeedPlan;
}

export interface SetSourceInput {
  pokemon: PokemonData;
  format: string;
  savedSet?: {
    ability?: string;
    item?: string;
    moves?: string[];
    nature?: string;
    role?: string;
  } | null;
  defaultKit?: {
    ability?: string;
    item?: string;
    moves?: string[];
  } | null;
  basicKit?: {
    nature?: string;
    role?: string;
  } | null;
  preferCurated?: boolean;
  /**
   * Optional, format-specific plan context resolved from the user's base core.
   * This lets set generation adapt to the active plan without making VGC/Doubles
   * assumptions global across Vanilla/RadicalRed/Singles.
   */
  formatPlan?: FormatSetPlanContext;
}

export interface DiversitySelectionOptions {
  maxCandidates: number;
  topOverall: number;
  perRole: number;
  perType: number;
  minCandidates: number;
}

export interface FormatCandidateScoreParams {
  baseTeam: PokemonData[];
  candidate: PokemonData;
  format: string;
  teamIdentity: TeamIdentity;
  currentScore: number;
  currentRoles: string[];
  reasons: string[];
}

export interface FormatTeamValidationResult {
  valid: boolean;
  hardFailures: string[];
  warnings: string[];
}

export interface FormatSolver {
  readonly mode: EquinoxFormatMode;
  readonly id: string;
  readonly label: string;

  /** Applies only to formats where the displayed answer must obey Item Clause. */
  readonly usesItemClause: boolean;

  /** Applies only to Champions Doubles/VGC-style bring-6-pick-4 logic. */
  readonly usesFourOfSixModes: boolean;

  /** Applies only to Champions Doubles contracts such as redirection, Tailwind, TR, weather and terrain board control. */
  readonly usesDoublesMechanicContracts: boolean;

  /** Applies only to Champions Singles contracts such as hazards, removal, pivots and win conditions. */
  readonly usesSinglesFieldControlContracts: boolean;

  /** Applies to Radical Red boss gauntlet logic. */
  readonly usesBossGauntlet: boolean;

  normalizePokemonSet(input: SetSourceInput): PokemonData;

  normalizeFinalTeam(team: PokemonData[], format: string): PokemonData[];

  getDiversityOptions(): DiversitySelectionOptions;

  /**
   * Requisitos de cobertura mecânica que a diversificação deve garantir
   * antes da busca combinatória, além do que VgcRole consegue expressar.
   * Formatos sem contratos de mecânica de Doubles retornam [] (default
   * em BaseFormatSolver) e mantêm o comportamento atual inalterado.
   */
  getMandatoryMechanicCoverage(baseTeam: PokemonData[], format: string): CoverageRequirement[];

  adjustCandidateScore(params: FormatCandidateScoreParams): number;

  validateFinalTeam(team: PokemonData[], format: string): FormatTeamValidationResult;
}
