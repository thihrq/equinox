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
const RECOVERY_EXCLUSIVE_CANDIDATE_NAME = 'FireSpecialMon';

/**
 * Reproduz, de forma determinística, o achado real de produção (lead
 * Charizard-Mega-Y+Whimsicott, champions_reg_m_b_doubles, requestId
 * 5838cc75-...): times completos rejeitados com DefensiveQuality,
 * RoleCoverage e OffensiveQuality individualmente válidos — só o
 * `overallScore` ponderado abaixo de 60 — e, antes deste fix, ZERO
 * capability requests derivadas (`NO_CAPABILITY_REQUESTS_DERIVED`),
 * deixando o recovery estruturalmente incapaz de agir mesmo com um
 * candidato real disponível que resolveria exatamente o déficit.
 *
 * Pool primário: Kingambit+Tsareena (lead) + 6x Ghost/Dark todos
 * fisicamente fortes, SEM nenhum atacante especial — derruba
 * `offensiveBalanceScore` a 0 (penalidade severa por ausência total de
 * atacante especial em `calculateOffensiveBalanceScore`) sem derrubar
 * `RoleCoverage`(76) nem `OffensiveQuality`(válido) isoladamente.
 * `defensiveCoverageScore`/`highestExposureType=Fairy` também falha
 * (Ghost/Dark é 2x fraco a Fairy via o componente Dark), então o mesmo
 * plano tem SAFE_SWITCH_IN:Fairy/TYPE_RESISTANCE:Fairy coexistindo com
 * COVERAGE_BREADTH — replicando a coexistência de múltiplos requests já
 * validada em 106.
 *
 * Candidato de recovery: Fire/Electric com SPA alto, sem fraqueza a Fairy
 * (corrige a exposição defensiva) e adicionando 2 tipos novos (corrige
 * `offensiveBalanceScore` via a nova metadata `OVERALL_SCORE_BELOW_THRESHOLD`
 * → weakestDimension='offensiveBalance' → COVERAGE_BREADTH).
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

function buildAllPhysicalGhostDarkPrimaryCandidates() {
  return [
    buildTestPokemon('GhostDarkMon1', 1001, ['Ghost', 'Dark'], { hp: 95, atk: 130, def: 100, spa: 60, spd: 90, spe: 85 }),
    buildTestPokemon('GhostDarkMon2', 1002, ['Ghost', 'Dark'], { hp: 90, atk: 125, def: 95, spa: 55, spd: 85, spe: 90 }),
    buildTestPokemon('GhostDarkMon3', 1003, ['Ghost', 'Dark'], { hp: 100, atk: 128, def: 98, spa: 58, spd: 92, spe: 78 }),
    // Segundo atacante naturalmente rápido (spe>=100) -- junto com o
    // candidato de recovery, satisfaz o bônus de +10 em
    // calculateSpeedControlScore (fastPokemon>=2), necessário além da
    // correção de offensiveBalance para cruzar o corte de 60.
    buildTestPokemon('GhostDarkMon4', 1004, ['Ghost', 'Dark'], { hp: 88, atk: 132, def: 92, spa: 52, spd: 82, spe: 105 }),
    buildTestPokemon('GhostDarkMon5', 1005, ['Ghost', 'Dark'], { hp: 105, atk: 122, def: 100, spa: 50, spd: 95, spe: 70 }),
    buildTestPokemon('GhostDarkMon6', 1006, ['Ghost', 'Dark'], { hp: 92, atk: 126, def: 96, spa: 56, spd: 88, spe: 82 }),
  ];
}

function buildFireSpecialRecoveryCandidate() {
  return buildTestPokemon(RECOVERY_EXCLUSIVE_CANDIDATE_NAME, 2001, ['Fire', 'Electric'], { hp: 90, atk: 60, def: 90, spa: 135, spd: 95, spe: 100 });
}

export async function testOverallScoreDeficitRecoveryPositiveE2E() {
  isolatedDatabase = await connectIsolatedTestDatabase();
  await seedPrimaryLead();

  const service = new LeadStrategyRecommendationService();
  (service as any).primaryCandidateFetcher = createDeterministicPrimarySource(buildAllPhysicalGhostDarkPrimaryCandidates());
  const recoverySource = createDeterministicRecoverySource([buildFireSpecialRecoveryCandidate()]);
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

  console.log('[Telemetria OverallScoreDeficit] targetStrategyId=' + TARGET_STRATEGY_ID
    + ' recoverySourceCallCount=' + recoverySource.callCount
    + ' targetPresentInPerStrategy=' + (targetPerStrategy !== undefined)
    + ' targetCapabilityRequests=' + JSON.stringify(targetPerStrategy?.capabilityRequests)
    + ' targetCandidatesMatched=' + targetPerStrategy?.candidatesMatched
    + ' targetAcceptanceAcceptedCount=' + targetPerStrategy?.acceptanceAcceptedCount
    + ' targetStopReason=' + targetPerStrategy?.stopReason);

  // Núcleo do achado: antes deste fix, esta request nunca existia porque
  // OVERALL_SCORE_BELOW_THRESHOLD não tinha branch nenhum no planner.
  assert(targetPerStrategy !== undefined, `A estratégia-alvo ${TARGET_STRATEGY_ID} deve ter entrado em recovery.`);
  assert(
    (targetPerStrategy.capabilityRequests ?? []).includes('COVERAGE_BREADTH'),
    `Deve derivar COVERAGE_BREADTH a partir de OVERALL_SCORE_BELOW_THRESHOLD (weakestDimension=offensiveBalance). Recebido: ${JSON.stringify(targetPerStrategy.capabilityRequests)}`,
  );
  assert(targetPerStrategy.candidatesMatched > 0, 'O candidato de recovery deve casar com a capability derivada.');

  // Garantia central: sucesso só é declarado com aceitação REAL, não só match.
  assert(targetPerStrategy.acceptanceAcceptedCount > 0, 'O recovery deve ter aceitado genuinamente ao menos um time completo.');
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
  testOverallScoreDeficitRecoveryPositiveE2E()
    .then(() => {
      console.log('✅ Overall score deficit recovery positive E2E test passou.');
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
