export interface ActiveV2ShadowSuggestedPokemon {
  name: string;
  item: string;
  ability: string;
  nature: string;
  moves: string[];
}

export interface ActiveV2RuntimeShadowInput {
  requestId: string;
  format: string;
  teamIdentity: string;
  /**
   * Apenas o primeiro (principal) time sugerido é comparado — comparar os
   * 5 times variantes multiplicaria o volume de telemetria por 5 sem
   * agregar sinal proporcional, já que todos competem pelos mesmos
   * Pokémon candidatos.
   */
  primaryTeamSuggestedPokemons: ActiveV2ShadowSuggestedPokemon[];
  baselineLatencyMs: number;
}

export type ActiveV2ShadowFieldComparisonOutcome = 'match' | 'diverged' | 'no-v2-data';

export interface ActiveV2ShadowPokemonComparison {
  pokemonName: string;
  outcome: ActiveV2ShadowFieldComparisonOutcome;
  divergentFields: string[];
}
