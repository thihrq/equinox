process.env.EQUINOX_DATA_MODE = 'mongo';

import dotenv from 'dotenv';
dotenv.config();

import { connectIsolatedTestDatabase, IsolatedTestDatabase } from './testing/IsolatedTestDatabase';
import { LeadStrategyRecommendationService } from '../../services/LeadStrategyRecommendationService';
import { AdaptiveStrategyRecovery } from './AdaptiveStrategyRecovery';
import { buildTestPokemon, createDeterministicPrimarySource, createDeterministicRecoverySource } from './testing/DeterministicCandidateSources';
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
const TARGET_STRATEGY_ID = 'defensive_core';

/**
 * Fail-closed (106): mesmo cenário base do positivo (Kingambit+Tsareena,
 * pool Ghost/Dark, INSUFFICIENT_COVERAGE real -> COVERAGE_BREADTH derivado
 * com minimumAdditionalTypes=2), mas o único candidato de recovery
 * disponível (Fire, monotype) só acrescenta 1 tipo novo -- insuficiente.
 * O classificador deve rejeitar (matched=false), nenhum time deve ser
 * aceito para a estratégia-alvo, e a estratégia deve ficar ausente do
 * resultado final -- sem fabricar sucesso a partir de correspondência
 * parcial.
 */
function seedPrimaryLead(): Promise<unknown> {
  return Pokemon.create([
    {
      dexNumber: 983,
      name: 'Kingambit',
      formatId: FORMAT,
      types: ['Dark', 'Steel'],
      variants: [{ formatId: FORMAT, baseStats: { hp: 100, atk: 135, def: 120, spa: 60, spd: 85, spe: 50 }, types: ['Dark', 'Steel'], abilities: { 0: 'Supreme Overlord' } }],
      isLegendary: false,
      usageScore: 95,
      formatLegality: { [FORMAT]: true },
    },
    {
      dexNumber: 763,
      name: 'Tsareena',
      formatId: FORMAT,
      types: ['Grass'],
      variants: [{ formatId: FORMAT, baseStats: { hp: 72, atk: 120, def: 98, spa: 50, spd: 98, spe: 72 }, types: ['Grass'], abilities: { 0: 'Queenly Majesty' } }],
      isLegendary: false,
      usageScore: 94,
      formatLegality: { [FORMAT]: true },
    },
  ] as any);
}

function buildGhostDarkPrimaryCandidates() {
  return [
    buildTestPokemon('GhostDarkMon1', 1001, ['Ghost', 'Dark'], { hp: 90, atk: 115, def: 90, spa: 70, spd: 85, spe: 75 }),
    buildTestPokemon('GhostDarkMon2', 1002, ['Ghost', 'Dark'], { hp: 85, atk: 112, def: 85, spa: 72, spd: 80, spe: 80 }),
    buildTestPokemon('GhostDarkMon3', 1003, ['Ghost', 'Dark'], { hp: 95, atk: 118, def: 92, spa: 68, spd: 88, spe: 70 }),
    buildTestPokemon('GhostDarkMon4', 1004, ['Ghost', 'Dark'], { hp: 80, atk: 70, def: 80, spa: 118, spd: 78, spe: 85 }),
    buildTestPokemon('GhostDarkMon5', 1005, ['Ghost', 'Dark'], { hp: 100, atk: 110, def: 88, spa: 66, spd: 90, spe: 65 }),
    buildTestPokemon('GhostDarkMon6', 1006, ['Ghost', 'Dark'], { hp: 88, atk: 68, def: 90, spa: 114, spd: 82, spe: 78 }),
  ];
}

function buildInsufficientRecoveryCandidate() {
  // Monotype Water: presente=[Grass,Ghost,Dark,Steel], candidato acrescenta
  // só Water (1 tipo novo) contra minimumAdditionalTypes=2 -- insuficiente
  // por construção (mesma derivação sovereign do cenário positivo). Water
  // (não Fire) é escolhido deliberadamente: o mesmo plano também deriva
  // TYPE_RESISTANCE:Fairy (a estratégia-alvo também é vulnerável a Fairy) e
  // Fire resiste Fairy 0.5x -- combinaria acidentalmente por essa request
  // defensiva coexistente, mascarando o teste de COVERAGE_BREADTH isolado.
  // Water é neutro contra Fairy, então só a request COVERAGE_BREADTH pode
  // corresponder (e não corresponde, por construção).
  return buildTestPokemon('LoneWaterMon', 2002, ['Water'], { hp: 90, atk: 100, def: 90, spa: 112, spd: 90, spe: 95 });
}

export async function testCoverageBreadthRecoveryFailClosedE2E() {
  isolatedDatabase = await connectIsolatedTestDatabase();
  await seedPrimaryLead();

  const service = new LeadStrategyRecommendationService();
  (service as any).primaryCandidateFetcher = createDeterministicPrimarySource(buildGhostDarkPrimaryCandidates());
  const recoverySource = createDeterministicRecoverySource([buildInsufficientRecoveryCandidate()]);
  (service as any).adaptiveRecovery = new AdaptiveStrategyRecovery(recoverySource);

  const result: any = await service.execute({
    lead: [{ name: 'Kingambit' }, { name: 'Tsareena' }],
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

  console.log('[Telemetria 106 fail-closed] targetStrategyId=' + TARGET_STRATEGY_ID
    + ' recoverySourceCallCount=' + recoverySource.callCount
    + ' targetCapabilityRequests=' + JSON.stringify(targetPerStrategy?.capabilityRequests)
    + ' targetCandidatesExamined=' + targetPerStrategy?.candidatesExamined
    + ' targetCandidatesMatched=' + targetPerStrategy?.candidatesMatched
    + ' targetAcceptanceAcceptedCount=' + targetPerStrategy?.acceptanceAcceptedCount
    + ' targetStopReason=' + targetPerStrategy?.stopReason);

  assert(targetPerStrategy !== undefined, `A estratégia-alvo ${TARGET_STRATEGY_ID} deve ter entrado em recovery (primary insuficiente).`);
  assert(recoverySource.callCount >= 1, 'A página de recovery deve ter sido consultada ao menos uma vez.');
  assert(
    (targetPerStrategy.capabilityRequests ?? []).includes('COVERAGE_BREADTH'),
    `A estratégia-alvo deve ter derivado COVERAGE_BREADTH a partir de INSUFFICIENT_COVERAGE real. Recebido: ${JSON.stringify(targetPerStrategy.capabilityRequests)}`,
  );

  assert(targetPerStrategy.candidatesExamined > 0, 'O recovery deve ter examinado o único candidato disponível.');
  assert(targetPerStrategy.candidatesMatched === 0, `Nenhum candidato deve satisfazer COVERAGE_BREADTH (1 tipo novo < minimumAdditionalTypes=2). Recebido: ${targetPerStrategy.candidatesMatched}`);
  assert(targetPerStrategy.acceptedTeams === 0 || targetPerStrategy.acceptanceAcceptedCount === 0, 'Nenhum time deve ser aceito para a estratégia-alvo.');
  assert(targetPerStrategy.stopReason === 'NO_CAPABILITY_MATCH', `stopReason deve ser NO_CAPABILITY_MATCH. Recebido: ${targetPerStrategy.stopReason}`);

  const targetStrategyInFinalResult = (result.strategies ?? []).some(
    (s: any) => s.strategy.id === TARGET_STRATEGY_ID,
  );
  assert(targetStrategyInFinalResult === false, `A estratégia-alvo ${TARGET_STRATEGY_ID} deve estar ausente do resultado final (recovery fail-closed).`);
}

if (require.main === module) {
  testCoverageBreadthRecoveryFailClosedE2E()
    .then(() => {
      console.log('✅ Coverage breadth recovery fail-closed E2E test passou.');
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
