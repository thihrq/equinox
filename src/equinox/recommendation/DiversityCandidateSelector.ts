import { getCanonicalPokemonName } from '../utils/PokemonUtils';
import { CandidateScoreResult } from './CandidateScoreEngine';

interface DiversitySelectorOptions {
  maxCandidates: number;
  topOverall: number;
  perRole: number;
  perType: number;
  minCandidates: number;
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