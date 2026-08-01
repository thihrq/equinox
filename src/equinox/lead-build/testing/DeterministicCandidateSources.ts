import { PokemonData } from '../../core/AnalysisContext';
import { PrimaryCandidateFetcher, ProgressiveFetchResult } from '../../recommendation/ProgressiveCandidateFetcher';
import { RecoveryCandidateSource, RecoveryCandidateSourceResult } from '../ProductionRecoveryCandidateSource';
import { ALL_POKEMON_TYPES, PokemonType } from '../TeamDefensiveProfile';

const FORMAT = 'champions_reg_m_b_doubles';

/**
 * Falha rápido em vez de degradar silenciosamente.
 *
 * `calculateTeamDefensiveProfile` indexa a tabela de efetividade por essas
 * chaves exatas, capitalizadas (`'Fire'`, não `'fire'`). Um tipo fora do
 * domínio canônico não gera erro nenhum — ele só nunca casa com nada na
 * tabela, e o gate defensivo fica cego a qualquer fraqueza real sem nenhum
 * sinal de que algo está errado. Foi exatamente essa degradação silenciosa
 * que produziu a falsa refutação da hipótese de Gelo na investigação 088-C
 * (confirmado na 088-E: o mesmo corpus, com tipos corrigidos, reproduz
 * `NO_DEFENSIVE_SWITCH_IN` normalmente).
 */
export function assertCanonicalPokemonType(type: string): asserts type is PokemonType {
  if (!(ALL_POKEMON_TYPES as readonly string[]).includes(type)) {
    throw new Error(
      `INVALID_POKEMON_TYPE_CASING: "${type}" não é um PokemonType canônico. ` +
        `Esperado um de: ${ALL_POKEMON_TYPES.join(', ')}.`,
    );
  }
}

/**
 * Fronteira determinística para os E2E de recovery (autorização 088-B).
 *
 * Substitui o Mongo real por conjuntos de candidatos fixos e disjuntos por
 * fase — a única forma de provar, sem depender da ordem natural do Mongo ou
 * de "por acaso" o pool compartilhado não ter solução, que o primary é
 * genuinamente insuficiente e que o recovery é o único caminho até um time
 * aceito. Nenhum condicional de ambiente entra na lógica de domínio: o
 * serviço de produção continua instanciando `ProgressiveCandidateFetcher` e
 * `ProductionRecoveryCandidateSource` normalmente; os testes só substituem os
 * campos já pensados para isso (`primaryCandidateFetcher`, `adaptiveRecovery`)
 * depois de construir o serviço.
 */
export function buildTestPokemon(
  name: string,
  dexNumber: number,
  types: string[],
  baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number } = { hp: 90, atk: 90, def: 80, spa: 90, spd: 80, spe: 90 },
): PokemonData {
  types.forEach(assertCanonicalPokemonType);

  return {
    name,
    dexNumber,
    types,
    isLegendary: false,
    variants: [
      {
        formatId: FORMAT,
        baseStats,
        types,
        abilities: { 0: 'Pressure' },
      } as any,
    ],
  };
}

function emptyTelemetry(overrides: Partial<ProgressiveFetchResult['telemetry']>): ProgressiveFetchResult['telemetry'] {
  return {
    candidateQueryCount: 1,
    candidatePageCount: 1,
    candidateRawPageSize: 30,
    candidateDocumentsExaminedTotal: 0,
    candidateReturnedCountPerPage: [],
    candidateUsableCountPerPage: [],
    candidateRejectedLeadMember: 0,
    candidateRejectedSpeciesClause: 0,
    candidateRejectedFormat: 0,
    candidateRejectedMissingCompetitiveSet: 0,
    candidateRejectedIllegal: 0,
    candidateRejectedMissingTypes: 0,
    candidateRejectedOther: 0,
    candidateUsableAccumulatedCount: 0,
    candidateInitialSelectedCount: 0,
    candidateFetchStopReason: 'SOURCE_EXHAUSTED',
    candidateFetchDeadlineRemainingMs: 5000,
    candidateSourceExhausted: true,
    candidateScanCapReached: false,
    capabilityCoverageSatisfied: true,
    ...overrides,
  };
}

/**
 * Fonte primária determinística — conjunto A, fixo, sem consulta ao Mongo.
 */
export function createDeterministicPrimarySource(candidates: PokemonData[]): PrimaryCandidateFetcher & { callCount: number } {
  const source = {
    callCount: 0,
    async fetchProgressiveCandidates(): Promise<ProgressiveFetchResult> {
      source.callCount += 1;
      return {
        usableCandidates: candidates,
        allExaminedCandidates: candidates,
        endCursor: null,
        telemetry: emptyTelemetry({
          candidateDocumentsExaminedTotal: candidates.length,
          candidateUsableAccumulatedCount: candidates.length,
          candidateInitialSelectedCount: candidates.length,
        }),
      };
    },
  };
  return source;
}

/**
 * Fonte de recovery determinística — conjunto B, disjunto de A por
 * construção (os nomes passados aqui não aparecem na fonte primária).
 */
export function createDeterministicRecoverySource(
  candidates: PokemonData[],
  options: { sourceExhausted?: boolean } = {},
): RecoveryCandidateSource & { callCount: number } {
  const source = {
    callCount: 0,
    async fetch(): Promise<RecoveryCandidateSourceResult> {
      source.callCount += 1;
      return {
        candidates: candidates.map(candidate => ({
          ...candidate,
          item: candidate.item ?? 'Leftovers',
          ability: candidate.ability ?? 'Pressure',
          nature: candidate.nature ?? 'Serious',
          moves: candidate.moves ?? ['Protect'],
        })),
        rawCount: candidates.length,
        sourceExhausted: options.sourceExhausted ?? candidates.length === 0,
        endCursor: null,
      };
    },
  };
  return source;
}
