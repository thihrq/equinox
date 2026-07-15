import mongoose from 'mongoose';
import { PokemonSetV2 } from '../models/PokemonSetV2';
import { PublicationManifest } from '../models/PublicationManifest';
import { rollbackProductionBatch } from '../services/competitive-data/publication/ActiveV2ProductionRollback';

async function runRollbackTests(): Promise<void> {
  const mockConnection = {
    startSession: () => ({
      startTransaction: () => {},
      commitTransaction: async () => {},
      abortTransaction: async () => {},
      endSession: () => {}
    })
  } as any;

  // Guardar métodos originais
  const originalFindOneManifest = PublicationManifest.findOne;
  const originalSaveManifest = PublicationManifest.prototype.save;
  const originalUpdateOneManifest = PublicationManifest.updateOne;
  const originalUpdateOneSet = PokemonSetV2.updateOne;
  const originalDeleteOneSet = PokemonSetV2.deleteOne;
  const originalDeleteManySet = PokemonSetV2.deleteMany;

  // Garantia absoluta de que deletações físicas são proibidas
  let deleteCalled = false;
  PokemonSetV2.deleteOne = (async () => { deleteCalled = true; return {}; }) as any;
  PokemonSetV2.deleteMany = (async () => { deleteCalled = true; return {}; }) as any;

  // --- Caso de Teste 1: Rollback de run não ativo -> aborta com ROLLBACK_TARGET_NOT_ACTIVE ---
  PublicationManifest.findOne = (() => {
    return {
      exec: async () => ({
        publishRunId: 'prod-run-1',
        status: 'rolled-back', // Não está ativo
      })
    };
  }) as any;

  try {
    await rollbackProductionBatch('prod-run-1', mockConnection, { dryRun: false });
    throw new Error('Test 1 failed: Expected ROLLBACK_TARGET_NOT_ACTIVE error');
  } catch (error: any) {
    if (!error.message.includes('ROLLBACK_TARGET_NOT_ACTIVE')) throw error;
  }

  // --- Caso de Teste 2: Rollback restaura previousActivePublishRunId e desativa versão nova ---
  const transitions = [
    { setId: 'set-1', previousPublishRunId: 'prod-run-old', newPublishRunId: 'prod-run-current' }, // com versão anterior
    { setId: 'set-new', previousPublishRunId: null, newPublishRunId: 'prod-run-current' }, // set novo sem versão anterior
  ];

  PublicationManifest.findOne = (() => {
    return {
      exec: async () => ({
        publishRunId: 'prod-run-current',
        status: 'active',
        previousActivePublishRunId: 'prod-run-old',
        setTransitions: transitions,
        save: async function(this: any) { return this; }
      })
    };
  }) as any;

  let updateSetCalls: any[] = [];
  PokemonSetV2.updateOne = (async (query: any, update: any) => {
    updateSetCalls.push({ query, update });
    return {};
  }) as any;

  let updateManifestCalls: any[] = [];
  PublicationManifest.updateOne = (async (query: any, update: any) => {
    updateManifestCalls.push({ query, update });
    return {};
  }) as any;

  const res2 = await rollbackProductionBatch('prod-run-current', mockConnection, { dryRun: false });

  if (res2.status !== 'success') {
    throw new Error('Test 2 failed: Expected rollback success');
  }

  // Verificações estritas do Caso 2
  // A. Não deve ter chamado nenhuma exclusão física no banco
  if (deleteCalled) {
    throw new Error('Test 2 failed: Safety breach! Rollback executed physical delete operations');
  }

  // B. Deve ter desativado as versões da run atual
  const deactivations = updateSetCalls.filter(call => call.update.$set && call.update.$set.active === false);
  if (deactivations.length !== 2) {
    throw new Error(`Test 2 failed: Expected 2 set deactivations, got ${deactivations.length}`);
  }

  // C. Para o set-1 (com versão anterior), deve ter reativado prod-run-old
  const reactivations = updateSetCalls.filter(call => call.update.$set && call.update.$set.active === true);
  if (reactivations.length !== 1 || reactivations[0].query.publishRunId !== 'prod-run-old') {
    throw new Error('Test 2 failed: Expected reactivation of previousPublishRunId "prod-run-old"');
  }

  // D. Para o set-new (sem versão anterior), nenhuma versão ativa deve ter sido reativada
  const reactNew = updateSetCalls.find(call => call.query.setId === 'set-new' && call.update.$set && call.update.$set.active === true);
  if (reactNew) {
    throw new Error('Test 2 failed: Set without previous version was incorrectly activated');
  }

  // E. Manifesto anterior deve ter sido reativado para 'active'
  const manifestReact = updateManifestCalls.find(call => call.query.publishRunId === 'prod-run-old' && call.update.$set.status === 'active');
  if (!manifestReact) {
    throw new Error('Test 2 failed: Previous manifest status was not reactivated to active');
  }

  // --- Caso de Teste 3: Dry-run do rollback ---
  updateSetCalls = [];
  updateManifestCalls = [];
  deleteCalled = false;

  const res3 = await rollbackProductionBatch('prod-run-current', mockConnection, { dryRun: true });
  if (res3.status !== 'success' || updateSetCalls.length > 0 || updateManifestCalls.length > 0 || deleteCalled) {
    throw new Error('Test 3 failed: Dry-run modified database state');
  }

  // Restaurar métodos originais
  PublicationManifest.findOne = originalFindOneManifest;
  PublicationManifest.prototype.save = originalSaveManifest;
  PublicationManifest.updateOne = originalUpdateOneManifest;
  PokemonSetV2.updateOne = originalUpdateOneSet;
  PokemonSetV2.deleteOne = originalDeleteOneSet;
  PokemonSetV2.deleteMany = originalDeleteManySet;

  console.log('[Equinox] Active V2 production rollback validation passed.');
}

runRollbackTests().catch(err => {
  console.error(err);
  process.exit(1);
});
