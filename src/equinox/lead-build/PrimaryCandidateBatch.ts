import { PokemonData } from '../core/AnalysisContext';

export interface PrimaryCandidateBatch {
  readonly candidates: readonly PokemonData[];
  readonly rawFetched: number;
  readonly usableCount: number;
  readonly sourceExhausted: boolean;
  readonly fetchedAtMs: number;
  readonly batchKey: string;
}
