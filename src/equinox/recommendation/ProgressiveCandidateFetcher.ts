import { PokemonData } from '../core/AnalysisContext';
import { CandidateSelector } from './CandidateSelector';
import { LeadBuildRequestContext } from '../lead-build/LeadBuildRequestContext';
import { Pokemon } from '../../models/Pokemon';

import { systemMonotonicClock } from '../lead-build/MonotonicClock';

export type CandidateFetchStopReason =
  | 'USABLE_QUOTA_REACHED'
  | 'SOURCE_EXHAUSTED'
  | 'DEADLINE_REACHED'
  | 'SCAN_CAP_REACHED'
  | 'QUERY_ERROR';

export interface CandidatePageCursor {
  /** Valor real do documento — `null` representa campo ausente ou nulo. */
  usageScore: number | null;
  /** Valor real do documento — `null` representa campo ausente ou nulo. */
  dexNumber: number | null;
  id: any;
}

/**
 * Predicado "estritamente após o cursor" para a ordem
 * `(usageScore DESC, dexNumber ASC, _id ASC)`.
 *
 * Documentos legados podem não ter `usageScore`/`dexNumber`. Normalizar esses
 * campos para um número sentinela (`?? 0`, `?? 9999`) quebra a paginação: em
 * MongoDB `{ usageScore: { $lt: 0 } }` **não** casa documentos onde o campo é
 * nulo ou ausente, porque a comparação respeita a ordem entre tipos. O cursor
 * emperraria na mesma página indefinidamente.
 *
 * A ordem real do MongoDB é a que este predicado reproduz:
 * - em DESC, `null`/ausente é o menor valor, logo vem **por último**;
 * - em ASC, `null`/ausente vem **primeiro**;
 * - `{ campo: null }` casa tanto o valor nulo quanto o campo ausente.
 */
export const CANDIDATE_PAGE_SORT = { usageScore: -1, dexNumber: 1, _id: 1 } as const;

export function buildCursorPredicate(cursor: CandidatePageCursor): Record<string, unknown>[] {
  const usageEquals = cursor.usageScore === null ? null : cursor.usageScore;
  const clauses: Record<string, unknown>[] = [];

  // Nível 1: usageScore estritamente posterior na ordem descendente.
  // Se o cursor já está no grupo nulo, não há nível 1 — é o fim da ordenação.
  if (cursor.usageScore !== null) {
    clauses.push({ usageScore: { $lt: cursor.usageScore } });
    clauses.push({ usageScore: null });
  }

  // Nível 2: mesmo usageScore, dexNumber posterior na ordem ascendente.
  clauses.push({
    usageScore: usageEquals,
    dexNumber: cursor.dexNumber === null ? { $ne: null } : { $gt: cursor.dexNumber },
  });

  // Nível 3: desempate final e total por _id.
  clauses.push({
    usageScore: usageEquals,
    dexNumber: cursor.dexNumber,
    _id: { $gt: cursor.id },
  });

  return clauses;
}

export interface ProgressiveCandidateFetcherParams {
  leadNames: string[];
  baseTeam: PokemonData[];
  format: string;
  allowLegendaries: boolean;
  targetUsableCount?: number;
  rawPageSize?: number;
  maxDocumentsExamined?: number;
  candidateFetchDeadlineAtMs?: number;
  requestContext?: LeadBuildRequestContext;
  nowMs?: () => number;
  initialCursor?: CandidatePageCursor | null;
  excludeNames?: string[];
  checkCapabilityCoverage?: (usable: PokemonData[]) => boolean;
}

export interface ProgressiveFetchResult {
  usableCandidates: PokemonData[];
  allExaminedCandidates: PokemonData[];
  endCursor: CandidatePageCursor | null;
  telemetry: {
    candidateQueryCount: number;
    candidatePageCount: number;
    candidateRawPageSize: number;
    candidateDocumentsExaminedTotal: number;
    candidateReturnedCountPerPage: number[];
    candidateUsableCountPerPage: number[];
    candidateRejectedLeadMember: number;
    candidateRejectedSpeciesClause: number;
    candidateRejectedFormat: number;
    candidateRejectedMissingCompetitiveSet: number;
    candidateRejectedIllegal: number;
    candidateRejectedMissingTypes: number;
    candidateRejectedOther: number;
    candidateUsableAccumulatedCount: number;
    candidateInitialSelectedCount: number;
    candidateFetchStopReason: CandidateFetchStopReason;
    candidateFetchDeadlineRemainingMs: number;
    candidateSourceExhausted: boolean;
    candidateScanCapReached: boolean;
    capabilityCoverageSatisfied: boolean;
  };
}

/**
 * Fronteira mínima da fonte de candidatos da busca PRIMÁRIA.
 *
 * `ProgressiveCandidateFetcher` já a satisfaz estruturalmente — nenhuma
 * mudança nela foi necessária. Existe para permitir, em teste, injetar uma
 * fonte determinística no lugar do Mongo real (autorização 088-B), sem
 * nenhum condicional de ambiente dentro da lógica de domínio: o wiring de
 * produção continua sendo `new ProgressiveCandidateFetcher()`, só que agora
 * passado explicitamente em vez de instanciado dentro do serviço.
 */
export interface PrimaryCandidateFetcher {
  fetchProgressiveCandidates(params: ProgressiveCandidateFetcherParams): Promise<ProgressiveFetchResult>;
}

export class ProgressiveCandidateFetcher implements PrimaryCandidateFetcher {
  private readonly candidateSelector = new CandidateSelector();

  public async fetchProgressiveCandidates(
    params: ProgressiveCandidateFetcherParams,
  ): Promise<ProgressiveFetchResult> {
    const {
      leadNames,
      baseTeam,
      format,
      allowLegendaries,
      targetUsableCount = 24,
      rawPageSize = 30,
      maxDocumentsExamined = 300,
      candidateFetchDeadlineAtMs = Number.MAX_SAFE_INTEGER,
      requestContext,
      nowMs = () => systemMonotonicClock.now(),
      initialCursor = null,
      excludeNames = [],
      checkCapabilityCoverage,
    } = params;

    // Conjunto usado só para deduplicação EM MEMÓRIA. Cresce a cada candidato
    // aceito e por isso nunca entra na consulta: transformá-lo em `$nin` faria
    // do tamanho da exclusão o mecanismo de paginação, que é justamente o que
    // o cursor composto substitui.
    const acceptedNamesNormalized = new Set([
      ...leadNames.map(n => n.toLowerCase().trim()),
      ...excludeNames.map(n => n.toLowerCase().trim()),
    ]);

    // Exclusão estática e pequena (leads + exclusões explícitas), no case
    // original do documento. O conjunto anterior era minúsculo mas comparava
    // nomes já em minúsculas contra `name` capitalizado no banco, então nunca
    // casava nada. Mesmo agora é só otimização de varredura: CandidateSelector
    // rejeita membros do lead de novo em memória, então um miss aqui não muda
    // o resultado.
    const staticExclusionNames = Array.from(new Set([...leadNames, ...excludeNames].map(n => n.trim())));

    const usableCandidates: PokemonData[] = [];
    const allExamined: PokemonData[] = [];
    const returnedPerPage: number[] = [];
    const usablePerPage: number[] = [];

    let pageCount = 0;
    let queryCount = 0;
    let examinedTotal = 0;
    let stopReason: CandidateFetchStopReason = 'SOURCE_EXHAUSTED';
    let sourceExhausted = false;
    let scanCapReached = false;
    let capabilityCoverageSatisfied = true;

    let currentCursor: CandidatePageCursor | null = initialCursor;

    while (
      (usableCandidates.length < targetUsableCount || !capabilityCoverageSatisfied) &&
      examinedTotal < maxDocumentsExamined
    ) {
      const currentNow = nowMs();
      if (currentNow >= candidateFetchDeadlineAtMs) {
        stopReason = 'DEADLINE_REACHED';
        break;
      }

      queryCount++;
      pageCount++;

      // Prefiltros estruturais. Só eliminam documentos que CandidateSelector
      // rejeitaria de qualquer forma por ausência de dado — nenhum critério
      // competitivo (tipo, BST, tier, formato) é avaliado aqui, para que a
      // decisão de qualidade continue inteira em memória.
      const filter: any = {
        // getVariant() só falha quando não há variante alguma E também não há
        // baseStats/types no topo do documento; nesse caso o candidato vira
        // `candidateRejectedMissingTypes`. Este $or é a negação exata dessa
        // condição, e não um palpite sobre quais campos "deveriam" existir.
        $and: [
          {
            $or: [
              { 'variants.0': { $exists: true } },
              { baseStats: { $exists: true, $ne: null } },
              { types: { $exists: true, $ne: [] } },
            ],
          },
        ],
      };

      if (staticExclusionNames.length > 0) {
        filter.name = { $nin: staticExclusionNames };
      }

      // Predicado lexicográfico do Cursor Composto: (usageScore DESC, dexNumber ASC, _id ASC)
      if (currentCursor) {
        filter.$and.push({ $or: buildCursorPredicate(currentCursor) });
      }

      let rawDocs: PokemonData[] = [];
      try {
        rawDocs = (await Pokemon.find(filter)
          .sort(CANDIDATE_PAGE_SORT as any)
          .limit(rawPageSize)
          .lean()) as unknown as PokemonData[];
      } catch (err) {
        stopReason = 'QUERY_ERROR';
        console.error('[ProgressiveCandidateFetcher] Erro de consulta Mongo:', err);
        break;
      }

      returnedPerPage.push(rawDocs.length);
      examinedTotal += rawDocs.length;
      allExamined.push(...rawDocs);

      if (rawDocs.length > 0) {
        const lastDoc = rawDocs[rawDocs.length - 1] as any;
        // Preserva o valor real, inclusive nulo/ausente: um sentinela numérico
        // aqui produziria um predicado que não casa o próprio documento de
        // origem e travaria o avanço da paginação.
        currentCursor = {
          usageScore: lastDoc.usageScore ?? null,
          dexNumber: lastDoc.dexNumber ?? null,
          id: lastDoc._id,
        };
      }

      // Aplicar filtros competitivos em memoria para a pagina atual
      const pageUsable = this.candidateSelector.select({
        allPokemon: rawDocs,
        currentMembers: leadNames,
        format,
        allowLegendaries,
        limit: targetUsableCount,
        baseTeam,
        requestContext,
      });

      // Acumular candidatos sem duplicados
      for (const cand of pageUsable) {
        const normalized = cand.name.toLowerCase().trim();
        if (!acceptedNamesNormalized.has(normalized)) {
          usableCandidates.push(cand);
          acceptedNamesNormalized.add(normalized);
        }
      }

      usablePerPage.push(pageUsable.length);

      const quotaReached = usableCandidates.length >= targetUsableCount;
      const coverageOk = !checkCapabilityCoverage || checkCapabilityCoverage(usableCandidates);
      capabilityCoverageSatisfied = coverageOk;

      if (quotaReached && coverageOk) {
        stopReason = 'USABLE_QUOTA_REACHED';
        break;
      }

      if (examinedTotal >= maxDocumentsExamined) {
        stopReason = 'SCAN_CAP_REACHED';
        scanCapReached = true;
        break;
      }

      if (rawDocs.length < rawPageSize) {
        stopReason = 'SOURCE_EXHAUSTED';
        sourceExhausted = true;
        break;
      }
    }

    const deadlineRemainingMs = Math.max(0, candidateFetchDeadlineAtMs - nowMs());
    const finalUsable = usableCandidates.slice(0, targetUsableCount);

    if (requestContext?.invocationCounters) {
      requestContext.invocationCounters.candidateQueryCount = queryCount;
      requestContext.invocationCounters.candidateBatchCount = pageCount;
      requestContext.invocationCounters.candidateQueryRawLimit = rawPageSize;
      requestContext.invocationCounters.candidateQueryReturnedCount = examinedTotal;
      requestContext.invocationCounters.candidateUsableBeforeSelection = usableCandidates.length;
      requestContext.invocationCounters.candidateInitialSelectedCount = finalUsable.length;
    }

    return {
      usableCandidates: finalUsable,
      allExaminedCandidates: allExamined,
      endCursor: currentCursor,
      telemetry: {
        candidateQueryCount: queryCount,
        candidatePageCount: pageCount,
        candidateRawPageSize: rawPageSize,
        candidateDocumentsExaminedTotal: examinedTotal,
        candidateReturnedCountPerPage: returnedPerPage,
        candidateUsableCountPerPage: usablePerPage,
        candidateRejectedLeadMember: requestContext?.invocationCounters?.candidateRejectedLeadMember ?? 0,
        candidateRejectedSpeciesClause: requestContext?.invocationCounters?.candidateRejectedSpeciesClause ?? 0,
        candidateRejectedFormat: requestContext?.invocationCounters?.candidateRejectedFormat ?? 0,
        candidateRejectedMissingCompetitiveSet: requestContext?.invocationCounters?.candidateRejectedMissingCompetitiveSet ?? 0,
        candidateRejectedIllegal: requestContext?.invocationCounters?.candidateRejectedIllegal ?? 0,
        candidateRejectedMissingTypes: requestContext?.invocationCounters?.candidateRejectedMissingTypes ?? 0,
        candidateRejectedOther: requestContext?.invocationCounters?.candidateRejectedOther ?? 0,
        candidateUsableAccumulatedCount: usableCandidates.length,
        candidateInitialSelectedCount: finalUsable.length,
        candidateFetchStopReason: stopReason,
        candidateFetchDeadlineRemainingMs: deadlineRemainingMs,
        candidateSourceExhausted: sourceExhausted,
        candidateScanCapReached: scanCapReached,
        capabilityCoverageSatisfied,
      },
    };
  }
}
