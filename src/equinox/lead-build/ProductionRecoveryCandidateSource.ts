import { Pokemon } from '../../models/Pokemon';
import { PokemonSet } from '../../models/PokemonSet';
import { PokemonData } from '../core/AnalysisContext';
import { AnyRecoveryCapabilityRequest } from './RecoveryCapabilityPlanner';
import {
  buildCursorPredicate,
  CANDIDATE_PAGE_SORT,
  CandidatePageCursor,
} from '../recommendation/ProgressiveCandidateFetcher';

export interface CandidateFetchRuntimeControl {
  readonly deadlineAtMs?: number;
  readonly maximumCandidates?: number;
  shouldContinue?(): boolean;
  remainingMs?(): number;
}

export interface RecoveryCandidateSourceQuery {
  format: string;
  requestedCapabilities: readonly AnyRecoveryCapabilityRequest[];
  excludedSpecies: readonly string[];
  excludedSetIds: readonly string[];
  maximumRawCandidates: number;
  runtimeControl?: CandidateFetchRuntimeControl;
  /**
   * Ponto de continuação da varredura. Sem ele, cada passe do recovery relê os
   * mesmos documentos do começo e só o `$nin` de espécies já aceitas evita
   * repeti-los — um filtro que cresce a cada passe e vira, na prática, o
   * mecanismo de paginação. O cursor substitui esse papel.
   */
  startCursor?: CandidatePageCursor | null;
}

export interface RecoveryCandidateSourceResult {
  candidates: PokemonData[];
  rawCount: number;
  sourceExhausted: boolean;
  /** Onde o próximo passe deve continuar; `null` quando nada foi lido. */
  endCursor: CandidatePageCursor | null;
}

export interface RecoveryCandidateSource {
  fetch(query: RecoveryCandidateSourceQuery): Promise<RecoveryCandidateSourceResult>;
}

export class ProductionRecoveryCandidateSource implements RecoveryCandidateSource {
  public async fetch(query: RecoveryCandidateSourceQuery): Promise<RecoveryCandidateSourceResult> {
    const startCursor = query.startCursor ?? null;

    if (query.runtimeControl?.shouldContinue && !query.runtimeControl.shouldContinue()) {
      return { candidates: [], rawCount: 0, sourceExhausted: false, endCursor: startCursor };
    }

    const remaining = query.runtimeControl?.remainingMs ? query.runtimeControl.remainingMs() : 3500;
    const maxTime = Math.max(50, Math.min(3500, remaining));

    const pokemonFilter: Record<string, unknown> = {
      name: { $nin: query.excludedSpecies },
      variants: {
        $elemMatch: {
          formatId: query.format,
          'availability.legal': { $ne: false },
        },
      },
    };

    if (startCursor) {
      pokemonFilter.$or = buildCursorPredicate(startCursor);
    }

    // A ordenação explícita não é cosmética: `.limit()` sem `.sort()` deixa a
    // ordem a cargo do plano de execução, e sem ordem estável nenhum cursor de
    // continuação tem significado entre chamadas. É a mesma ordem total do
    // fetch primário, para que os dois percorram a coleção de forma coerente.
    const pokemonQuery = Pokemon.find(pokemonFilter)
      .maxTimeMS(maxTime)
      .sort(CANDIDATE_PAGE_SORT as any)
      .limit(query.maximumRawCandidates)
      .lean();

    const pokemonDocuments = await pokemonQuery;

    const lastDocument = pokemonDocuments[pokemonDocuments.length - 1] as any;
    const endCursor: CandidatePageCursor | null = lastDocument
      ? {
          usageScore: lastDocument.usageScore ?? null,
          dexNumber: lastDocument.dexNumber ?? null,
          id: lastDocument._id,
        }
      : startCursor;

    if (query.runtimeControl?.shouldContinue && !query.runtimeControl.shouldContinue()) {
      return { candidates: [], rawCount: 0, sourceExhausted: false, endCursor };
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
      endCursor,
    };
  }
}
