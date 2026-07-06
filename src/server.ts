import express from 'express';
import cors, { CorsOptions } from 'cors';
import mongoose from 'mongoose';

import { connectDatabase } from './config/database';
import { appConfig } from './config/env';
import { Pokemon } from './models/Pokemon';
import routes from './apiRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { runDatabaseSeed } from './workers/runWorker';

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;

  const normalizedOrigin = origin.replace(/\/+$/, '');
  const allowedOrigins = appConfig.corsOrigins;

  if (allowedOrigins.includes('*')) return true;
  if (allowedOrigins.includes(normalizedOrigin)) return true;

  return appConfig.corsOriginPatterns.some(pattern => pattern.test(normalizedOrigin));
}

function createCorsOptions(): CorsOptions {
  return {
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      console.warn(`[Equinox] CORS bloqueado para origem: ${origin}`);
      callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
    optionsSuccessStatus: 204,
    credentials: false,
  };
}

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors(createCorsOptions()));
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
