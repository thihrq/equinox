import { Pokemon } from '../../models/Pokemon';
import { PokemonSet } from '../../models/PokemonSet';
import { PokemonData } from '../core/AnalysisContext';
import { RecoveryCapabilityRequest } from './RecoveryCapabilityPlanner';

export interface RecoveryCandidateSourceQuery {
  format: string;
  requestedCapabilities: readonly RecoveryCapabilityRequest[];
  excludedSpecies: readonly string[];
  excludedSetIds: readonly string[];
  maximumRawCandidates: number;
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
    const requestedTypes = [
      ...new Set(
        query.requestedCapabilities
          .map(request => request.attackType)
          .filter((type): type is any => Boolean(type)),
      ),
    ];

    const pokemonDocuments = await Pokemon.find({
      name: { $nin: query.excludedSpecies },
      variants: {
        $elemMatch: {
          formatId: query.format,
          'availability.legal': { $ne: false },
        },
      },
    })
      .limit(query.maximumRawCandidates)
      .lean();

    const names = pokemonDocuments.map(doc => doc.name);

    const sets = await PokemonSet.find({
      pokemonName: { $in: names },
      formatId: query.format,
      legal: true,
      active: true,
      status: 'active',
      setId: { $nin: query.excludedSetIds },
    })
      .sort({
        confidence: -1,
        coherenceScore: -1,
        pokemonName: 1,
        setId: 1,
      })
      .limit(query.maximumRawCandidates)
      .lean();

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
            moves: set.moves,
            evs: set.evs as any,
            ivs: set.ivs as any,
            role: set.role,
            types: variant?.types ?? (set as any).types ?? [],
            validation: { valid: true, errors: [] },
          },
        } as unknown as PokemonData);
      }
    }

    return {
      candidates: candidates.slice(0, query.maximumRawCandidates),
      rawCount: pokemonDocuments.length,
      sourceExhausted: pokemonDocuments.length < query.maximumRawCandidates,
    };
  }
}
