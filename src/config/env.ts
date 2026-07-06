import 'dotenv/config';

export type NodeEnvironment = 'development' | 'test' | 'production';
export type RuntimeProfile = 'standard' | 'render_free';

export interface AppConfig {
  appName: string;
  version: string;
  nodeEnv: NodeEnvironment;
  port: number;
  mongoUri: string;
  corsOrigins: string[];
  corsOriginPatterns: RegExp[];
  jsonLimit: string;
  runtimeProfile: RuntimeProfile;
  seedOnStartup: boolean;
  forceSeedOnStartup: boolean;
  isProduction: boolean;
}

function parseNodeEnv(value: string | undefined): NodeEnvironment {
  if (value === 'production' || value === 'test' || value === 'development') {
    return value;
  }

  return 'development';
}

function parseRuntimeProfile(value: string | undefined, isProduction: boolean): RuntimeProfile {
  if (value === 'render_free' || value === 'standard') {
    return value;
  }

  return isProduction ? 'render_free' : 'standard';
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    return fallback;
  }

  return parsed;
}

function splitEnvList(...values: Array<string | undefined>): string[] {
  return values
    .filter((value): value is string => Boolean(value && value.trim()))
    .flatMap(value => value.split(','))
    .map(value => value.trim())
    .filter(Boolean);
}

function normalizeOrigin(value: string): string | undefined {
  const trimmed = value.trim().replace(/\/+$/, '');

  if (!trimmed) return undefined;
  if (trimmed === '*') return '*';

  try {
    const parsed = new URL(trimmed);
    return parsed.origin;
  } catch (_error) {
    return trimmed;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function parseCorsOrigins(isProduction: boolean): string[] {
  const configured = splitEnvList(
    process.env.CORS_ORIGIN,
    process.env.CORS_ORIGINS,
    process.env.FRONTEND_URL,
    process.env.FRONTEND_ORIGIN,
    process.env.PUBLIC_FRONTEND_URL,
  )
    .map(normalizeOrigin)
    .filter((origin): origin is string => Boolean(origin));

  const fallbackOrigins = isProduction
    ? [
        // GitHub Pages origin used by the public Equinox frontend.
        // This keeps deploys safe when Render env vars are not applied yet.
        'https://thiihrq.github.io',
      ]
    : [
        '*',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:4173',
        'http://127.0.0.1:4173',
        'https://thiihrq.github.io',
      ];

  return unique([...configured, ...fallbackOrigins]);
}

function parseCorsOriginPatterns(): RegExp[] {
  const configuredPatterns = splitEnvList(process.env.CORS_ORIGIN_PATTERNS);
  const defaultPatterns = [
    // Allows project pages such as https://user.github.io while still requiring HTTPS.
    '^https:\\/\\/[a-z0-9-]+\\.github\\.io$',
  ];

  return [...configuredPatterns, ...defaultPatterns]
    .map(pattern => {
      try {
        return new RegExp(pattern, 'i');
      } catch (_error) {
        console.warn(`[Equinox] Ignorando CORS_ORIGIN_PATTERNS inválido: ${pattern}`);
        return undefined;
      }
    })
    .filter((pattern): pattern is RegExp => Boolean(pattern));
}

function parseBoolean(value: string | undefined): boolean {
  return value === 'true' || value === '1' || value === 'yes';
}

const nodeEnv = parseNodeEnv(process.env.NODE_ENV);
const isProduction = nodeEnv === 'production';

export const appConfig: AppConfig = {
  appName: process.env.APP_NAME || 'Equinox API',
  version: process.env.APP_VERSION || '1.0.3',
  nodeEnv,
  port: parsePort(process.env.PORT, 3000),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/pokemon_teambuilder',
  corsOrigins: parseCorsOrigins(isProduction),
  corsOriginPatterns: parseCorsOriginPatterns(),
  jsonLimit: process.env.JSON_LIMIT || '1mb',
  runtimeProfile: parseRuntimeProfile(process.env.EQUINOX_RUNTIME_PROFILE, isProduction),
  seedOnStartup: parseBoolean(process.env.EQUINOX_SEED_ON_START),
  forceSeedOnStartup: parseBoolean(process.env.EQUINOX_FORCE_SEED_ON_START),
  isProduction,
};
