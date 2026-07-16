import mongoose from 'mongoose';
import { calculateCanonicalActiveV2DataDigest } from '../digest/ActiveV2CanonicalDataDigest';
import type { ActiveV2RuntimeManifestHealthSnapshot } from './ActiveV2RuntimeTelemetryTypes';

/**
 * Cruza o estado real de `pokemonsets_v2` e `publication_manifests` para detectar
 * as quatro condições de alerta estrutural do adendo 3.1: zero active sets,
 * múltiplas versões ativas para o mesmo setId, inconsistência de manifesto e
 * divergência de digest. Segue o mesmo padrão de `verifyProductionIndexesAndDuplicities`
 * (conexão recebida por parâmetro, acesso via `connection.db.collection`) para
 * permitir mock offline com um objeto de conexão falso.
 */
export async function computeActiveV2RuntimeManifestHealth(
  connection: mongoose.Connection
): Promise<ActiveV2RuntimeManifestHealthSnapshot> {
  const db = connection.db;
  if (!db) {
    throw new Error('MANIFEST_HEALTH_CHECK_FAILED: MongoDB connection db is not initialized');
  }

  const setsCol = db.collection('pokemonsets_v2');
  const manifestCol = db.collection('publication_manifests');

  let activeSets: any[];
  try {
    activeSets = await setsCol.find({ active: true }).toArray();
  } catch (error) {
    throw new Error(`MANIFEST_HEALTH_CHECK_FAILED: Failed to read active sets from pokemonsets_v2: ${error instanceof Error ? error.message : String(error)}`);
  }

  const activeCountBySetId = new Map<string, number>();
  for (const set of activeSets) {
    activeCountBySetId.set(set.setId, (activeCountBySetId.get(set.setId) ?? 0) + 1);
  }
  const activeSetIdsWithMultipleActiveVersions = [...activeCountBySetId.entries()]
    .filter(([, count]) => count > 1)
    .map(([setId]) => setId)
    .sort();

  let activeManifestDoc: any = null;
  try {
    activeManifestDoc = await manifestCol.findOne({ status: 'active' });
  } catch (error) {
    throw new Error(`MANIFEST_HEALTH_CHECK_FAILED: Failed to read active manifest from publication_manifests: ${error instanceof Error ? error.message : String(error)}`);
  }

  const activeManifest = activeManifestDoc
    ? {
        publishRunId: activeManifestDoc.publishRunId,
        status: activeManifestDoc.status,
        activeV2DataDigest: activeManifestDoc.activeV2DataDigest,
        recordedRecordCount: activeManifestDoc.recordCount,
      }
    : null;

  const manifestRecordCountMatchesActiveSetCount = activeManifest
    ? activeManifest.recordedRecordCount === activeSets.length
    : activeSets.length === 0;

  const recomputedActiveV2DataDigest = calculateCanonicalActiveV2DataDigest(activeSets);

  const digestMatchesManifest = activeManifest
    ? recomputedActiveV2DataDigest === activeManifest.activeV2DataDigest
    : activeSets.length === 0;

  return {
    activeSetCount: activeSets.length,
    activeSetIdsWithMultipleActiveVersions,
    activeManifest,
    manifestRecordCountMatchesActiveSetCount,
    recomputedActiveV2DataDigest,
    digestMatchesManifest,
  };
}
