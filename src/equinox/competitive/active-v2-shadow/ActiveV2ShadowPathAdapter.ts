import type { ActiveStagingHomologationScenario, ActiveStagingSetRecord } from '../active-staging/ActiveStagingHomologationTypes';
import { ACTIVE_STAGING_SET_ALLOWLIST } from '../active-staging/ActiveStagingHomologationAllowlist';
import { buildActiveStagingEngineInput } from '../active-staging/ActiveStagingEngineAdapter';
import { runActiveStagingFunctionalEngineProbe, activeStagingRecordToPokemonData } from '../active-staging/ActiveStagingFunctionalEngineProbe';
import { calculateTeamDataCoverage } from '../TeamDataCoverage';
import type { ActiveV2ShadowPathResult } from './ActiveV2ShadowTypes';

export interface ActiveV2ShadowScenarioInput {
  scenario: ActiveStagingHomologationScenario;
  records: ActiveStagingSetRecord[];
  teamIdentity: string;
  allowLegendaries: boolean;
}

function selectScenarioRecords(
  scenario: ActiveStagingHomologationScenario,
  records: ActiveStagingSetRecord[],
): ActiveStagingSetRecord[] {
  const byId = new Map(records.map(record => [record.setId, record]));
  return scenario.expectedPresentedSetIds.map(setId => {
    const record = byId.get(setId);
    if (!record) throw new Error(`controlled source missing set ${setId}`);
    return record;
  });
}

function selectAllowlistedRecords(records: ActiveStagingSetRecord[]): ActiveStagingSetRecord[] {
  const allowlist = new Set<string>(ACTIVE_STAGING_SET_ALLOWLIST);
  return records.filter(record => allowlist.has(record.setId));
}

function assertActiveV2StagingRecords(records: ActiveStagingSetRecord[]): void {
  const allowlist = new Set<string>(ACTIVE_STAGING_SET_ALLOWLIST);
  for (const record of records) {
    if (record.status !== 'active' || record.active !== true) {
      throw new Error(`active V2 staging record ${record.setId} must have status=active and active=true`);
    }
    if (record.sourceType !== 'curated') {
      throw new Error(`active V2 staging record ${record.setId} must have sourceType=curated`);
    }
    if (!allowlist.has(record.setId)) {
      throw new Error(`active V2 staging record ${record.setId} is outside the allowlist`);
    }
  }
}

function pathResultFromRecords(input: ActiveV2ShadowScenarioInput, path: 'current' | 'active-v2-staging'): ActiveV2ShadowPathResult {
  const started = Date.now();
  const scenarioRecords = selectScenarioRecords(input.scenario, input.records);
  if (path === 'active-v2-staging') assertActiveV2StagingRecords(input.records);
  const activeRecords = path === 'active-v2-staging'
    ? input.records
    : selectAllowlistedRecords(input.records).map(record => ({
      ...record,
      status: 'active',
      active: true,
      sourceType: 'curated',
      format: 'champions-reg-mb-doubles',
    })) as ActiveStagingSetRecord[];
  if (activeRecords.length !== ACTIVE_STAGING_SET_ALLOWLIST.length) {
    throw new Error(`shadow path requires exactly ${ACTIVE_STAGING_SET_ALLOWLIST.length} allowlisted records`);
  }
  const engineInput = buildActiveStagingEngineInput(input.scenario, activeRecords);
  const engine = runActiveStagingFunctionalEngineProbe(engineInput);
  const pokemon = scenarioRecords.map(activeStagingRecordToPokemonData);
  const coverage = calculateTeamDataCoverage(pokemon);

  return {
    path,
    sourceMode: path === 'current' ? 'controlled-baseline' : 'mongo-staging-active',
    enginePath: path === 'current' ? 'current' : 'current-with-explicit-v2-context',
    sourceKind: path === 'current' ? 'controlled-snapshot' : 'mongo-active-staging',
    inputPokemon: [...input.scenario.leadPokemon],
    format: 'champions-reg-mb-doubles',
    teamIdentity: input.teamIdentity,
    allowLegendaries: input.allowLegendaries,
    seedState: 'not-applicable',
    setsConsumed: scenarioRecords.map(record => record.setId),
    movesUsed: scenarioRecords.flatMap(record => record.moves ?? []),
    itemsUsed: scenarioRecords.map(record => record.item ?? '').filter(Boolean),
    abilitiesUsed: scenarioRecords.map(record => record.ability ?? '').filter(Boolean),
    roles: scenarioRecords.flatMap(record => [record.primaryRole, ...(record.secondaryRoles ?? [])]).filter((role): role is string => Boolean(role)),
    leadStrategies: engine.generatedStrategyIds,
    selectedLeadStrategy: engine.selectedStrategyId,
    teamDataCoverage: coverage,
    fullTeamEvaluation: { score: engine.fullTeamEvaluationScore, executed: engine.fullTeamEvaluationExecuted },
    score: engine.fullTeamEvaluationScore,
    fallbackUsed: false,
    fallbackReason: null,
    exportResult: null,
    errors: [],
    durationMs: Date.now() - started,
    competitiveVerificationState: 'staging-controlled',
  };
}

export function runControlledBaselinePath(input: ActiveV2ShadowScenarioInput): ActiveV2ShadowPathResult {
  return pathResultFromRecords(input, 'current');
}

export function runActiveV2StagingPath(input: ActiveV2ShadowScenarioInput): ActiveV2ShadowPathResult {
  return pathResultFromRecords(input, 'active-v2-staging');
}
