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

/**
 * Cenário determinístico definitivo (088-B → 088-G).
 *
 * Fonte PRIMÁRIA: Charizard-Mega-Y + Whimsicott (lead) + 6 candidatos reais,
 * todos fracos a Gelo (Rillaboom, Amoonguss, Landorus-Therian, Dragonite,
 * Garchomp, Tornadus) — nenhum resiste ou é imune. Isso produz, de forma
 * legítima (sem dado incoerente), `UNANSWERED_REPEATED_WEAKNESS`/
 * `NO_DEFENSIVE_SWITCH_IN` para o tipo Ice em `evaluateDefensiveQuality`
 * (confirmado em 088-E). A causa de essa rejeição não chegar ao recovery
 * era um bug de transporte (088-F: `PrimaryStrategySearch` só lia
 * `acceptedTeams`, nunca `rejectedTeams`), corrigido em 088-G.
 *
 * Fonte de RECOVERY: só Heatran (Steel/Fire), que resiste Gelo em 4x — o
 * único candidato do cenário capaz de satisfazer `SAFE_SWITCH_IN:Ice` /
 * `TYPE_RESISTANCE:Ice`, e ausente da fonte primária.
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
  return buildTestPokemon('Heatran', 485, ['Steel', 'Fire'], { hp: 91, atk: 90, def: 106, spa: 130, spd: 106, spe: 77 });
}

export async function testRecoveryReachableE2E() {
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

  console.log('[Telemetria 088-G] primarySourceCallCount(fetcher)=n/a(determinístico) recoveryFetchCallCount=' + recoverySource.callCount
    + ' recoveryEligibleAny=' + recoveryDiag?.recoveryEligibleAny
    + ' recoveryExecutedAny=' + recoveryDiag?.recoveryExecutedAny
    + ' acceptedTeamsTotal=' + recoveryDiag?.acceptedTeamsTotal
    + ' finalStrategiesReturned=' + result.strategies?.length);

  assert(diagnostics !== undefined, 'Deve retornar runtimeDiagnostics.');
  assert(recoverySource.callCount >= 1, 'A página de recovery deve ter sido consultada ao menos uma vez.');
  assert(diagnostics.recoveryExecuted === true, 'Recovery deve ter sido executado.');
  assert(recoveryDiag?.recoveryExecutedAny === true, 'recoveryDiagnostics.recoveryExecutedAny deve ser true.');
  assert(diagnostics.recoveryTimeAvailableAtStartMs >= 2000, `Recovery deve ter tido tempo disponível >= 2.000ms. Atual: ${diagnostics.recoveryTimeAvailableAtStartMs}ms`);

  // Prova de que a request derivada da rejeição preserva o tipo ofensivo real.
  const perStrategy = recoveryDiag?.perStrategy ?? [];
  const anyIceRequest = perStrategy.some((s: any) => (s.capabilityRequests ?? []).includes('SAFE_SWITCH_IN:Ice'));
  assert(anyIceRequest, 'Ao menos uma estratégia deve ter derivado a request SAFE_SWITCH_IN:Ice a partir da rejeição defensiva real.');

  assert(result.strategies.length >= 1, 'Deve haver ao menos 1 estratégia aceita via recovery.');
  const recoveredStrategy = result.strategies.find(
    (s: any) => s.recoveryState?.executed === true && s.completions?.length > 0,
  );
  assert(recoveredStrategy !== undefined, 'Estratégia recuperada deve estar presente no resultado.');
  const fullTeam = recoveredStrategy.completions[0]?.fullTeam ?? [];
  assert(
    fullTeam.some((member: any) => member.name === 'Heatran'),
    'O time aceito deve conter o candidato exclusivo da página de recovery (Heatran).',
  );
  assert(recoveredStrategy.teamEvaluation?.legal === true, 'O time aceito deve passar no gate de legalidade.');
}

if (require.main === module) {
  testRecoveryReachableE2E()
    .then(() => {
      console.log('✅ Recovery reachable E2E test passou.');
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
