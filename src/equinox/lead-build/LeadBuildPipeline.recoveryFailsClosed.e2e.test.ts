process.env.EQUINOX_DATA_MODE = 'mongo';

import dotenv from 'dotenv';
dotenv.config();

import { connectIsolatedTestDatabase, IsolatedTestDatabase } from './testing/IsolatedTestDatabase';
import { LeadStrategyRecommendationService } from '../../services/LeadStrategyRecommendationService';
import { AdaptiveStrategyRecovery } from './AdaptiveStrategyRecovery';
import {
  buildTestPokemon,
  createDeterministicPrimarySource,
  createDeterministicRecoverySource,
} from './testing/DeterministicCandidateSources';
import { Pokemon } from '../../models/Pokemon';

let isolatedDatabase: IsolatedTestDatabase | null = null;

async function disposeIsolatedDatabase(): Promise<void> {
  if (!isolatedDatabase) return;
  await isolatedDatabase.dispose();
  isolatedDatabase = null;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

const FORMAT = 'champions_reg_m_b_doubles';
const TARGET_STRATEGY_ID = 'tailwind_rush';

/**
 * Responsabilidade exclusiva deste teste (088-H): provar o fail-closed limpo
 * da estratégia-alvo quando o recovery É executado, ENCONTRA candidatos
 * válidos e utilizáveis, mas nenhum deles satisfaz a capacidade solicitada
 * (`SAFE_SWITCH_IN:Ice` / `TYPE_RESISTANCE:Ice`).
 *
 * Reutiliza o MESMO primary comprovadamente insuficiente de
 * `recoveryRequired` (pool todo fraco a Gelo). A única variável é a página
 * de recovery: aqui ela devolve Iron Hands (Fighting/Electric — neutro a
 * Gelo, não resiste nem é imune), um candidato estruturalmente legítimo
 * (item, ability, nature, moves, set completo) que só não responde ao tipo
 * ofensivo solicitado. Isso é distinto de `recoverySourceExhausted`
 * (fonte vazia) — aqui a fonte tem conteúdo, só não tem resposta.
 *
 * Escopo por estratégia (088-H): não assume que nenhuma outra estratégia
 * seja aceita — verifica apenas a ausência da estratégia-alvo no resultado
 * final e o diagnóstico da estratégia-alvo especificamente.
 */
function seedPrimaryLead(): Promise<unknown> {
  return Pokemon.create([
    {
      dexNumber: 6,
      name: 'Charizard-Mega-Y',
      formatId: FORMAT,
      types: ['Fire', 'Flying'],
      variants: [{ formatId: FORMAT, baseStats: { hp: 78, atk: 104, def: 78, spa: 159, spd: 115, spe: 100 }, types: ['Fire', 'Flying'], abilities: { 0: 'Drought' } }],
      isLegendary: false,
      usageScore: 95,
      formatLegality: { [FORMAT]: true },
    },
    {
      dexNumber: 547,
      name: 'Whimsicott',
      formatId: FORMAT,
      types: ['Grass', 'Fairy'],
      variants: [{ formatId: FORMAT, baseStats: { hp: 60, atk: 67, def: 85, spa: 77, spd: 75, spe: 116 }, types: ['Grass', 'Fairy'], abilities: { 0: 'Prankster' } }],
      isLegendary: false,
      usageScore: 94,
      formatLegality: { [FORMAT]: true },
    },
  ] as any);
}

function buildIceWeakPrimaryCandidates() {
  return [
    buildTestPokemon('Rillaboom', 812, ['Grass'], { hp: 100, atk: 125, def: 90, spa: 60, spd: 70, spe: 85 }),
    buildTestPokemon('Amoonguss', 591, ['Grass', 'Poison'], { hp: 114, atk: 85, def: 70, spa: 85, spd: 80, spe: 30 }),
    buildTestPokemon('Landorus-Therian', 645, ['Ground', 'Flying'], { hp: 89, atk: 145, def: 90, spa: 105, spd: 80, spe: 91 }),
    buildTestPokemon('Dragonite', 149, ['Dragon', 'Flying'], { hp: 91, atk: 134, def: 95, spa: 100, spd: 100, spe: 80 }),
    buildTestPokemon('Garchomp', 445, ['Dragon', 'Ground'], { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 }),
    buildTestPokemon('Tornadus', 641, ['Flying'], { hp: 79, atk: 115, def: 70, spa: 125, spd: 80, spe: 111 }),
  ];
}

/** Válido, coerente, estruturalmente utilizável — só não resiste/é imune a Gelo. */
function buildIceNeutralRecoveryCandidate() {
  return buildTestPokemon('Iron Hands', 992, ['Fighting', 'Electric'], { hp: 154, atk: 140, def: 108, spa: 50, spd: 68, spe: 50 });
}

export async function testRecoveryFailsClosedE2E() {
  isolatedDatabase = await connectIsolatedTestDatabase();
  await seedPrimaryLead();

  const service = new LeadStrategyRecommendationService();
  (service as any).primaryCandidateFetcher = createDeterministicPrimarySource(buildIceWeakPrimaryCandidates());
  const recoverySource = createDeterministicRecoverySource([buildIceNeutralRecoveryCandidate()]);
  (service as any).adaptiveRecovery = new AdaptiveStrategyRecovery(recoverySource);

  const result: any = await service.execute({
    lead: [{ name: 'Charizard-Mega-Y' }, { name: 'Whimsicott' }],
    format: FORMAT,
    leadMode: 'fixed-lead',
    allowLegendaries: false,
    teamIdentity: 'balanced',
  });

  const diagnostics = result.runtimeDiagnostics ?? result.diagnostics;
  const recoveryDiag = diagnostics?.recoveryDiagnostics;
  const targetPerStrategy = (recoveryDiag?.perStrategy ?? []).find(
    (s: any) => s.strategyId === TARGET_STRATEGY_ID,
  );
  const targetStrategyInFinalResult = (result.strategies ?? []).find(
    (s: any) => s.strategy.id === TARGET_STRATEGY_ID,
  );

  console.log('[Telemetria 088-H] targetStrategyId=' + TARGET_STRATEGY_ID
    + ' recoverySourceCallCount=' + recoverySource.callCount
    + ' targetPresentInPerStrategy=' + (targetPerStrategy !== undefined)
    + ' targetCandidatesExamined=' + targetPerStrategy?.candidatesExamined
    + ' targetCandidatesMatched=' + targetPerStrategy?.candidatesMatched
    + ' targetAcceptanceAcceptedCount=' + targetPerStrategy?.acceptanceAcceptedCount
    + ' targetStopReason=' + targetPerStrategy?.stopReason
    + ' targetPresentInFinalResult=' + (targetStrategyInFinalResult !== undefined));

  // targetPerStrategy só existe se a estratégia-alvo entrou em recovery, o
  // que só acontece com primaryAcceptedTeamsForTargetStrategy = 0.
  assert(targetPerStrategy !== undefined, `A estratégia-alvo ${TARGET_STRATEGY_ID} deve ter entrado em recovery (primary insuficiente).`);
  assert(recoverySource.callCount >= 1, 'A página de recovery deve ter sido consultada ao menos uma vez.');
  assert(targetPerStrategy.recoveryExecuted === true, 'O recovery deve ter sido executado (tentado) para a estratégia-alvo.');

  // Candidato válido e utilizável foi de fato examinado — distingue este
  // cenário de uma fonte vazia/exaurida (recoverySourceExhausted).
  assert(targetPerStrategy.candidatesExamined > 0, 'O recovery deve ter examinado ao menos um candidato utilizável (fonte não vazia).');

  assert(targetPerStrategy.candidatesMatched === 0, 'Nenhum candidato deve satisfazer SAFE_SWITCH_IN:Ice — Iron Hands é neutro a Gelo.');
  assert(targetPerStrategy.acceptanceAcceptedCount === 0, 'Nenhum time deve ser aceito via recovery para a estratégia-alvo.');
  assert(targetPerStrategy.stopReason === 'NO_CAPABILITY_MATCH', `stopReason da estratégia-alvo deve ser NO_CAPABILITY_MATCH. Recebido: ${targetPerStrategy.stopReason}`);

  // Granularidade por estratégia (088-H): a ausência é escopada à
  // estratégia-alvo, não ao array `result.strategies` inteiro — outras
  // estratégias podem legitimamente ter sido aceitas via primary.
  assert(targetStrategyInFinalResult === undefined, `A estratégia-alvo ${TARGET_STRATEGY_ID} não deve estar presente no resultado final.`);

  const cleanFailClosed = targetPerStrategy.recoveryExecuted === true
    && targetPerStrategy.acceptanceAcceptedCount === 0
    && targetStrategyInFinalResult === undefined;
  assert(cleanFailClosed, 'O fail-closed da estratégia-alvo deve ser limpo: recovery executado, zero times aceitos, estratégia ausente do resultado final.');
}

if (require.main === module) {
  testRecoveryFailsClosedE2E()
    .then(() => {
      console.log('✅ Recovery fails closed E2E passou com sucesso.');
      process.exitCode = 0;
    })
    .catch(error => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await disposeIsolatedDatabase();
    });
}
