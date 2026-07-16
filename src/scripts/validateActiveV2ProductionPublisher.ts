import mongoose from 'mongoose';
import { PokemonSetV2 } from '../models/PokemonSetV2';
import { PublicationManifest } from '../models/PublicationManifest';
import { publishToProduction } from '../services/competitive-data/publication/ActiveV2ProductionPublisher';
import { calculateCanonicalActiveV2DataDigest } from '../services/competitive-data/digest/ActiveV2CanonicalDataDigest';

// Sobrescreve preflight passivo para os testes do publicador
const preflightModule = require('../services/competitive-data/publication/ActiveV2ProductionPreflight');
preflightModule.verifyProductionIndexesAndDuplicities = async () => {}; // passa direto

async function runPublisherTests(): Promise<void> {
  const mockStagingRecords = [
    { setId: 'set-1', pokemonName: 'pikachu', moves: ['thunderbolt'], roles: ['sweeper'], tags: ['fast'], item: 'light-ball', ability: 'static', nature: 'jolly', role: 'sweeper', synergyTags: ['fast'], activeRunId: 'run-123', status: 'active', active: true },
  ];

  const validDigest = calculateCanonicalActiveV2DataDigest(mockStagingRecords);

  const baseValidReport = {
    gateStatus: 'approved',
    automaticRolloutApproved: true,
    activeV2DataDigestAlgorithm: 'active-v2-canonical-sha256-v1',
    activeV2DataDigest: validDigest,
    activeV2RecordCount: 1,
    inputActiveRunId: 'run-123',
    baselineSourceDigest: 'sha256-baseline123',
  };

  const mockConnection = {
    db: {
      collection: (name: string) => {
        return {
          find: () => ({
            toArray: async () => mockStagingRecords
          })
        };
      }
    },
    startSession: () => ({
      startTransaction: () => {},
      commitTransaction: async () => {},
      abortTransaction: async () => {},
      endSession: () => {},
      inTransaction: () => true
    })
  } as any;

  // Guardar métodos originais
  const originalFindOneManifest = PublicationManifest.findOne;
  const originalSaveManifest = PublicationManifest.prototype.save;
  const originalInsertManySets = PokemonSetV2.insertMany;
  const originalUpdateManySets = PokemonSetV2.updateMany;
  const originalFindSets = PokemonSetV2.find;

  // --- Caso de Teste 1: Mesmo publishRunId + mesmo digest -> no-op idempotente ---
  let findOneManifestCalled = false;
  PublicationManifest.findOne = (() => {
    findOneManifestCalled = true;
    return {
      exec: async () => ({
        publishRunId: 'prod-run-1',
        activeV2DataDigest: validDigest,
        toObject: () => ({ publishRunId: 'prod-run-1', activeV2DataDigest: validDigest })
      })
    };
  }) as any;

  const res1 = await publishToProduction(baseValidReport, mockConnection, {
    publishRunId: 'prod-run-1',
    dryRun: false,
    sourceCollection: 'pokemonsets_v2_staging',
    targetCollection: 'pokemonsets_v2'
  });

  if (res1.status !== 'no-op' || res1.reasonCode !== 'RUN_ID_ALREADY_PUBLISHED_SAME_CONTENT') {
    throw new Error(`Test 1 failed: Expected no-op, got status "${res1.status}" and reasonCode "${res1.reasonCode}"`);
  }

  // --- Caso de Teste 2: Mesmo publishRunId + digest diferente -> blocker conflict ---
  PublicationManifest.findOne = (() => {
    return {
      exec: async () => ({
        publishRunId: 'prod-run-1',
        activeV2DataDigest: 'sha256-differentdigest',
        toObject: () => ({})
      })
    };
  }) as any;

  try {
    await publishToProduction(baseValidReport, mockConnection, {
      publishRunId: 'prod-run-1',
      dryRun: false,
      sourceCollection: 'pokemonsets_v2_staging',
      targetCollection: 'pokemonsets_v2'
    });
    throw new Error('Test 2 failed: Expected RUN_ID_CONTENT_CONFLICT error');
  } catch (error: any) {
    if (!error.message.includes('RUN_ID_CONTENT_CONFLICT')) throw error;
  }

  // --- Caso de Teste 3: Novo publishRunId + mesmo digest ativo -> no-op de ativo ---
  PublicationManifest.findOne = ((query: any) => {
    if (query && query.status === 'active') {
      return {
        exec: async () => ({
          publishRunId: 'prod-run-1-active',
          activeV2DataDigest: validDigest
        })
      };
    }
    return { exec: async () => null }; // Não existe com o mesmo run id
  }) as any;

  const res3 = await publishToProduction(baseValidReport, mockConnection, {
    publishRunId: 'prod-run-2',
    dryRun: false,
    sourceCollection: 'pokemonsets_v2_staging',
    targetCollection: 'pokemonsets_v2'
  });

  if (res3.status !== 'no-op' || res3.reasonCode !== 'ACTIVE_CONTENT_ALREADY_PUBLISHED' || res3.activePublishRunId !== 'prod-run-1-active') {
    throw new Error(`Test 3 failed: Expected ACTIVE_CONTENT_ALREADY_PUBLISHED, got status "${res3.status}"`);
  }

  // --- Caso de Teste 4: Novo lote diferente -> Publicação bem-sucedida e transação ---
  PublicationManifest.findOne = (() => {
    return {
      session: () => ({
        exec: async () => null
      }),
      exec: async () => null
    };
  }) as any;

  PublicationManifest.prototype.save = async function (this: any) {
    return this;
  };

  let insertManyCalled = false;
  PokemonSetV2.insertMany = (async (docs: any) => {
    insertManyCalled = true;
    return docs;
  }) as any;

  let updateManyCalledCount = 0;
  PokemonSetV2.updateMany = (async () => {
    updateManyCalledCount++;
    return {};
  }) as any;

  PokemonSetV2.find = (() => {
    return {
      session: () => ({
        exec: async () => []
      })
    };
  }) as any;

  const res4 = await publishToProduction(baseValidReport, mockConnection, {
    publishRunId: 'prod-run-3',
    dryRun: false,
    sourceCollection: 'pokemonsets_v2_staging',
    targetCollection: 'pokemonsets_v2'
  });

  if (res4.status !== 'success' || !insertManyCalled || updateManyCalledCount < 2) {
    throw new Error(`Test 4 failed: Expected success, got status "${res4.status}", insertManyCalled = ${insertManyCalled}, updateManyCalledCount = ${updateManyCalledCount}`);
  }

  // --- Caso de Teste 5: Dry-run não cria manifestos nem versões ---
  insertManyCalled = false;
  updateManyCalledCount = 0;

  const res5 = await publishToProduction(baseValidReport, mockConnection, {
    publishRunId: 'prod-run-4',
    dryRun: true,
    sourceCollection: 'pokemonsets_v2_staging',
    targetCollection: 'pokemonsets_v2'
  });

  if (res5.status !== 'success' || insertManyCalled || updateManyCalledCount > 0) {
    throw new Error('Test 5 failed: Dry-run modified database state');
  }

  // Restaurar métodos originais
  PublicationManifest.findOne = originalFindOneManifest;
  PublicationManifest.prototype.save = originalSaveManifest;
  PokemonSetV2.insertMany = originalInsertManySets;
  PokemonSetV2.updateMany = originalUpdateManySets;
  PokemonSetV2.find = originalFindSets;

  console.log('[Equinox] Active V2 production publisher validation passed.');
}

runPublisherTests().catch(err => {
  console.error(err);
  process.exit(1);
});
