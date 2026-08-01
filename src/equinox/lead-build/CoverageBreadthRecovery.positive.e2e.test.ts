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
const RECOVERY_EXCLUSIVE_CANDIDATE_NAME = 'FireElectricMon';

/**
 * Responsabilidade exclusiva (106): provar que COVERAGE_BREADTH produz um
 * time REALMENTE aceito por FullTeamAcceptanceDecision, não só um match do
 * classificador. Lead Kingambit(Dark/Steel)+Tsareena(Grass) gera só
 * `defensive_core` (evita contenção de orçamento global de recovery entre
 * estratégias concorrentes). Pool primário Ghost/Dark: imune a Fighting
 * (neutraliza a fraqueza 4x nativa de Kingambit), mas presente=[Grass,Ghost,
 * Dark,Steel]=4 tipos fica abaixo de minimumCoverageBreadth e o time é
 * defensivamente vulnerável a Fairy (2x via componente Dark) — rejeição por
 * INSUFFICIENT_COVERAGE + NO_DEFENSIVE_SWITCH_IN:Fairy real, não fabricada.
 * Recovery Fire/Electric acrescenta 2 tipos novos (satisfaz COVERAGE_BREADTH)
 * e é o único candidato com SPA>=100 do pool, corrigindo o desequilíbrio
 * físico/especial que travava overallScore< 60 mesmo após a cobertura por
 * tipos ter sido satisfeita.
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
    // Físico/especial equilibrado: mesmo par de tipos, mas spa>=100 em vez
    // de atk -- necessário porque calculateOffensiveBalanceScore penaliza
    // times sem nenhum atacante especial (balancePenalty=25); sem isso o
    // time nunca cruza overallScore>=60 mesmo com cobertura satisfeita.
    buildTestPokemon('GhostDarkMon4', 1004, ['Ghost', 'Dark'], { hp: 80, atk: 70, def: 80, spa: 118, spd: 78, spe: 85 }),
    buildTestPokemon('GhostDarkMon5', 1005, ['Ghost', 'Dark'], { hp: 100, atk: 110, def: 88, spa: 66, spd: 90, spe: 65 }),
    buildTestPokemon('GhostDarkMon6', 1006, ['Ghost', 'Dark'], { hp: 88, atk: 68, def: 90, spa: 114, spd: 82, spe: 78 }),
  ];
}

function buildFireElectricRecoveryCandidate() {
  return buildTestPokemon(RECOVERY_EXCLUSIVE_CANDIDATE_NAME, 2001, ['Fire', 'Electric'], { hp: 90, atk: 100, def: 90, spa: 112, spd: 90, spe: 95 });
}

export async function testCoverageBreadthRecoveryPositiveE2E() {
  isolatedDatabase = await connectIsolatedTestDatabase();
  await seedPrimaryLead();

  const service = new LeadStrategyRecommendationService();
  (service as any).primaryCandidateFetcher = createDeterministicPrimarySource(buildGhostDarkPrimaryCandidates());
  const recoverySource = createDeterministicRecoverySource([buildFireElectricRecoveryCandidate()]);
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

  console.log('[Telemetria 106] targetStrategyId=' + TARGET_STRATEGY_ID
    + ' recoverySourceCallCount=' + recoverySource.callCount
    + ' targetPresentInPerStrategy=' + (targetPerStrategy !== undefined)
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

  assert(targetPerStrategy.candidatesExamined > 0, 'O recovery deve ter examinado ao menos um candidato.');
  assert(targetPerStrategy.candidatesMatched > 0, 'O recovery deve ter encontrado ao menos um candidato que satisfaz COVERAGE_BREADTH.');
  assert(targetPerStrategy.recoveryExecuted === true, 'O recovery deve ter sido executado para a estratégia-alvo.');

  // Núcleo da autorização 106: "o teste só pode declarar sucesso do recovery
  // quando o time final for realmente aceito" -- não basta matched>0.
  assert(targetPerStrategy.acceptanceAcceptedCount > 0, 'O recovery deve ter aceitado genuinamente ao menos um time completo para a estratégia-alvo.');
  assert(targetPerStrategy.stopReason === 'TEAM_ACCEPTED', `stopReason deve ser TEAM_ACCEPTED. Recebido: ${targetPerStrategy.stopReason}`);

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
  testCoverageBreadthRecoveryPositiveE2E()
    .then(() => {
      console.log('✅ Coverage breadth recovery positive E2E test passou.');
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
