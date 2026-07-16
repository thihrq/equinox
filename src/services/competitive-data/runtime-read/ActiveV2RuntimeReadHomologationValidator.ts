import mongoose from 'mongoose';
import { readActiveV2ProductionState } from './ActiveV2RuntimeReader';
import { computeActiveV2RuntimeManifestHealth } from '../runtime-observability/ActiveV2RuntimeManifestHealth';
import { validateCompetitiveSetStructure } from '../../../equinox/data-validation/CompetitiveSetStructureValidator';
import { validateCompetitiveSetLegality } from '../../../equinox/data-validation/CompetitiveSetLegalityValidator';
import type {
  ActiveV2RuntimeReadHomologationResult,
  ActiveV2RuntimeReadMode,
  ActiveV2RuntimeReadRecordIssue,
} from './ActiveV2RuntimeReadTypes';
import type { ActiveV2RuntimeManifestHealthSnapshot } from '../runtime-observability/ActiveV2RuntimeTelemetryTypes';

function manifestHealthIssues(health: ActiveV2RuntimeManifestHealthSnapshot): ActiveV2RuntimeReadRecordIssue[] {
  const issues: ActiveV2RuntimeReadRecordIssue[] = [];

  if (health.activeSetCount === 0) {
    issues.push({ setId: 'manifest', reason: 'MANIFEST_HEALTH_ISSUE', detail: 'Zero active sets found in pokemonsets_v2.' });
  }

  for (const setId of health.activeSetIdsWithMultipleActiveVersions) {
    issues.push({ setId, reason: 'MANIFEST_HEALTH_ISSUE', detail: 'setId has more than one active version simultaneously.' });
  }

  if (!health.manifestRecordCountMatchesActiveSetCount) {
    issues.push({ setId: 'manifest', reason: 'MANIFEST_HEALTH_ISSUE', detail: 'Manifest recordCount does not match the actual count of active sets.' });
  }

  if (!health.digestMatchesManifest) {
    issues.push({ setId: 'manifest', reason: 'MANIFEST_HEALTH_ISSUE', detail: 'Recomputed digest of active sets diverges from the manifest digest.' });
  }

  return issues;
}

/**
 * Homologação read-only do runtime contra Active V2 (Fase 2). Valida os
 * critérios da fase: uma versão ativa por setId, manifesto consistente,
 * digest, schema de cada registro, ausência de fallback silencioso
 * (completude entre o manifesto e os registros lidos), e o comportamento
 * idêntico ao baseline quando o modo é `baseline-only`.
 *
 * Reaproveita `computeActiveV2RuntimeManifestHealth` (Fase 2A) em vez de
 * duplicar a lógica de "uma versão ativa/manifesto/digest" — os mesmos
 * critérios, uma única implementação.
 */
export async function homologateActiveV2RuntimeRead(
  connection: mongoose.Connection | null,
  mode: ActiveV2RuntimeReadMode
): Promise<ActiveV2RuntimeReadHomologationResult> {
  const generatedAt = new Date().toISOString();

  if (mode === 'baseline-only') {
    return {
      mode,
      approved: true,
      recordCount: 0,
      manifestHealth: null,
      recordIssues: [],
      legacyCollectionAccessed: false,
      writesAttempted: false,
      generatedAt,
    };
  }

  if (!connection) {
    throw new Error('RUNTIME_READ_FAILED: a MongoDB connection is required when mode=active-v2-read');
  }

  const manifestHealth = await computeActiveV2RuntimeManifestHealth(connection);
  const { records, activeManifest } = await readActiveV2ProductionState(connection);

  const recordIssues: ActiveV2RuntimeReadRecordIssue[] = [...manifestHealthIssues(manifestHealth)];

  for (const record of records) {
    const setId = String(record.setId ?? 'unknown');
    const structure = validateCompetitiveSetStructure(record);
    if (!structure.valid) {
      recordIssues.push({
        setId,
        reason: 'SCHEMA_INVALID',
        detail: `Structure validation failed: ${structure.errors.map(e => e.code).join(', ')}`,
      });
      continue;
    }

    const legality = validateCompetitiveSetLegality(record);
    if (!legality.legal) {
      recordIssues.push({
        setId,
        reason: 'SCHEMA_INVALID',
        detail: `Legality validation failed: ${legality.errors.map(e => e.code).join(', ')}`,
      });
    }
  }

  const manifestSetIds: string[] = Array.isArray(activeManifest?.setIds) ? activeManifest.setIds : [];
  const readSetIds = new Set(records.map(record => String(record.setId ?? '')));
  for (const expectedSetId of manifestSetIds) {
    if (!readSetIds.has(expectedSetId)) {
      recordIssues.push({
        setId: expectedSetId,
        reason: 'INCOMPLETE_ACTIVE_SET',
        detail: 'setId is listed in the active manifest but was not found among the active records read from pokemonsets_v2 (silent fallback risk).',
      });
    }
  }

  return {
    mode,
    approved: recordIssues.length === 0,
    recordCount: records.length,
    manifestHealth,
    recordIssues,
    legacyCollectionAccessed: false,
    writesAttempted: false,
    generatedAt,
  };
}
