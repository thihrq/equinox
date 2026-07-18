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

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Largura do feixe — quantos times parciais sobrevivem entre estágios */
const BEAM_WIDTH = 40;

/** Quantidade de resultados finais retornados */
const FINAL_RESULTS = 10;

// ─── Instância do Registro de Solvers ────────────────────────────────────────

const solverRegistry = new FormatSolverRegistry();

// ─── Funções Auxiliares ──────────────────────────────────────────────────────

/**
 * Verifica se adicionar um candidato viola a Species Clause.
 * Dois Pokémon da mesma espécie base não podem estar no mesmo time.
 */
function violatesSpeciesClause(team: PokemonData[], candidate: PokemonData): boolean {
  const candidateKey = getSpeciesClauseKey(candidate.name);
  return team.some(p => getSpeciesClauseKey(p.name) === candidateKey);
}

/**
 * Verifica se adicionar um candidato excede o limite de 1 Mega Evolution por time.
 */
function violatesMegaLimit(team: PokemonData[], candidate: PokemonData): boolean {
  if (!isMegaOption(candidate)) return false;
  return team.some(p => isMegaOption(p));
}

/**
 * Valida um time parcial usando o FormatObjectiveGuards para bloquear combinações ilegais cedo.
 * Retorna true se o time parcial é válido (sem hard failures).
 */
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

/**
 * Calcula a cobertura de estratégia para um time completo.
 * Verifica quais roles requeridas, preferidas e opcionais estão preenchidas.
 */
function calculateStrategyCoverage(
  team: PokemonData[],
  strategy: LeadStrategyCandidate,
  format: string,
): StrategyCoverage {
  const fulfilledRequired: string[] = [];
  const fulfilledPreferred: string[] = [];
  const fulfilledOptional: string[] = [];
  const unresolved: string[] = [];

  // Verificar roles requeridas
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

  // Verificar roles opcionais
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
      if (role.priority === 'preferred') {
        fulfilledPreferred.push(role.role);
      } else {
        fulfilledOptional.push(role.role);
      }
    } else if (role.priority === 'preferred') {
      unresolved.push(role.role);
    }
  }

  // Calcular score de cobertura (0–100)
  const totalRoles = strategy.requiredRoles.length + strategy.optionalRoles.length;
  const totalFulfilled = fulfilledRequired.length + fulfilledPreferred.length + fulfilledOptional.length;

  // Peso maior para roles requeridas
  const requiredWeight = strategy.requiredRoles.length > 0
    ? (fulfilledRequired.length / strategy.requiredRoles.length) * 70
    : 70;
  const optionalWeight = strategy.optionalRoles.length > 0
    ? (fulfilledPreferred.length + fulfilledOptional.length) / strategy.optionalRoles.length * 30
    : 30;

  const coverageScore = Math.min(100, Math.round(
    totalRoles > 0 ? requiredWeight + optionalWeight : 50,
  ));

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

/**
 * Executa um estágio da busca em feixe.
 * Para cada time parcial no beam, avalia todos os candidatos e retorna os top N novos times.
 *
 * @param beam - Array de times parciais atuais
 * @param candidates - Pool de candidatos disponíveis
 * @param strategy - Estratégia de lead ativa
 * @param format - Formato do jogo
 * @param beamWidth - Largura do feixe (quantos sobrevivem)
 * @returns Novo beam com times expandidos
 */
function expandBeam(
  beam: BeamEntry[],
  candidates: PokemonData[],
  strategy: LeadStrategyCandidate,
  format: string,
  beamWidth: number,
): BeamEntry[] {
  const expanded: BeamEntry[] = [];
  // Instrumentação temporária (achado real 2026-07-18): auditoria geral
  // encontrou suggestFromLead retornando 0 estratégias completas para
  // leads sem sinal de clima (ex.: Incineroar+Amoonguss) -- searchLeadCompletions
  // some com o beam em algum dos 4 estágios sem indicar qual checagem é
  // responsável. Loga contagem de rejeição por motivo pra diagnosticar
  // com dado real em vez de suposição.
  let rejectedSpecies = 0;
  let rejectedMega = 0;
  let rejectedItem = 0;
  let rejectedValidity = 0;

  for (const entry of beam) {
    for (const candidate of candidates) {
      // Verificar Species Clause
      if (violatesSpeciesClause(entry.team, candidate)) { rejectedSpecies++; continue; }

      // Verificar limite de Mega Evolution
      if (violatesMegaLimit(entry.team, candidate)) { rejectedMega++; continue; }

      if (hasDuplicateItem(entry.team, candidate)) { rejectedItem++; continue; }

      // Calcular score do candidato no contexto do time parcial
      const candidateScore = scoreCandidateForStrategy(
        candidate,
        strategy,
        entry.team,
        format,
      );

      const newTeam = [...entry.team, candidate];

      // Validar time parcial com FormatObjectiveGuards
      if (!isPartialTeamValid(newTeam, format)) { rejectedValidity++; continue; }

      expanded.push({
        team: newTeam,
        cumulativeScore: entry.cumulativeScore + candidateScore,
      });
    }
  }

  console.log(
    `[LeadBuild] expandBeam(${strategy.id}): beamIn=${beam.length} candidates=${candidates.length} -> expanded=${expanded.length} ` +
    `(rejectedSpecies=${rejectedSpecies}, rejectedMega=${rejectedMega}, rejectedItem=${rejectedItem}, rejectedValidity=${rejectedValidity})`,
  );

  // Ordenar por score cumulativo e manter apenas os top N
  expanded.sort((a, b) => b.cumulativeScore - a.cumulativeScore);
  return expanded.slice(0, beamWidth);
}

// ─── Busca Principal ─────────────────────────────────────────────────────────

/**
 * Executa a busca em feixe progressiva para encontrar os melhores times
 * que complementam uma lead fixa seguindo uma estratégia específica.
 *
 * Estágios:
 * 1. 2 lead fixos → avaliar cada candidato → top 40 trios
 * 2. Cada trio → avaliar cada candidato restante → top 40 quartetos
 * 3. Cada quarteto → avaliar cada candidato restante → top 40 quintetos
 * 4. Cada quinteto → avaliar cada candidato restante → top 10 times de 6
 *
 * @param input - Dados de entrada contendo lead, estratégia, candidatos e configuração
 * @returns Array de resultados ordenados por score
 */
export function searchLeadCompletions(
  input: LeadCompletionSearchInput,
): LeadCompletionResult[] {
  const { lead, strategy, candidates, maxCandidatesPerStage, format } = input;

  // Determinar o formato a partir do nome do solver

  // Inicializar beam com a dupla de lead
  const initialTeam: PokemonData[] = [lead[0], lead[1]];
  let beam: BeamEntry[] = [{
    team: initialTeam,
    cumulativeScore: 0,
  }];

  // Limitar candidatos se necessário
  const candidatePool = maxCandidatesPerStage > 0
    ? candidates.slice(0, maxCandidatesPerStage)
    : candidates;

  // Estágio 1: 2 → 3 (trios)
  beam = expandBeam(beam, candidatePool, strategy, format, BEAM_WIDTH);
  if (beam.length === 0) return [];

  // Estágio 2: 3 → 4 (quartetos)
  beam = expandBeam(beam, candidatePool, strategy, format, BEAM_WIDTH);
  if (beam.length === 0) return [];

  // Estágio 3: 4 → 5 (quintetos)
  beam = expandBeam(beam, candidatePool, strategy, format, BEAM_WIDTH);
  if (beam.length === 0) return [];

  // Estágio 4: 5 → 6 (times completos)
  beam = expandBeam(beam, candidatePool, strategy, format, FINAL_RESULTS);
  if (beam.length === 0) return [];

  // Montar resultados finais com cobertura de estratégia
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

  // Ordenar por score final
  results.sort((a, b) => b.fullTeamScore - a.fullTeamScore);

  return results;
}
