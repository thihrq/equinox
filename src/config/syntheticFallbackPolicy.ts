import { resolveDataMode } from './dataMode';

export interface SyntheticFallbackContext {
  nodeEnv: string | undefined;
  runtimeMode: string;
  localDevExplicitlyEnabled: boolean;
  testFixtureMode: boolean;
}

export const SYNTHETIC_FALLBACK_NOT_ALLOWED = 'SYNTHETIC_FALLBACK_NOT_ALLOWED';

export function isSyntheticFallbackAllowed(context: SyntheticFallbackContext): boolean {
  if (context.testFixtureMode) return true;

  return (
    context.nodeEnv === 'development' &&
    context.runtimeMode === 'local-dev' &&
    context.localDevExplicitlyEnabled
  );
}

// Resolve o contexto real do processo. Mapeia o modo 'filesystem' de dataMode.ts (unico modo sem
// exigencia de Mongo) para runtimeMode='local-dev' -- 'mongo' e 'shadow' nunca sao elegiveis para
// fallback sintetico por esta politica, mesmo que a conexao Mongo esteja momentaneamente
// indisponivel (readyState != 1), o que fecha a lacuna onde uma queda transitoria de conexao em
// producao (modo 'mongo') poderia ter sido servida silenciosamente com dados sinteticos.
export function resolveSyntheticFallbackContext(): SyntheticFallbackContext {
  const mode = resolveDataMode();

  return {
    nodeEnv: process.env.NODE_ENV,
    runtimeMode: mode === 'filesystem' ? 'local-dev' : mode,
    localDevExplicitlyEnabled: process.env.EQUINOX_ALLOW_SYNTHETIC_FALLBACK === 'true',
    testFixtureMode: process.env.NODE_ENV === 'test',
  };
}
