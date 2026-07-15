import mongoose from 'mongoose';
import { PokemonSetV2 } from '../../../models/PokemonSetV2';
import { PublicationManifest } from '../../../models/PublicationManifest';
import type { RollbackOptions, RollbackResult } from './ActiveV2ProductionTypes';

/**
 * Reverte a publicação de uma run transacionalmente se for a run ativa atual.
 */
export async function rollbackProductionBatch(
  publishRunId: string,
  connection: mongoose.Connection,
  options: RollbackOptions
): Promise<RollbackResult> {
  const { dryRun } = options;

  // 1. Localizar o manifesto do lote
  const manifest = await PublicationManifest.findOne({ publishRunId }).exec();
  if (!manifest) {
    throw new Error(`ROLLBACK_TARGET_NOT_ACTIVE: No manifest found for publishRunId: "${publishRunId}"`);
  }

  // Só autoriza se o lote estiver ativamente vigente
  if (manifest.status !== 'active') {
    throw new Error(`ROLLBACK_TARGET_NOT_ACTIVE: Target publishRunId "${publishRunId}" is not the active batch`);
  }

  // 2. Simulação de Dry-run
  if (dryRun) {
    console.log(`[Equinox] [Dry-Run] Simulating rollback for run: ${publishRunId}`);
    console.log(`[Equinox] [Dry-Run] Sets to transition: ${manifest.setTransitions.length}`);
    return {
      status: 'success',
    };
  }

  // 3. Execução sob Transação MongoDB
  const session = await connection.startSession();
  session.startTransaction();

  try {
    const now = new Date();

    // Reverter cada set de acordo com setTransitions
    for (const transition of manifest.setTransitions) {
      const { setId, previousPublishRunId } = transition;

      // Desativar a versão atual da run
      await PokemonSetV2.updateOne(
        { setId, publishRunId, active: true },
        { $set: { active: false, productionDeactivatedAt: now } },
        { session }
      );

      // Reativar a versão anterior (se houver)
      if (previousPublishRunId) {
        await PokemonSetV2.updateOne(
          { setId, publishRunId: previousPublishRunId },
          { $set: { active: true }, $unset: { productionDeactivatedAt: 1 } },
          { session }
        );
      }
    }

    // Mudar status do manifesto atual
    manifest.status = 'rolled-back';
    await manifest.save({ session });

    // Se houver um manifesto anterior associado, reativar seu status para 'active'
    if (manifest.previousActivePublishRunId) {
      await PublicationManifest.updateOne(
        { publishRunId: manifest.previousActivePublishRunId },
        { $set: { status: 'active' } },
        { session }
      );
    }

    // Commit da transação
    await session.commitTransaction();
    session.endSession();

    return {
      status: 'success',
    };
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    throw error;
  }
}
