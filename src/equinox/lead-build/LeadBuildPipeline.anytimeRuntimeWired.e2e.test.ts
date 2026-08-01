process.env.EQUINOX_DATA_MODE = 'mongo';

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { connectDatabase } from '../../config/database';
import { LeadStrategyRecommendationService } from '../../services/LeadStrategyRecommendationService';
import { DataSyncService } from '../../services/DataSyncService';
import { Pokemon } from '../../models/Pokemon';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

export async function runAnytimeRuntimeWiredTest() {
  if (mongoose.connection.readyState !== 1) {
    await connectDatabase();
  }

  await DataSyncService.bootstrap();
  await Pokemon.deleteMany({});

  const packPath = path.join(__dirname, '../../equinox/data-packs/sets-data-pack.json');
  const rawPack = JSON.parse(fs.readFileSync(packPath, 'utf-8'));
  const setsList = Array.isArray(rawPack) ? rawPack : (rawPack.sets ?? []);

  const leads = [
    { name: 'Charizard-Mega-Y', formatId: 'champions_reg_m_b_doubles', types: ['fire', 'flying'], item: 'Charizardite Y', ability: 'Drought' },
    { name: 'Whimsicott', formatId: 'champions_reg_m_b_doubles', types: ['grass', 'fairy'], item: 'Focus Sash', ability: 'Prankster' },
  ];

  const leadDocs = leads.map((l, i) => ({
    dexNumber: 10 + i,
    name: l.name,
    formatId: l.formatId,
    types: l.types,
    variants: [{ formatId: 'champions_reg_m_b_doubles', baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, types: l.types, abilities: { 0: l.ability } }],
    stats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
    abilities: { 0: l.ability },
    usageScore: 95,
    formatLegality: { champions_reg_m_b_doubles: true },
    competitiveSet: {
      setId: `${l.name}-set`,
      pokemon: l.name,
      format: 'champions_reg_m_b_doubles',
      item: l.item,
      ability: l.ability,
      nature: 'Timid',
      moves: ['Protect', 'Heat Wave', 'Solar Beam', 'Tailwind'],
    },
  }));

  const packDocs = setsList.slice(0, 35).map((s: any, i: number) => ({
    dexNumber: 1000 + i,
    name: s.pokemonName ?? s.pokemon,
    formatId: 'champions_reg_m_b_doubles',
    types: s.types ?? ['normal'],
    variants: [{ formatId: 'champions_reg_m_b_doubles', baseStats: s.stats ?? { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 }, types: s.types ?? ['normal'], abilities: { 0: s.ability ?? 'Inner Focus' } }],
    stats: s.stats ?? { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 },
    abilities: { 0: s.ability ?? 'Inner Focus' },
    usageScore: 90,
    formatLegality: { champions_reg_m_b_doubles: true },
    competitiveSet: {
      setId: `${s.pokemonName ?? s.pokemon}-set-${i}`,
      pokemon: s.pokemonName ?? s.pokemon,
      format: 'champions_reg_m_b_doubles',
      item: s.item ?? `Item-${i}`,
      ability: s.ability ?? 'Inner Focus',
      nature: s.nature ?? 'Modest',
      moves: s.moves ?? ['Protect', 'Heat Wave', 'Flash Cannon', 'Earth Power'],
    },
  }));

  await Pokemon.create([...leadDocs, ...packDocs]);

  const service = new LeadStrategyRecommendationService();

  console.log('[Test Sprint v1.1.7] Testando integracao de runtime do Anytime Search...');

  const result = await service.execute({
    lead: [
      { name: 'Charizard-Mega-Y' },
      { name: 'Whimsicott' },
    ],
    format: 'champions_reg_m_b_doubles',
    leadMode: 'fixed-lead',
    allowLegendaries: false,
    teamIdentity: 'balanced',
  });

  const diag = result.runtimeDiagnostics ?? {};
  const counters = diag.invocationCounters ?? {};

  console.log('[Test Sprint v1.1.7] Invocations:', counters);

  assert(counters.anytimeCoordinatorInvocationCount === 1, 'AnytimeSearchCoordinator deve ter sido invocado exatamente 1 vez.');
  assert(counters.legacyExpandBeamInvocationCount === 0, 'O feixe legado expandBeam deve ter 0 invocacoes.');
  assert(counters.roundRobinSchedulerInvocationCount === 1, 'StrategyRoundRobinScheduler deve ter sido invocado exatamente 1 vez.');
  assert(counters.firstPassStrategyAttemptCount >= 2, 'firstPassStrategyAttemptCount deve contabilizar tentativas por estrategia.');
  assert(counters.capabilityIndexBuildCount === 1, 'CandidateCapabilityIndex deve ter sido construido exatamente 1 vez.');
  assert(counters.capabilityIndexReuseCount >= 1, 'CandidateCapabilityIndex deve ser reutilizado pelas estrategias elegiveis.');
  assert(counters.acceptedTeamWithoutAcceptanceDecision === 0, 'acceptedTeamWithoutAcceptanceDecision deve ser 0.');
  assert(counters.candidateQueryRawLimit <= 30, 'candidateQueryRawLimit deve ser <= 30.');
  assert(counters.candidateQueryReturnedCount <= 30, 'candidateQueryReturnedCount deve ser <= 30.');
  assert(diag.allEligibleStrategiesReceivedFirstPass === true, 'Todas as estrategias elegiveis devem ter recebido primeira passagem.');
}

if (require.main === module) {
  runAnytimeRuntimeWiredTest()
    .then(async () => {
      await mongoose.disconnect();
      console.log('✅ LeadBuildPipeline.anytimeRuntimeWired.e2e.test PASS');
    })
    .catch(async (err) => {
      console.error('❌ LeadBuildPipeline.anytimeRuntimeWired.e2e.test FAIL:', err);
      await mongoose.disconnect();
      process.exit(1);
    });
}
