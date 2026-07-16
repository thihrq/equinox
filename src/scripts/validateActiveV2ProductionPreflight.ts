import { verifyProductionIndexesAndDuplicities } from '../services/competitive-data/publication/ActiveV2ProductionPreflight';

async function runPreflightTests(): Promise<void> {
  // Teste 1: Índices de pokemonsets_v2 ausentes -> INDEX_PREFLIGHT_FAILED
  const connectionIndexesMissing = {
    db: {
      collection: (name: string) => {
        return {
          listIndexes: () => ({
            toArray: async () => [] // Sem índices criados
          }),
          aggregate: () => ({
            toArray: async () => []
          })
        };
      }
    }
  } as any;

  try {
    await verifyProductionIndexesAndDuplicities(connectionIndexesMissing);
    throw new Error('Test 1 failed: Expected INDEX_PREFLIGHT_FAILED for missing indexes');
  } catch (error: any) {
    if (!error.message.includes('INDEX_PREFLIGHT_FAILED')) throw error;
  }

  // Teste 2: Duplicidades ativas detectadas -> INDEX_PREFLIGHT_FAILED
  const connectionDuplicities = {
    db: {
      collection: (name: string) => {
        if (name === 'pokemonsets_v2') {
          return {
            listIndexes: () => ({
              toArray: async () => [
                { key: { setId: 1, publishRunId: 1 }, unique: true },
                { key: { setId: 1 }, unique: true, partialFilterExpression: { active: true } }
              ]
            }),
            aggregate: () => ({
              toArray: async () => [{ _id: 'set-a', count: 2 }] // Duplicidade ativa!
            })
          };
        }
        return {
          listIndexes: () => ({
            toArray: async () => [
              { key: { publishRunId: 1 }, unique: true }
            ]
          })
        };
      }
    }
  } as any;

  try {
    await verifyProductionIndexesAndDuplicities(connectionDuplicities);
    throw new Error('Test 2 failed: Expected INDEX_PREFLIGHT_FAILED for duplicities');
  } catch (error: any) {
    if (!error.message.includes('INDEX_PREFLIGHT_FAILED') || !error.message.includes('Duplicate active versions')) {
      throw error;
    }
  }

  // Teste 3: Índices corretos e sem duplicidades -> Sucesso sem erros
  const connectionSuccess = {
    db: {
      collection: (name: string) => {
        if (name === 'pokemonsets_v2') {
          return {
            listIndexes: () => ({
              toArray: async () => [
                { key: { setId: 1, publishRunId: 1 }, unique: true },
                { key: { setId: 1 }, unique: true, partialFilterExpression: { active: true } }
              ]
            }),
            aggregate: () => ({
              toArray: async () => [] // Sem duplicidades
            })
          };
        }
        return {
          listIndexes: () => ({
            toArray: async () => [
              { key: { publishRunId: 1 }, unique: true }
            ]
          })
        };
      }
    }
  } as any;

  await verifyProductionIndexesAndDuplicities(connectionSuccess);

  console.log('[Equinox] Active V2 production preflight validation passed.');
}

runPreflightTests().catch(err => {
  console.error(err);
  process.exit(1);
});
