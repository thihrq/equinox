import mongoose from 'mongoose';
import { PokemonSetV2 } from '../../../models/PokemonSetV2';
import { PublicationManifest } from '../../../models/PublicationManifest';
import { runInTransactionWithRetry } from './ActiveV2ProductionTransactionRetry';
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

  // 3. Execução sob Transação MongoDB, com retry automático em
  // TransientTransactionError (ver ActiveV2ProductionTransactionRetry.ts).
  return runInTransactionWithRetry(
    connection,
    async session => {
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

      return { status: 'success' as const };
    },
    {
      onRetry: (attempt, maxRetries, error) =>
        console.warn(
          `[Equinox] Transação de rollback falhou com TransientTransactionError (tentativa ${attempt}/${maxRetries}), tentando novamente: ${error instanceof Error ? error.message : String(error)}`
        ),
    }
  );
}
