import { Pokemon } from '../../models/Pokemon';
import { PokemonSet } from '../../models/PokemonSet';
import { PokemonData } from '../core/AnalysisContext';
import { RecoveryCapabilityRequest } from './RecoveryCapabilityPlanner';

export interface CandidateFetchRuntimeControl {
  readonly deadlineAtMs?: number;
  readonly maximumCandidates?: number;
  shouldContinue?(): boolean;
  remainingMs?(): number;
}

export interface RecoveryCandidateSourceQuery {
  format: string;
  requestedCapabilities: readonly RecoveryCapabilityRequest[];
  excludedSpecies: readonly string[];
  excludedSetIds: readonly string[];
  maximumRawCandidates: number;
  runtimeControl?: CandidateFetchRuntimeControl;
}

export interface RecoveryCandidateSourceResult {
  candidates: PokemonData[];
  rawCount: number;
  sourceExhausted: boolean;
}

export interface RecoveryCandidateSource {
  fetch(query: RecoveryCandidateSourceQuery): Promise<RecoveryCandidateSourceResult>;
}

export class ProductionRecoveryCandidateSource implements RecoveryCandidateSource {
  public async fetch(query: RecoveryCandidateSourceQuery): Promise<RecoveryCandidateSourceResult> {
    if (query.runtimeControl?.shouldContinue && !query.runtimeControl.shouldContinue()) {
      return { candidates: [], rawCount: 0, sourceExhausted: false };
    }

    const remaining = query.runtimeControl?.remainingMs ? query.runtimeControl.remainingMs() : 3500;
    const maxTime = Math.max(50, Math.min(3500, remaining));

    const pokemonQuery = Pokemon.find({
      name: { $nin: query.excludedSpecies },
      variants: {
        $elemMatch: {
          formatId: query.format,
          'availability.legal': { $ne: false },
        },
      },
    })
      .maxTimeMS(maxTime)
      .limit(query.maximumRawCandidates)
      .lean();

    const pokemonDocuments = await pokemonQuery;

    if (query.runtimeControl?.shouldContinue && !query.runtimeControl.shouldContinue()) {
      return { candidates: [], rawCount: 0, sourceExhausted: false };
    }

    const names = pokemonDocuments.map(doc => doc.name);

    const setsQuery = PokemonSet.find({
      pokemonName: { $in: names },
      formatId: query.format,
      legal: true,
      active: true,
      status: 'active',
      setId: { $nin: query.excludedSetIds },
    })
      .maxTimeMS(maxTime)
      .sort({
        confidence: -1,
        coherenceScore: -1,
        pokemonName: 1,
        setId: 1,
      })
      .limit(query.maximumRawCandidates)
      .lean();

    const sets = await setsQuery;

    const setsByPokemon = new Map<string, typeof sets>();

    for (const set of sets) {
      const current = setsByPokemon.get(set.pokemonName) ?? [];
      current.push(set);
      setsByPokemon.set(set.pokemonName, current);
    }

    const candidates: PokemonData[] = [];

    for (const document of pokemonDocuments) {
      const matchingSets = setsByPokemon.get(document.name) ?? [];
      const variant = document.variants?.find((v: any) => v.formatId === query.format) ?? document.variants?.[0];

      for (const set of matchingSets) {
        candidates.push({
          ...document,
          name: document.name,
          types: variant?.types ?? (set as any).types ?? [],
          item: set.item,
          ability: set.ability,
          nature: set.nature,
          moves: set.moves,
          competitiveSet: {
            name: document.name,
            setId: set.setId,
            setSource: (set as any).setSource ?? (set as any).sourceId ?? 'mongodb-recovery',
            item: set.item,
            ability: set.ability,
            nature: set.nature,
            moves: set.moves as any,
            evs: set.evs as any,
            ivs: set.ivs as any,
            role: set.role,
            types: (variant?.types ?? (set as any).types ?? []) as any,
            validation: { valid: true, errors: [] } as any,
          },
        });
      }
    }

    return {
      candidates,
      rawCount: candidates.length,
      sourceExhausted: pokemonDocuments.length < query.maximumRawCandidates,
    };
  }
}
