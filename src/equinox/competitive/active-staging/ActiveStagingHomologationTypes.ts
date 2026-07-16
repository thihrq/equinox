import { CompetitiveSetValidationInput } from '../../data-validation/CompetitiveValidationTypes';
import { TeamDataCoverage } from '../TeamDataCoverage';

export const ACTIVE_STAGING_SUCCESS_EXIT_CODE = 0;
export const ACTIVE_STAGING_FUNCTIONAL_GATE_EXIT_CODE = 1;
export const ACTIVE_STAGING_CONFIG_EXIT_CODE = 2;
export const ACTIVE_STAGING_MONGO_READ_EXIT_CODE = 3;

export type FunctionalHomologationExitCode = 0 | 1 | 2 | 3;
export type CompetitiveVerificationState = 'unverified' | 'staging-controlled' | 'production-approved';

export function isCompetitiveVerificationState(value: string): value is CompetitiveVerificationState {
  return value === 'unverified' || value === 'staging-controlled' || value === 'production-approved';
}

export interface ActiveStagingSetQuery {
  collectionName: 'pokemonsets_v2_staging';
  setIds: readonly string[];
  status: 'active';
  active: true;
}

export interface ActiveStagingSetRecord extends CompetitiveSetValidationInput {
  setId: string;
  pokemon: string;
  pokemonName?: string;
  status: 'active';
  active: true;
  sourceType: 'curated';
  format: 'champions-reg-mb-doubles';
  activeRunId?: string;
}

export interface ActiveStagingSetLoadResult {
  collectionName: 'pokemonsets_v2_staging';
  records: ActiveStagingSetRecord[];
  setIdsRead: string[];
  queryDurationMs: number;
}

export interface ActiveStagingHomologationScenario {
  id: string;
  leadPokemon: [string, string];
  expectedPresentedSetIds: [string, string];
}

export interface ActiveStagingScenarioReport {
  scenarioId: string;
  leadPokemon: [string, string];
  expectedActiveV2SetsResolvedFromMongo: string[];
  expectedActiveV2SetsPresentedToEngine: string[];
  expectedActiveV2SetsAppliedToTeamData: string[];
  competitiveVerificationState: 'staging-controlled';
  localPilotFallbackUsed: false;
  engineExecuted: true;
  generatedStrategyIds: string[];
  selectedStrategyId: string;
  teamDataVerifiedSets: number;
  teamDataGeneratedFallbacks: number;
  teamDataUnknownSets: number;
  fullTeamEvaluationScore: number;
  fullTeamEvaluationExecuted: boolean;
  teamDataCoverage?: TeamDataCoverage;
  passed: boolean;
}

export interface ActiveStagingHomologationAggregate {
  activeRecordsLoadedByRepository: number;
  scenariosRun: number;
  scenariosPassed: number;
  uniqueActiveRecordsPresentedAcrossAllScenarios: number;
  scenariosWithEngineExecution: number;
  scenariosWithZeroFallbacks: number;
  localPilotFallbackUsed: false;
  readyForAtlasReadOnlyHomologation: boolean;
}

export interface ActiveStagingHomologationReport {
  aggregate: ActiveStagingHomologationAggregate;
  scenarios: ActiveStagingScenarioReport[];
}

export interface ActiveStagingOperationalEvidence extends ActiveStagingHomologationReport {
  targetCollection: 'pokemonsets_v2_staging';
  productionCollectionReads: number;
  observedMongoWriteCommands: number;
  observedStagingWriteCommands: number;
  observedProductionWriteCommands: number;
  productionWrites: number;
  recordsWritten: number;
}
