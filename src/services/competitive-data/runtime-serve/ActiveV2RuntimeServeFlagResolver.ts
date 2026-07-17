export type ActiveV2RuntimeServeMode = 'active-v2-serve' | 'baseline-only';

const FLAG_NAME = 'EQUINOX_ACTIVE_V2_RUNTIME_SERVE_ENABLED';

/**
 * Decide se o caminho de serving real do Active V2 deve ser exercitado.
 * Quando a flag está desligada (padrão), o resultado é `baseline-only` — o
 * orquestrador de serving nem chega a ler `pokemonsets_v2`/config de
 * canário/circuit breaker, garantindo "mesmo comportamento com a flag
 * desligada" por construção, no mesmo padrão de
 * `ActiveV2RuntimeReadFlagResolver`/`ActiveV2RuntimeShadowOrchestrator`.
 * Deploy-level (não depende de Mongo) — é o interruptor mais barato,
 * checado antes de qualquer I/O.
 */
export function resolveActiveV2RuntimeServeMode(env: NodeJS.ProcessEnv = process.env): ActiveV2RuntimeServeMode {
  return env[FLAG_NAME] === 'true' ? 'active-v2-serve' : 'baseline-only';
}
