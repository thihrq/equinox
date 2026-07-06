import express from 'express';
import cors, { CorsOptions } from 'cors';
import mongoose from 'mongoose';

import { connectDatabase } from './config/database';
import { appConfig } from './config/env';
import { Pokemon } from './models/Pokemon';
import routes from './apiRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { runDatabaseSeed } from './workers/runWorker';

function createCorsOptions(): CorsOptions {
  return {
    origin(origin, callback) {
      const allowedOrigins = appConfig.corsOrigins;

      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
    },
    credentials: true,
  };
}

const app = express();

app.disable('x-powered-by');
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
