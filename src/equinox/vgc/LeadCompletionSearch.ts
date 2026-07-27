// src/equinox/vgc/LeadCompletionSearch.ts
// Busca em feixe (beam search) progressiva para complementar times a partir de uma lead fixa.
// Constrói times de 6 partindo de 2 Pokémon lead, avaliando cada candidato em estágios.

import type {
  LeadCompletionSearchInput,
  LeadCompletionResult,
  StrategyCoverage,
  LeadStrategyCandidate,
} from './LeadBuildTypes';
import { PokemonData } from '../core/AnalysisContext';
import { scoreCandidateForStrategy } from '../scoring/LeadStrategyCandidateScore';
import { getSpeciesClauseKey } from '../utils/PokemonUtils';
import { isMegaOption } from '../utils/VgcSetOptimizer';
import { evaluateFormatTeamObjective } from '../format-solvers/FormatObjectiveGuards';
import { FormatSolverRegistry } from '../format-solvers/FormatSolverRegistry';
import { hasDuplicateItem } from '../competitive/CompetitiveTeamLegalityValidator';

import { createCandidateSearchContext } from '../lead-build/CandidateSearchContext';
import { replenishCandidatePool } from '../lead-build/replenishCandidatePool';
import { evaluatePartialTeamDefensiveQuality } from '../lead-build/PartialTeamDefensiveEvaluator';
import { LeadCompletionSearchControl } from '../lead-build/PrimarySearchGuard';

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Largura do feixe — quantos times parciais sobrevivem entre estágios */
const BEAM_WIDTH = 40;

/** Quantidade de resultados finais retornados */
const FINAL_RESULTS = 10;

// ─── Instância do Registro de Solvers ────────────────────────────────────────

const solverRegistry = new FormatSolverRegistry();

// ─── Funções Auxiliares ──────────────────────────────────────────────────────

function violatesSpeciesClause(team: PokemonData[], candidate: PokemonData): boolean {
  const candidateKey = getSpeciesClauseKey(candidate.name);
  return team.some(p => getSpeciesClauseKey(p.name) === candidateKey);
}

function violatesMegaLimit(team: PokemonData[], candidate: PokemonData): boolean {
  if (!isMegaOption(candidate)) return false;
  return team.some(p => isMegaOption(p));
}

function isPartialTeamValid(
  partialTeam: PokemonData[],
  format: string,
): boolean {
  const solver = solverRegistry.getSolver(format);
  const result = evaluateFormatTeamObjective({
    mode: solver.mode,
    baseTeam: partialTeam,
    team: partialTeam,
    format,
  });
  return result.hardFailures.length === 0;
}

function calculateStrategyCoverage(
  team: PokemonData[],
  strategy: LeadStrategyCandidate,
  format: string,
): StrategyCoverage {
  const fulfilledRequired: string[] = [];
  const fulfilledPreferred: string[] = [];
  const fulfilledOptional: string[] = [];
  const unresolved: string[] = [];

  for (const role of strategy.requiredRoles) {
    const isFulfilled = team.some(p => {
      const roleScore = scoreCandidateForStrategy(p, {
        ...strategy,
        requiredRoles: [role],
        optionalRoles: [],
      }, [], format);
      return roleScore > 0;
    });

    if (isFulfilled) {
      if (role.priority === 'required') {
        fulfilledRequired.push(role.role);
      } else {
        fulfilledPreferred.push(role.role);
      }
    } else {
      unresolved.push(role.role);
    }
  }

  for (const role of strategy.optionalRoles) {
    const isFulfilled = team.some(p => {
      const roleScore = scoreCandidateForStrategy(p, {
        ...strategy,
        requiredRoles: [],
        optionalRoles: [role],
      }, [], format);
      return roleScore > 0;
    });

    if (isFulfilled) {
      fulfilledOptional.push(role.role);
    }
  }

  const totalRoles = strategy.requiredRoles.length + strategy.optionalRoles.length;
  const fulfilledTotal = fulfilledRequired.length + fulfilledPreferred.length + fulfilledOptional.length;
  const coverageScore = totalRoles > 0 ? Math.round((fulfilledTotal / totalRoles) * 100) : 50;

  return {
    fulfilledRequired,
    fulfilledPreferred,
    fulfilledOptional,
    unresolved,
    coverageScore,
  };
}

// ─── Estágio de Beam Search ──────────────────────────────────────────────────

interface BeamEntry {
  team: PokemonData[];
  cumulativeScore: number;
}

function expandBeam(
  beam: BeamEntry[],
  candidates: PokemonData[],
  strategy: LeadStrategyCandidate,
  format: string,
  beamWidth: number,
  stage: number,
  control?: LeadCompletionSearchControl,
): BeamEntry[] {
  const expanded: BeamEntry[] = [];
  let rejectedSpecies = 0;
  let rejectedMega = 0;
  let rejectedItem = 0;
  let rejectedValidity = 0;
  let rejectedDefensive = 0;

  for (const entry of beam) {
    if (control && !control.shouldContinue()) {
      control.onInterrupted?.({ stage, beamSize: beam.length, evaluatedCombinations: expanded.length });
      break;
    }

    for (const candidate of candidates) {
      if (control && !control.shouldContinue()) {
        control.onInterrupted?.({ stage, beamSize: beam.length, evaluatedCombinations: expanded.length });
        break;
      }

      if (violatesSpeciesClause(entry.team, candidate)) { rejectedSpecies++; continue; }
      if (violatesMegaLimit(entry.team, candidate)) { rejectedMega++; continue; }
      if (hasDuplicateItem(entry.team, candidate)) { rejectedItem++; continue; }

      const candidateScore = scoreCandidateForStrategy(
        candidate,
        strategy,
        entry.team,
        format,
      );

      const newTeam = [...entry.team, candidate];

      if (!isPartialTeamValid(newTeam, format)) { rejectedValidity++; continue; }

      const remainingSlots = 6 - newTeam.length;
      const partialDefensive = evaluatePartialTeamDefensiveQuality(newTeam, remainingSlots, candidates);

      if (partialDefensive.pruned) {
        rejectedDefensive++;
        continue;
      }

      expanded.push({
        team: newTeam,
        cumulativeScore: entry.cumulativeScore + candidateScore - partialDefensive.totalPenalty,
      });
    }
  }

  console.log(
    `[LeadBuild] expandBeam(${strategy.id}): beamIn=${beam.length} candidates=${candidates.length} -> expanded=${expanded.length} ` +
    `(rejectedSpecies=${rejectedSpecies}, rejectedMega=${rejectedMega}, rejectedItem=${rejectedItem}, rejectedValidity=${rejectedValidity}, rejectedDefensive=${rejectedDefensive})`,
  );

  expanded.sort((a, b) => b.cumulativeScore - a.cumulativeScore);
  return expanded.slice(0, beamWidth);
}

// ─── Busca Principal ─────────────────────────────────────────────────────────

export function searchLeadCompletions(
  input: LeadCompletionSearchInput,
  control?: LeadCompletionSearchControl,
): LeadCompletionResult[] {
  const { lead, strategy, candidates, maxCandidatesPerStage, format } = input;

  const searchContext = createCandidateSearchContext(lead, format, strategy.id);

  const replenished = replenishCandidatePool(candidates, searchContext, {
    targetUsableCandidates: maxCandidatesPerStage > 0 ? maxCandidatesPerStage : 40,
    maximumRawCandidates: 150,
    batchSize: 30,
  });

  const candidatePool = replenished.usableCandidates as PokemonData[];

  const initialTeam: PokemonData[] = [lead[0], lead[1]];
  let beam: BeamEntry[] = [{
    team: initialTeam,
    cumulativeScore: 0,
  }];

  const effectiveBeamWidth = control?.maximumFinalists ? Math.min(BEAM_WIDTH, 24) : BEAM_WIDTH;

  // Estágio 1: 2 → 3 (trios)
  beam = expandBeam(beam, candidatePool, strategy, format, effectiveBeamWidth, 1, control);
  if (beam.length === 0) return [];

  // Estágio 2: 3 → 4 (quartetos)
  beam = expandBeam(beam, candidatePool, strategy, format, effectiveBeamWidth, 2, control);
  if (beam.length === 0) return [];

  // Estágio 3: 4 → 5 (quintetos)
  beam = expandBeam(beam, candidatePool, strategy, format, effectiveBeamWidth, 3, control);
  if (beam.length === 0) return [];

  // Estágio 4: 5 → 6 (times completos)
  const finalLimit = control?.maximumFinalists ? Math.min(FINAL_RESULTS, control.maximumFinalists) : FINAL_RESULTS;
  beam = expandBeam(beam, candidatePool, strategy, format, finalLimit, 4, control);
  if (beam.length === 0) return [];

  const results: LeadCompletionResult[] = beam.map(entry => {
    const strategyCoverage = calculateStrategyCoverage(
      entry.team,
      strategy,
      format,
    );

    return {
      fullTeam: entry.team,
      strategy,
      strategyCoverage,
      fullTeamScore: entry.cumulativeScore,
      unresolvedRequirements: strategyCoverage.unresolved,
    };
  });

  results.sort((a, b) => b.fullTeamScore - a.fullTeamScore);

  return results;
}
