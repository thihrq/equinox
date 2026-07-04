import 'dotenv/config';

export type NodeEnvironment = 'development' | 'test' | 'production';

export interface AppConfig {
  appName: string;
  version: string;
  nodeEnv: NodeEnvironment;
  port: number;
  mongoUri: string;
  corsOrigins: string[];
  jsonLimit: string;
  isProduction: boolean;
}

function parseNodeEnv(value: string | undefined): NodeEnvironment {
  if (value === 'production' || value === 'test' || value === 'development') {
    return value;
  }

  return 'development';
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    return fallback;
  }

  return parsed;
}

function parseCorsOrigins(value: string | undefined, isProduction: boolean): string[] {
  if (!value || value.trim() === '') {
    return isProduction ? [] : ['*'];
  }

  return value
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

const nodeEnv = parseNodeEnv(process.env.NODE_ENV);
const isProduction = nodeEnv === 'production';

export const appConfig: AppConfig = {
  appName: process.env.APP_NAME || 'Equinox API',
  version: process.env.APP_VERSION || '1.0.1',
  nodeEnv,
  port: parsePort(process.env.PORT, 3000),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/pokemon_teambuilder',
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN, isProduction),
  jsonLimit: process.env.JSON_LIMIT || '1mb',
  isProduction,
};
