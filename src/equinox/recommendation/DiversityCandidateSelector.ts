import { getCanonicalPokemonName } from '../utils/PokemonUtils';
import { CandidateScoreResult } from './CandidateScoreEngine';

interface DiversitySelectorOptions {
  maxCandidates: number;
  topOverall: number;
  perRole: number;
  perType: number;
  minCandidates: number;
}

/**
 * Requisito de cobertura garantida na diversificação, independente da
 * taxonomia grosseira de VgcRole usada em groupByRole. Quem decide o que
 * é um requisito (ex.: um VgcMechanicSlotId crítico do arquétipo atual)
 * é o FormatSolver -- este seletor permanece agnóstico de formato.
 */
export interface CoverageRequirement {
  id: string;
  perRequirement: number;
  matches: (candidate: CandidateScoreResult) => boolean;
}

export class DiversityCandidateSelector {
  public select(
    scoredCandidates: CandidateScoreResult[],
    options: DiversitySelectorOptions = {
      maxCandidates: 60,
      topOverall: 30,
      perRole: 8,
      perType: 3,
      minCandidates: 30,
    },
    coverageRequirements: CoverageRequirement[] = [],
  ): CandidateScoreResult[] {
    const selected = new Map<string, CandidateScoreResult>();

    const add = (candidate: CandidateScoreResult) => {
      if (selected.size >= options.maxCandidates) return;
      selected.set(getCanonicalPokemonName(candidate.pokemon.name), candidate);
    };

    scoredCandidates.slice(0, options.topOverall).forEach(add);

    const roleBuckets = this.groupByRole(scoredCandidates);
    for (const bucket of roleBuckets.values()) {
      bucket.slice(0, options.perRole).forEach(add);
    }

    const typeBuckets = this.groupByType(scoredCandidates);
    for (const bucket of typeBuckets.values()) {
      bucket.slice(0, options.perType).forEach(add);
    }

    /**
     * Rede de segurança de cobertura mecânica:
     * groupByRole usa VgcRole, uma taxonomia grosseira demais para
     * representar conceitos como tipo de clima (sol/chuva/areia/neve),
     * Terrain, proteção de Trick Room ou Tailwind como distinto de
     * "Speed Control" genérico. Um candidato que carrega o único slot
     * crítico disponível para o arquétipo do time base pode não ter
     * score bruto para entrar no topOverall e não ter bucket de role
     * equivalente -- ficando fora do pool antes da busca combinatória
     * e derrubando toda combinação final por falta desse slot. Esse
     * passo roda antes do fallback de ranking geral para que slots
     * críticos tenham prioridade sobre preenchimento cego por score.
     */
    for (const requirement of coverageRequirements) {
      scoredCandidates.filter(requirement.matches).slice(0, requirement.perRequirement).forEach(add);
    }

    /**
     * Fallback obrigatório:
     * se a diversidade não trouxe candidatos suficientes,
     * completa diretamente pelo ranking geral.
     */
    for (const candidate of scoredCandidates) {
      if (selected.size >= Math.min(options.maxCandidates, scoredCandidates.length)) {
        break;
      }

      if (selected.size >= options.minCandidates && selected.size >= 3) {
        break;
      }

      add(candidate);
    }

    /**
     * Fallback extremo:
     * se ainda houver menos de 3 por qualquer razão, retorna os primeiros 3.
     */
    if (selected.size < 3) {
      scoredCandidates.slice(0, 3).forEach(candidate => {
        selected.set(getCanonicalPokemonName(candidate.pokemon.name), candidate);
      });
    }

    return [...selected.values()].sort((a, b) => b.score - a.score);
  }

  private groupByRole(
    candidates: CandidateScoreResult[],
  ): Map<string, CandidateScoreResult[]> {
    const buckets = new Map<string, CandidateScoreResult[]>();

    for (const candidate of candidates) {
      for (const role of candidate.roles) {
        if (!buckets.has(role)) {
          buckets.set(role, []);
        }

        buckets.get(role)!.push(candidate);
      }
    }

    return buckets;
  }

  private groupByType(
    candidates: CandidateScoreResult[],
  ): Map<string, CandidateScoreResult[]> {
    const buckets = new Map<string, CandidateScoreResult[]>();

    for (const candidate of candidates) {
      for (const type of candidate.types) {
        if (!buckets.has(type)) {
          buckets.set(type, []);
        }

        buckets.get(type)!.push(candidate);
      }
    }

    return buckets;
  }
}