import mongoose from 'mongoose';
import {
  ALLOWED_TARGET_COLLECTION,
  ALLOWED_MANIFEST_COLLECTION,
} from '../publication/ActiveV2ProductionPolicy';
import type { CompetitiveSetValidationInput } from '../../../equinox/data-validation/CompetitiveValidationTypes';

export interface ActiveV2RuntimeReadResult {
  records: CompetitiveSetValidationInput[];
  activeManifest: any | null;
}

function toValidationInput(record: Record<string, unknown>): CompetitiveSetValidationInput {
  return {
    pokemonName: String(record.pokemonName ?? ''),
    pokemonId: typeof record.pokemonId === 'string' ? record.pokemonId : undefined,
    formId: typeof record.formId === 'string' ? record.formId : undefined,
    formatId: typeof record.formatId === 'string' ? record.formatId : undefined,
    regulationId: typeof record.regulationId === 'string' ? record.regulationId : undefined,
    battleStyle: record.battleStyle === 'singles' || record.battleStyle === 'doubles' ? record.battleStyle : undefined,
    setId: typeof record.setId === 'string' ? record.setId : undefined,
    setName: typeof record.setName === 'string' ? record.setName : undefined,
    item: typeof record.item === 'string' ? record.item : undefined,
    ability: typeof record.ability === 'string' ? record.ability : undefined,
    nature: typeof record.nature === 'string' ? record.nature : undefined,
    evs: record.evs as CompetitiveSetValidationInput['evs'],
    ivs: record.ivs as CompetitiveSetValidationInput['ivs'],
    moves: Array.isArray(record.moves) ? record.moves.map(String) : undefined,
    primaryRole: typeof record.primaryRole === 'string' ? record.primaryRole : undefined,
    secondaryRoles: Array.isArray(record.secondaryRoles) ? record.secondaryRoles.map(String) : undefined,
    archetypes: Array.isArray(record.archetypes) ? record.archetypes.map(String) : undefined,
    synergyTags: Array.isArray(record.synergyTags) ? record.synergyTags.map(String) : undefined,
    sourceId: typeof record.sourceId === 'string' ? record.sourceId : undefined,
    sourceType: typeof record.sourceType === 'string' ? record.sourceType : undefined,
    sourceUpdatedAt: typeof record.sourceUpdatedAt === 'string' ? record.sourceUpdatedAt : undefined,
    confidence: typeof record.confidence === 'number' ? record.confidence : undefined,
    legal: typeof record.legal === 'boolean' ? record.legal : undefined,
    status: record.status as CompetitiveSetValidationInput['status'],
    active: typeof record.active === 'boolean' ? record.active : undefined,
    coherenceScore: typeof record.coherenceScore === 'number' ? record.coherenceScore : undefined,
    dataVersion: typeof record.dataVersion === 'string' ? record.dataVersion : undefined,
    contentHash: typeof record.contentHash === 'string' ? record.contentHash : undefined,
  };
}

/**
 * Leitura estritamente read-only do Active V2 em produção (Fase 2). Este
 * módulo intencionalmente só conhece dois nomes de coleção — `pokemonsets_v2`
 * e `publication_manifests`, ambos importados de `ActiveV2ProductionPolicy.ts`
 * — e nunca referencia a coleção legada `pokemonsets` em nenhuma linha deste
 * arquivo. Isso torna "zero leitura da coleção legada" uma garantia
 * estrutural do código, não apenas um comportamento observado em runtime.
 * Nenhuma função de escrita é importada ou chamada aqui.
 */
export async function readActiveV2ProductionState(connection: mongoose.Connection): Promise<ActiveV2RuntimeReadResult> {
  const db = connection.db;
  if (!db) {
    throw new Error('RUNTIME_READ_FAILED: MongoDB connection db is not initialized');
  }

  const setsCol = db.collection<any>(ALLOWED_TARGET_COLLECTION);
  const manifestCol = db.collection<any>(ALLOWED_MANIFEST_COLLECTION);

  let rawRecords: any[];
  try {
    rawRecords = await setsCol.find({ active: true }).toArray();
  } catch (error) {
    throw new Error(`RUNTIME_READ_FAILED: Failed to read active sets from ${ALLOWED_TARGET_COLLECTION}: ${error instanceof Error ? error.message : String(error)}`);
  }

  let activeManifest: any = null;
  try {
    activeManifest = await manifestCol.findOne({ status: 'active' });
  } catch (error) {
    throw new Error(`RUNTIME_READ_FAILED: Failed to read active manifest from ${ALLOWED_MANIFEST_COLLECTION}: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    records: rawRecords.map(toValidationInput),
    activeManifest,
  };
}
