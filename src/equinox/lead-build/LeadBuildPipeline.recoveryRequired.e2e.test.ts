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
const RECOVERY_EXCLUSIVE_CANDIDATE_NAME = 'Heatran';

/**
 * Responsabilidade exclusiva deste teste (088-H): provar que o resultado
 * ACEITO da estratégia-alvo só existe porque o recovery disponibilizou um
 * candidato exclusivo. Reutiliza o cenário Ice/Heatran já comprovado (088-G,
 * probe determinístico) — a busca primária (candidatos todos fracos a Gelo)
 * rejeita times completos de `tailwind_rush` por
 * `NO_DEFENSIVE_SWITCH_IN`/`UNANSWERED_REPEATED_WEAKNESS` do tipo Ice; o
 * planner deriva `SAFE_SWITCH_IN:Ice`; só Heatran (Steel/Fire, resiste Gelo
 * em 4x, ausente do primary) satisfaz essa capacidade.
 *
 * Não assume que as outras estratégias (`sun_offense`, `defensive_core`)
 * também precisem falhar no primary — cada asserção abaixo é escopada à
 * estratégia-alvo via `recoveryDiagnostics.perStrategy` e
 * `result.strategies.find(s => s.strategy.id === TARGET_STRATEGY_ID)`, não
 * ao array inteiro (achado 088-G/088-H: recovery é por estratégia).
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

function buildHeatranRecoveryCandidate() {
  return buildTestPokemon(RECOVERY_EXCLUSIVE_CANDIDATE_NAME, 485, ['Steel', 'Fire'], { hp: 91, atk: 90, def: 106, spa: 130, spd: 106, spe: 77 });
}

export async function testRecoveryRequiredE2E() {
  isolatedDatabase = await connectIsolatedTestDatabase();
  await seedPrimaryLead();

  const service = new LeadStrategyRecommendationService();
  (service as any).primaryCandidateFetcher = createDeterministicPrimarySource(buildIceWeakPrimaryCandidates());
  const recoverySource = createDeterministicRecoverySource([buildHeatranRecoveryCandidate()]);
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

  console.log('[Telemetria 088-H] targetStrategyId=' + TARGET_STRATEGY_ID
    + ' recoverySourceCallCount=' + recoverySource.callCount
    + ' targetPresentInPerStrategy=' + (targetPerStrategy !== undefined)
    + ' targetCapabilityRequests=' + JSON.stringify(targetPerStrategy?.capabilityRequests)
    + ' targetCandidatesMatched=' + targetPerStrategy?.candidatesMatched
    + ' targetAcceptanceAcceptedCount=' + targetPerStrategy?.acceptanceAcceptedCount
    + ' targetRecoveryExecuted=' + targetPerStrategy?.recoveryExecuted);

  // targetPerStrategy só existe se `buildRecoveryTasks` a processou, o que só
  // acontece quando `primary.accepted.length === 0` para essa estratégia —
  // prova, por construção, que primaryAcceptedTeamsForTargetStrategy = 0.
  assert(targetPerStrategy !== undefined, `A estratégia-alvo ${TARGET_STRATEGY_ID} deve ter entrado em recovery (primary insuficiente).`);
  assert(recoverySource.callCount >= 1, 'A página de recovery deve ter sido consultada ao menos uma vez.');

  // Prova da cadeia causal completa: só existe capability request tipada
  // SAFE_SWITCH_IN:Ice se um time COMPLETO da estratégia-alvo foi construído,
  // avaliado e rejeitado por NO_DEFENSIVE_SWITCH_IN/UNANSWERED_REPEATED_WEAKNESS
  // do tipo Ice (RecoveryCapabilityPlanner só deriva essa request tipada a
  // partir desses reason codes específicos) — cobre, sem depender de logs de
  // console, tanto "primaryCompleteTeamsBuilt > 0" quanto "primaryFailures
  // contain NO_DEFENSIVE_SWITCH_IN:Ice ou UNANSWERED_REPEATED_WEAKNESS:Ice".
  assert(
    (targetPerStrategy.capabilityRequests ?? []).includes('SAFE_SWITCH_IN:Ice'),
    `A estratégia-alvo deve ter derivado SAFE_SWITCH_IN:Ice a partir da rejeição defensiva real. Recebido: ${JSON.stringify(targetPerStrategy.capabilityRequests)}`,
  );

  assert(targetPerStrategy.recoveryExecuted === true, 'O recovery deve ter sido executado para a estratégia-alvo.');
  assert(targetPerStrategy.candidatesMatched > 0, 'O recovery deve ter encontrado ao menos um candidato que satisfaz SAFE_SWITCH_IN:Ice.');
  assert(targetPerStrategy.acceptanceAcceptedCount > 0, 'O recovery deve ter aceitado ao menos um time completo para a estratégia-alvo.');

  const recoveredStrategy = result.strategies.find(
    (s: any) =>
      s.strategy.id === TARGET_STRATEGY_ID &&
      s.recoveryState?.executed === true &&
      s.completions.some((completion: any) =>
        (completion.fullTeam ?? []).some((member: any) => member.name === RECOVERY_EXCLUSIVE_CANDIDATE_NAME),
      ),
  );

  assert(recoveredStrategy !== undefined, `A estratégia-alvo ${TARGET_STRATEGY_ID} deve estar presente no resultado final, aceita via recovery, contendo ${RECOVERY_EXCLUSIVE_CANDIDATE_NAME}.`);
  assert(recoveredStrategy.teamEvaluation?.legal === true, 'O time aceito deve passar no gate de legalidade.');
  assert(recoveredStrategy.teamEvaluation?.strategyComplete === true, 'O time aceito deve ter a estratégia completa.');

  const fullTeam = recoveredStrategy.completions[0]?.fullTeam ?? [];
  assert(Array.isArray(fullTeam) && fullTeam.length === 6, 'O time final aceito deve possuir exatamente 6 Pokémon.');
}

if (require.main === module) {
  testRecoveryRequiredE2E()
    .then(() => {
      console.log('✅ Recovery required E2E test passou.');
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
