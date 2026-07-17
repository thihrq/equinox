import mongoose from 'mongoose';
import { PokemonSetV2 } from '../../../models/PokemonSetV2';
import { PublicationManifest } from '../../../models/PublicationManifest';
import { verifyProductionIndexesAndDuplicities } from './ActiveV2ProductionPreflight';
import { validateLineageAndDigest } from './ActiveV2ProductionLineageValidator';
import { calculateCanonicalActiveV2DataDigest } from '../digest/ActiveV2CanonicalDataDigest';
import { assertActiveV2DataFreezeAllowsPublication } from './ActiveV2DataFreezeGuard';
import { readActiveV2CanaryConfig } from '../runtime-control/ActiveV2CanaryConfigStore';
import { runInTransactionWithRetry } from './ActiveV2ProductionTransactionRetry';
import type { PublishOptions, PublishResult } from './ActiveV2ProductionTypes';
import { ALLOWED_SOURCE_COLLECTION, ALLOWED_TARGET_COLLECTION, ALLOWED_MANIFEST_COLLECTION } from './ActiveV2ProductionPolicy';

/**
 * Orquestra a publicação transacional imutável de dados competitivos V2 (Opção C).
 */
export async function publishToProduction(
  acceptanceReport: any,
  connection: mongoose.Connection,
  options: PublishOptions
): Promise<PublishResult> {
  const { publishRunId, dryRun, sourceCollection, targetCollection } = options;

  // 1. Validação estrita de flags de segurança de ambiente e allowlist
  if (sourceCollection !== ALLOWED_SOURCE_COLLECTION) {
    throw new Error(`SECURITY_BREACH: Unauthorized source collection: "${sourceCollection}"`);
  }
  if (targetCollection !== ALLOWED_TARGET_COLLECTION) {
    throw new Error(`SECURITY_BREACH: Unauthorized target collection: "${targetCollection}"`);
  }

  // 2. Preflight passivo fora da transação
  await verifyProductionIndexesAndDuplicities(connection);

  // 2.1 Congelamento de dados durante janela canária ativa (adendo seção 13)
  const canaryConfig = await readActiveV2CanaryConfig(connection);
  assertActiveV2DataFreezeAllowsPublication(canaryConfig, {
    emergencyOverride: options.emergencyOverride ?? false,
    emergencyJustification: options.emergencyJustification ?? null,
  });

  const sourceActiveRunId = acceptanceReport.inputActiveRunId;
  if (!sourceActiveRunId) {
    throw new Error('LINEAGE_VALIDATION_FAILED: Missing inputActiveRunId in acceptance report');
  }

  const db = connection.db;
  if (!db) {
    throw new Error('LINEAGE_VALIDATION_FAILED: MongoDB connection db is not initialized');
  }
  // 3. Carregar documentos brutos completos do staging
  const stagingCol = db.collection(sourceCollection);
  const stagingRecords = await stagingCol
    .find({
      activeRunId: sourceActiveRunId,
      status: 'active',
      active: true,
    })
    .toArray();

  if (stagingRecords.length === 0) {
    throw new Error(`LINEAGE_VALIDATION_FAILED: No active records found in staging for run ID: ${sourceActiveRunId}`);
  }

  // 4. Validar linhagem de digests contra o Acceptance Gate
  validateLineageAndDigest(stagingRecords, acceptanceReport);

  const activeV2DataDigest = calculateCanonicalActiveV2DataDigest(stagingRecords);

  // 5. Tratar Idempotência e Conflitos (3 Resultados)
  // Fluxo A: Checar se o publishRunId já existe no banco
  const existingManifest = await PublicationManifest.findOne({ publishRunId }).exec();
  if (existingManifest) {
    if (existingManifest.activeV2DataDigest === activeV2DataDigest) {
      return {
        status: 'no-op',
        reasonCode: 'RUN_ID_ALREADY_PUBLISHED_SAME_CONTENT',
        activePublishRunId: publishRunId,
        requestedPublishRunId: publishRunId,
        manifest: existingManifest.toObject(),
      };
    } else {
      throw new Error(`RUN_ID_CONTENT_CONFLICT: Publish run ID "${publishRunId}" already exists with different data digest`);
    }
  }

  // Fluxo B: Checar se outro lote ativo carrega o mesmo digest
  const activeManifest = await PublicationManifest.findOne({
    status: 'active',
    activeV2DataDigest,
  }).exec();

  if (activeManifest) {
    return {
      status: 'no-op',
      reasonCode: 'ACTIVE_CONTENT_ALREADY_PUBLISHED',
      activePublishRunId: activeManifest.publishRunId,
      requestedPublishRunId: publishRunId,
    };
  }

  // 6. Execução simulada se dryRun for verdadeiro
  if (dryRun) {
    console.log(`[Equinox] [Dry-Run] Simulating publication for run: ${publishRunId}`);
    console.log(`[Equinox] [Dry-Run] Records to write: ${stagingRecords.length}`);
    return {
      status: 'success',
      requestedPublishRunId: publishRunId,
    };
  }

  // 7. Execução sob transação única do MongoDB, com retry automático em
  // TransientTransactionError (ver ActiveV2ProductionTransactionRetry.ts).
  return runInTransactionWithRetry(
    connection,
    session =>
      executeProductionPublishTransaction({
        session,
        stagingRecords,
        publishRunId,
        sourceActiveRunId,
        activeV2DataDigest,
        acceptanceReport,
      }),
    {
      onRetry: (attempt, maxRetries, error) =>
        console.warn(
          `[Equinox] Transação de publicação falhou com TransientTransactionError (tentativa ${attempt}/${maxRetries}), tentando novamente: ${error instanceof Error ? error.message : String(error)}`
        ),
    }
  );
}

interface ExecuteProductionPublishTransactionInput {
  session: mongoose.mongo.ClientSession;
  stagingRecords: any[];
  publishRunId: string;
  sourceActiveRunId: string;
  activeV2DataDigest: string;
  acceptanceReport: any;
}

async function executeProductionPublishTransaction(
  input: ExecuteProductionPublishTransactionInput
): Promise<PublishResult> {
  const { session, stagingRecords, publishRunId, sourceActiveRunId, activeV2DataDigest, acceptanceReport } = input;

  const now = new Date();

  // Determinar a publicação ativa anterior
  const previousActiveManifest = await PublicationManifest.findOne({ status: 'active' }).session(session).exec();
  const previousActivePublishRunId = previousActiveManifest ? previousActiveManifest.publishRunId : null;

  // Buscar no banco registros ativamente vigentes
  const existingActiveSets = await PokemonSetV2.find({ active: true }).session(session).exec();

  // Mapear transições por documento
  const setTransitions = stagingRecords.map(rec => {
    const currentActive = existingActiveSets.find(x => x.setId === rec.setId);
    return {
      setId: rec.setId,
      previousPublishRunId: currentActive ? currentActive.publishRunId : null,
      newPublishRunId: publishRunId,
    };
  });

  // Inserir os novos documentos na coleção de produção pokemonsets_v2 como inativos
  const docsToInsert = stagingRecords.map(rec => {
    // Clona o documento removendo o _id e campos transitórios
    const { _id, ...cleanRec } = rec;
    return {
      ...cleanRec,
      // PokemonSetV2Schema exige `role` (legado, singular) além de
      // `primaryRole`/`secondaryRoles` (o par realmente usado pelo
      // pipeline de curação/governança). Nenhum consumidor a jusante lê
      // `.role` hoje, mas o schema o exige — sem isso, insertMany falha
      // em runtime real (só descoberto rodando contra Mongo de verdade;
      // os testes offline mockam o model e nunca exercitam essa validação).
      role: cleanRec.role ?? cleanRec.primaryRole ?? 'unknown',
      publishRunId,
      previousPublishRunId: setTransitions.find(t => t.setId === rec.setId)?.previousPublishRunId || null,
      sourceActiveRunId,
      active: false, // Começam inativos para o chaveamento atômico
      publishedAt: now,
    };
  });

  await PokemonSetV2.insertMany(docsToInsert, { session });

  // Criar o manifesto de publicação inicial como prepared
  const manifest = new PublicationManifest({
    publishRunId,
    previousActivePublishRunId,
    sourceActiveRunId,
    setIds: stagingRecords.map(r => r.setId),
    recordCount: stagingRecords.length,
    activeV2DataDigest,
    acceptanceReportDigest: (acceptanceReport as any).inputEvidenceDigest || 'unknown',
    shadowEvidenceDigest: (acceptanceReport as any).inputEvidenceDigest || 'unknown',
    baselineSourceDigest: (acceptanceReport as any).baselineSourceDigest || 'unknown',
    status: 'prepared',
    setTransitions,
  });
  await manifest.save({ session });

  // Desativar versões anteriores
  await PokemonSetV2.updateMany(
    { active: true, setId: { $in: stagingRecords.map(r => r.setId) } },
    { $set: { active: false, productionDeactivatedAt: now } },
    { session }
  );

  // Ativar versões recém-inseridas
  await PokemonSetV2.updateMany(
    { publishRunId, setId: { $in: stagingRecords.map(r => r.setId) } },
    { $set: { active: true, productionActivatedAt: now } },
    { session }
  );

  // Se havia um manifesto ativo anterior, muda status para 'published'
  if (previousActiveManifest) {
    previousActiveManifest.status = 'published';
    await previousActiveManifest.save({ session });
  }

  // Mudar manifesto atual para active
  manifest.status = 'active';
  await manifest.save({ session });

  // Commit fica a cargo do chamador (publishToProduction), que também
  // trata retry de TransientTransactionError.
  return {
    status: 'success',
    manifest: manifest.toObject(),
  };
}
