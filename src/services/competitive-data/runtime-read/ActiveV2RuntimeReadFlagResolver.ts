import type { ActiveV2RuntimeReadMode } from './ActiveV2RuntimeReadTypes';

const FLAG_NAME = 'EQUINOX_ACTIVE_V2_RUNTIME_READ_ENABLED';

/**
 * Decide se o caminho de leitura do Active V2 deve ser exercitado. Quando a
 * flag está desligada (padrão), o resultado é `baseline-only` — o
 * homologador nem chega a abrir uma consulta em `pokemonsets_v2` (ver
 * `homologateActiveV2RuntimeRead`), garantindo o critério "mesmo
 * comportamento quando a flag estiver desligada" por construção, não por
 * um branch condicional depois de já ter lido dados.
 */
export function resolveActiveV2RuntimeReadMode(env: NodeJS.ProcessEnv = process.env): ActiveV2RuntimeReadMode {
  return env[FLAG_NAME] === 'true' ? 'active-v2-read' : 'baseline-only';
}
