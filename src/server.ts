import express from 'express';
import mongoose from 'mongoose';

import { connectDatabase } from './config/database';
import { appConfig } from './config/env';
import { Pokemon } from './models/Pokemon';
import routes from './apiRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { runDatabaseSeed } from './workers/runWorker';

function normalizeRequestOrigin(origin: string | undefined): string | undefined {
  if (!origin) return undefined;

  const trimmed = origin.trim().replace(/\/+$/, '');

  try {
    return new URL(trimmed).origin;
  } catch (_error) {
    return trimmed;
  }
}

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;

  const normalizedOrigin = normalizeRequestOrigin(origin);
  const allowedOrigins = appConfig.corsOrigins;

  if (!normalizedOrigin) return true;
  if (allowedOrigins.includes('*')) return true;
  if (allowedOrigins.includes(normalizedOrigin)) return true;

  return appConfig.corsOriginPatterns.some(pattern => pattern.test(normalizedOrigin));
}

function applyCorsHeaders(req: express.Request, res: express.Response): boolean {
  const origin = normalizeRequestOrigin(req.headers.origin);

  if (!origin) return true;

  if (!isOriginAllowed(origin)) {
    console.warn(`[Equinox] CORS bloqueado para origem: ${origin}`);
    return false;
  }

  const allowAnyOrigin = appConfig.corsOrigins.includes('*');

  res.setHeader('Access-Control-Allow-Origin', allowAnyOrigin ? '*' : origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type,Accept,Authorization,X-Requested-With',
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  return true;
}

function corsMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const allowed = applyCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.status(allowed ? 204 : 403).end();
    return;
  }

  if (!allowed) {
    res.status(403).json({
      status: 'error',
      code: 'CORS_ORIGIN_BLOCKED',
      message: 'Origem não permitida pela API do Equinox.',
      origin: normalizeRequestOrigin(req.headers.origin),
    });
    return;
  }

  next();
}

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(corsMiddleware);
app.use(express.json({ limit: appConfig.jsonLimit }));
app.use(routes);
app.use(notFoundHandler);
app.use(errorHandler);

const runStartupSeedIfNeeded = async (): Promise<void> => {
  if (!appConfig.seedOnStartup) return;

  try {
    const existingPokemonCount = await Pokemon.estimatedDocumentCount();

    if (existingPokemonCount > 0 && !appConfig.forceSeedOnStartup) {
      console.log(`[Equinox] Seed automático ignorado: banco já tem ${existingPokemonCount} Pokémon.`);
      return;
    }

    console.log('[Equinox] Seed automático iniciado.');
    await runDatabaseSeed();
    console.log('[Equinox] Seed automático concluído.');
  } catch (error) {
    console.error('[Equinox] Seed automático falhou:', error);
  }
};

const startServer = async () => {
  try {
    await connectDatabase();

    const server = app.listen(appConfig.port, () => {
      console.log(`🚀 ${appConfig.appName} rodando na porta ${appConfig.port}`);
      console.log(`🌱 Ambiente: ${appConfig.nodeEnv}`);
      console.log(`⚙️ Runtime profile: ${appConfig.runtimeProfile}`);
      console.log(`🌐 CORS origins: ${appConfig.corsOrigins.length > 0 ? appConfig.corsOrigins.join(', ') : 'none'}`);
    });

    void runStartupSeedIfNeeded();

    const shutdown = async (signal: NodeJS.Signals) => {
      console.log(`\n[Equinox] Recebido ${signal}. Encerrando servidor com segurança...`);

      server.close(async () => {
        await mongoose.disconnect();
        console.log('[Equinox] Servidor encerrado.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('🚨 Erro crítico ao iniciar o servidor:', error);
    process.exit(1);
  }
};

startServer();
