import type { ActiveV2InternalCanaryRequestHeaders } from '../internal-canary-auth/ActiveV2InternalCanaryAuthTypes';
import type { ActiveV2RuntimeTelemetryEvent } from '../runtime-observability/ActiveV2RuntimeTelemetryTypes';

export interface ActiveV2ServeSuggestedPokemon {
  name: string;
  item: string;
  ability: string;
  nature: string;
  moves: string[];
}

export interface ActiveV2RuntimeServeInput {
  requestId: string;
  /**
   * Identificador determinístico para o hashing do canário — distinto de
   * `requestId` (que é aleatório por requisição, só para correlação de
   * telemetria/log). Sem determinismo aqui, um mesmo time consultado duas
   * vezes poderia cair em baseline numa vez e em V2 na outra, uma
   * inconsistência de UX que o shadow mode (não visível ao usuário) podia
   * se dar ao luxo de ignorar, mas o serving real não pode.
   */
  identifier: string;
  format: string;
  teamIdentity: string;
  primaryTeamSuggestedPokemons: ActiveV2ServeSuggestedPokemon[];
  baselineLatencyMs: number;
  /**
   * Headers HMAC extraídos da requisição (Fase 5) — null quando ausentes.
   * Só é consultado quando o canário está em modo `internal`.
   */
  internalCanaryAuthHeaders: Partial<ActiveV2InternalCanaryRequestHeaders> | null;
  requestPath: string;
}

export interface ActiveV2RuntimeServeResult {
  servePath: 'active-v2' | 'baseline';
  /** null => o chamador não deve alterar a resposta (mantém os dados do baseline). */
  hydratedSuggestedPokemons: ActiveV2ServeSuggestedPokemon[] | null;
  /** Evento pronto para inserção — null quando esta requisição não deve gerar telemetria. */
  telemetryEvent: ActiveV2RuntimeTelemetryEvent | null;
}
