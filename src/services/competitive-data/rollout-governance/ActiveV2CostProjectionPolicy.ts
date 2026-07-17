/**
 * Perfil de operações Mongo por requisição avaliada pelo Active V2. Os
 * valores abaixo não são estimativas soltas — refletem literalmente as
 * chamadas ao Mongo em `ActiveV2RuntimeShadowOrchestrator.runActiveV2RuntimeShadow`
 * (Fase 3, o único caminho de runtime realmente implementado hoje):
 *
 *   1. readActiveV2CanaryConfig  -> 1 leitura, sempre que a flag estática e o
 *      formato batem (independente do modo do canário).
 *   2. readActiveV2RuntimeControl -> 1 leitura adicional, só quando o passo 1
 *      já confirmou mode === 'shadow'.
 *   3. setsCol.find(...) por Pokémon sugerido -> 1 leitura por elemento de
 *      `input.primaryTeamSuggestedPokemons` (tipicamente o tamanho do time
 *      complementar sugerido).
 *   4. insertOne do evento de telemetria -> 1 escrita, ao final.
 *
 * Quando a Fase 5+ implementar a leitura real de `pokemonsets_v2` para
 * *servir* respostas a usuários (não só comparar em shadow), o perfil de
 * leitura muda e este arquivo precisa ser recalibrado — hoje ele descreve
 * apenas o caminho de shadow, que é o único com código real de runtime.
 */
export interface ActiveV2MongoIoProfile {
  version: string;
  configReadsPerEvaluatedRequest: number;
  /** Leituras em `pokemonsets_v2` por Pokémon do time sugerido comparado. */
  setReadsPerSuggestedPokemon: number;
  /** Tamanho assumido do time complementar sugerido, quando não informado pelo chamador. */
  defaultSuggestedTeamSize: number;
  telemetryWritesPerEvaluatedRequest: number;
}

export const ACTIVE_V2_SHADOW_MONGO_IO_PROFILE_V1: ActiveV2MongoIoProfile = {
  version: 'active-v2-shadow-mongo-io-v1',
  configReadsPerEvaluatedRequest: 2, // canary config + circuit breaker
  setReadsPerSuggestedPokemon: 1,
  defaultSuggestedTeamSize: 3,
  telemetryWritesPerEvaluatedRequest: 1,
} as const;

/**
 * Percentuais padrão de canário do adendo (Fases 6-9) mais o rollout total
 * (Fase 10) — os pontos para os quais a projeção de custo é calculada.
 */
export const ACTIVE_V2_COST_PROJECTION_TARGET_PERCENTAGES: readonly number[] = [5, 10, 25, 50, 100];

/**
 * Tarifa real do Atlas por mil operações. Deliberadamente sem valor padrão —
 * inventar um número aqui seria apresentar uma estimativa fantasiada como se
 * fosse um dado real de billing. O operador deve informar a tarifa real do
 * seu cluster/plano quando quiser conversão para dinheiro; sem isso, a
 * projeção fica limitada a contagem de operações.
 */
export interface ActiveV2MongoCostRates {
  costPerThousandReads: number;
  costPerThousandWrites: number;
  currency: string;
}
