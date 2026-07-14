import type { PokemonData } from '../../core/AnalysisContext';
import { type CompetitivePokemonSet, validateCompetitivePokemonSet } from '../CompetitivePokemonSet';
import { calculateTeamDataCoverage } from '../TeamDataCoverage';
import { analyzeLeadCapabilities } from '../../vgc/LeadCapabilityAnalyzer';
import { generateLeadStrategies } from '../../vgc/LeadStrategyGenerator';
import { evaluateFullTeam } from '../../vgc/FullTeamEvaluator';
import type { ActiveStagingSetRecord } from './ActiveStagingHomologationTypes';
import type { ActiveStagingEngineInput } from './ActiveStagingEngineAdapter';

export interface ActiveStagingFunctionalEngineResult {
  engineExecuted: true;
  leadCapabilityMechanicallyValid: boolean;
  generatedStrategyIds: string[];
  selectedStrategyId: string;
  teamDataVerifiedSets: number;
  teamDataGeneratedFallbacks: number;
  teamDataUnknownSets: number;
  fullTeamEvaluationScore: number;
  fullTeamEvaluationExecuted: boolean;
  consumedSetIds: string[];
}

const toStatSpread = (spread: ActiveStagingSetRecord['evs']) => ({
  hp: Number(spread?.hp ?? 0),
  atk: Number(spread?.atk ?? 0),
  def: Number(spread?.def ?? 0),
  spa: Number(spread?.spa ?? 0),
  spd: Number(spread?.spd ?? 0),
  spe: Number(spread?.spe ?? 0),
});

export function activeStagingRecordToPokemonData(record: ActiveStagingSetRecord): PokemonData {
  const name = record.pokemonName ?? record.pokemon;
  const moves = [...(record.moves ?? [])].filter(Boolean);
  const competitiveMoves = moves.slice(0, 4) as [string, string, string, string];
  const item = record.item ?? '';
  const ability = record.ability ?? '';
  const nature = record.nature ?? '';
  const competitiveSet: CompetitivePokemonSet = {
    name,
    types: [],
    item,
    ability,
    nature,
    evs: toStatSpread(record.evs),
    ivs: toStatSpread(record.ivs),
    moves: competitiveMoves,
    role: record.primaryRole,
    setId: record.setId,
    confidence: record.confidence,
    status: record.status,
    sourceType: record.sourceType,
    setSource: 'v2-verified' as const,
    validation: { legal: true, errors: [], warnings: [] },
  };

  competitiveSet.validation = validateCompetitivePokemonSet(competitiveSet);

  return {
    name,
    item,
    ability,
    nature,
    moves: competitiveMoves,
    role: record.primaryRole,
    competitive: {
      roles: [record.primaryRole, ...(record.secondaryRoles ?? [])].filter((role): role is string => Boolean(role)),
      utilityTags: record.synergyTags ?? [],
      teamStyles: record.archetypes ?? [],
    },
    competitiveSet,
  };
}

export function runActiveStagingFunctionalEngineProbe(
  input: ActiveStagingEngineInput,
): ActiveStagingFunctionalEngineResult {
  const lead = input.presentedRecords.map(activeStagingRecordToPokemonData) as [PokemonData, PokemonData];
  const leadProfile = analyzeLeadCapabilities(lead[0], lead[1], input.format);
  const strategies = generateLeadStrategies(lead, leadProfile, input.format);
  if (strategies.length === 0) {
    throw new Error(`scenario ${input.scenarioId} produced no VGC lead strategies`);
  }

  const selectedStrategy = strategies[0];
  const teamDataCoverage = calculateTeamDataCoverage(lead);
  const evaluation = evaluateFullTeam(lead, selectedStrategy, input.format);

  return {
    engineExecuted: true,
    leadCapabilityMechanicallyValid: leadProfile.mechanicallyValid,
    generatedStrategyIds: strategies.map((strategy) => strategy.id),
    selectedStrategyId: selectedStrategy.id,
    teamDataVerifiedSets: teamDataCoverage.verifiedSets,
    teamDataGeneratedFallbacks: teamDataCoverage.generatedFallbacks,
    teamDataUnknownSets: teamDataCoverage.unknownSets,
    fullTeamEvaluationScore: evaluation.overallScore,
    fullTeamEvaluationExecuted: Number.isFinite(evaluation.overallScore),
    consumedSetIds: input.presentedRecords.map((record) => record.setId),
  };
}
