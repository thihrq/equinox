import mongoose from 'mongoose';

/**
 * Executa as verificações passivas de índices e duplicidades ativas no MongoDB de produção.
 * Caso um índice esteja ausente ou haja duplicidades ativas, lança um erro com "INDEX_PREFLIGHT_FAILED".
 */
export async function verifyProductionIndexesAndDuplicities(connection: mongoose.Connection): Promise<void> {
  const db = connection.db;
  if (!db) {
    throw new Error('INDEX_PREFLIGHT_FAILED: MongoDB connection db is not initialized');
  }

  // 1. Validar a existência dos índices em pokemonsets_v2
  const setsCol = db.collection('pokemonsets_v2');
  let setsIndexes: any[] = [];
  try {
    setsIndexes = await setsCol.listIndexes().toArray();
  } catch (error) {
    throw new Error(`INDEX_PREFLIGHT_FAILED: Failed to list indexes for pokemonsets_v2: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Índice Composto Único { setId: 1, publishRunId: 1 }
  const hasCompoundIndex = setsIndexes.some(idx => {
    const keys = Object.keys(idx.key);
    return (
      keys.length === 2 &&
      idx.key.setId === 1 &&
      idx.key.publishRunId === 1 &&
      idx.unique === true
    );
  });

  if (!hasCompoundIndex) {
    throw new Error('INDEX_PREFLIGHT_FAILED: Unique compound index { setId: 1, publishRunId: 1 } is missing or incorrect');
  }

  // Índice Parcial Único { setId: 1 } where active === true
  const hasPartialActiveIndex = setsIndexes.some(idx => {
    const keys = Object.keys(idx.key);
    return (
      keys.length === 1 &&
      idx.key.setId === 1 &&
      idx.unique === true &&
      idx.partialFilterExpression &&
      idx.partialFilterExpression.active === true
    );
  });

  if (!hasPartialActiveIndex) {
    throw new Error('INDEX_PREFLIGHT_FAILED: Unique partial index { setId: 1 } where active === true is missing or incorrect');
  }

  // 2. Validar a existência dos índices em publication_manifests
  const manifestCol = db.collection('publication_manifests');
  let manifestIndexes: any[] = [];
  try {
    manifestIndexes = await manifestCol.listIndexes().toArray();
  } catch (error) {
    throw new Error(`INDEX_PREFLIGHT_FAILED: Failed to list indexes for publication_manifests: ${error instanceof Error ? error.message : String(error)}`);
  }

  const hasManifestUniqueIndex = manifestIndexes.some(idx => {
    const keys = Object.keys(idx.key);
    return (
      keys.length === 1 &&
      idx.key.publishRunId === 1 &&
      idx.unique === true
    );
  });

  if (!hasManifestUniqueIndex) {
    throw new Error('INDEX_PREFLIGHT_FAILED: Unique index on publication_manifests.publishRunId is missing or incorrect');
  }

  // 3. Detectar duplicidades ativas na coleção pokemonsets_v2
  let activeDuplicates: any[] = [];
  try {
    activeDuplicates = await setsCol.aggregate([
      { $match: { active: true } },
      { $group: { _id: '$setId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
  } catch (error) {
    throw new Error(`INDEX_PREFLIGHT_FAILED: Failed to run duplicate detection query: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (activeDuplicates.length > 0) {
    const duplicateIds = activeDuplicates.map(d => d._id).join(', ');
    throw new Error(`INDEX_PREFLIGHT_FAILED: Duplicate active versions detected for setIds: ${duplicateIds}`);
  }
}
