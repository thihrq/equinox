process.env.EQUINOX_DATA_MODE = 'mongo';

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import {
  assertSafeTestDatabase,
  connectIsolatedTestDatabase,
  IsolatedTestDatabase,
} from './testing/IsolatedTestDatabase';
import { Pokemon } from '../../models/Pokemon';
import { ProgressiveCandidateFetcher } from '../recommendation/ProgressiveCandidateFetcher';
import { createLeadBuildRequestContext } from './LeadBuildRequestContext';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

let isolatedDatabase: IsolatedTestDatabase | null = null;

/**
 * Limpa a coleção entre casos.
 *
 * O filtro vazio só é seguro porque o alvo é um banco criado por esta execução
 * — a asserção é reavaliada a cada chamada, e não uma única vez na conexão,
 * para que nenhum caso possa apagar dados de um banco compartilhado caso a
 * conexão mude no meio da suíte.
 */
async function resetPokemonCollection(): Promise<void> {
  if (!isolatedDatabase) {
    throw new Error('ISOLATED_TEST_DATABASE_NOT_INITIALIZED');
  }
  assertSafeTestDatabase(isolatedDatabase.connection);
  await Pokemon.deleteMany({});
}

export async function runProgressiveCandidateFetcherAll10Tests() {
  isolatedDatabase = await connectIsolatedTestDatabase();
  console.log(`[Isolamento] Banco de teste efêmero: ${isolatedDatabase.databaseName}`);

  const fetcher = new ProgressiveCandidateFetcher();

  // =========================================================================
  // CASO 1 — STARVATION REPRODUZIDA E RESOLVIDA PROGRESSIVAMENTE
  // =========================================================================
  console.log('\n--- CASO 1: Starvation Reproduzida e Resolvida Progressivamente ---');
  await resetPokemonCollection();

  const invalidDocsCase1 = [];
  for (let i = 1; i <= 28; i++) {
    invalidDocsCase1.push({
      dexNumber: i,
      name: `IneligibleMon-${i}`,
      formatId: 'other_format',
      types: ['normal'],
      variants: [{ formatId: 'other_format', baseStats: { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 }, types: ['normal'], abilities: { 0: 'Run Away' } }],
      stats: { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 },
      abilities: { 0: 'Run Away' },
      usageScore: 99,
      formatLegality: { champions_reg_m_b_doubles: false },
    });
  }

  const leadDocsCase1 = [
    {
      dexNumber: 29,
      name: 'Charizard-Mega-Y',
      formatId: 'champions_reg_m_b_doubles',
      types: ['fire', 'flying'],
      variants: [{ formatId: 'champions_reg_m_b_doubles', baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, types: ['fire', 'flying'], abilities: { 0: 'Drought' } }],
      stats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
      abilities: { 0: 'Drought' },
      usageScore: 95,
      formatLegality: { champions_reg_m_b_doubles: true },
      competitiveSet: { setId: 'c1', pokemon: 'Charizard-Mega-Y', format: 'champions_reg_m_b_doubles', item: 'Charizardite Y', ability: 'Drought', nature: 'Timid', moves: ['Protect'] },
    },
    {
      dexNumber: 30,
      name: 'Whimsicott',
      formatId: 'champions_reg_m_b_doubles',
      types: ['grass', 'fairy'],
      variants: [{ formatId: 'champions_reg_m_b_doubles', baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, types: ['grass', 'fairy'], abilities: { 0: 'Prankster' } }],
      stats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
      abilities: { 0: 'Prankster' },
      usageScore: 94,
      formatLegality: { champions_reg_m_b_doubles: true },
      competitiveSet: { setId: 'c2', pokemon: 'Whimsicott', format: 'champions_reg_m_b_doubles', item: 'Focus Sash', ability: 'Prankster', nature: 'Timid', moves: ['Tailwind'] },
    },
  ];

  const validDocsCase1 = [];
  const validNames = [
    'Heatran', 'Rillaboom', 'Urshifu-Rapid-Strike', 'Landorus-Therian', 'Ogerpon-Hearthflame',
    'Flutter Mane', 'Chi-Yu', 'Chien-Pao', 'Ting-Lu', 'Wo-Chien',
    'Gholdengo', 'Amoonguss', 'Incineroar', 'Kingambit', 'Tornadus',
    'Enamorus', 'Iron Bundle', 'Iron Hands', 'Iron Jugulis', 'Iron Moth',
    'Iron Thorns', 'Iron Valiant', 'Iron Leaves', 'Walking Wake',
    'Dragonite', 'Garchomp', 'Basculegion', 'Archaludon', 'Pelipper', 'Ludicolo'
  ];

  for (let i = 0; i < validNames.length; i++) {
    const name = validNames[i];
    validDocsCase1.push({
      dexNumber: 31 + i,
      name,
      formatId: 'champions_reg_m_b_doubles',
      types: ['fire', 'steel'],
      variants: [{ formatId: 'champions_reg_m_b_doubles', baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, types: ['fire', 'steel'], abilities: { 0: 'Flash Fire' } }],
      stats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
      abilities: { 0: 'Flash Fire' },
      usageScore: 90 - i,
      formatLegality: { champions_reg_m_b_doubles: true },
      competitiveSet: { setId: `set-${i}`, pokemon: name, format: 'champions_reg_m_b_doubles', item: `Item-${i}`, ability: 'Flash Fire', nature: 'Modest', moves: ['Protect'] },
    });
  }

  await Pokemon.create([...invalidDocsCase1, ...leadDocsCase1, ...validDocsCase1]);
  console.log('[Caso 1] Documentos salvos no DB:', await Pokemon.countDocuments());

  const reqCtx1 = createLeadBuildRequestContext('req-c1');
  const res1 = await fetcher.fetchProgressiveCandidates({
    leadNames: ['Charizard-Mega-Y', 'Whimsicott'],
    baseTeam: [],
    format: 'champions_reg_m_b_doubles',
    allowLegendaries: false,
    targetUsableCount: 24,
    rawPageSize: 30,
    requestContext: reqCtx1,
  });

  console.log('[Caso 1] Telemetria:', res1.telemetry);
  assert(res1.telemetry.candidateQueryCount >= 2, 'Caso 1: candidateQueryCount deve ser >= 2.');
  assert(res1.telemetry.candidateDocumentsExaminedTotal > 30, 'Caso 1: candidateDocumentsExaminedTotal deve ser > 30.');
  assert(res1.telemetry.candidateUsableAccumulatedCount >= 24, 'Caso 1: cota >= 24 atingida.');
  assert(res1.telemetry.candidateFetchStopReason === 'USABLE_QUOTA_REACHED', 'Caso 1: stopReason deve ser USABLE_QUOTA_REACHED.');
  console.log('✅ CASO 1 PASS');

  // =========================================================================
  // CASO 2 — PRIMEIRA PÁGINA SUFICIENTE
  // =========================================================================
  console.log('\n--- CASO 2: Primeira Página Suficiente ---');
  await resetPokemonCollection();

  const validDocsCase2 = [];
  for (let i = 0; i < 30; i++) {
    const name = `ValidMon-${i}`;
    validDocsCase2.push({
      dexNumber: 100 + i,
      name,
      formatId: 'champions_reg_m_b_doubles',
      types: ['water', 'dragon'],
      variants: [{ formatId: 'champions_reg_m_b_doubles', baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, types: ['water', 'dragon'], abilities: { 0: 'Swift Swim' } }],
      stats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
      abilities: { 0: 'Swift Swim' },
      usageScore: 100 - i,
      formatLegality: { champions_reg_m_b_doubles: true },
      competitiveSet: { setId: `set2-${i}`, pokemon: name, format: 'champions_reg_m_b_doubles', item: `Item2-${i}`, ability: 'Swift Swim', nature: 'Modest', moves: ['Protect'] },
    });
  }

  await Pokemon.create(validDocsCase2);

  const reqCtx2 = createLeadBuildRequestContext('req-c2');
  const res2 = await fetcher.fetchProgressiveCandidates({
    leadNames: ['Pelipper', 'Archaludon'],
    baseTeam: [],
    format: 'champions_reg_m_b_doubles',
    allowLegendaries: false,
    targetUsableCount: 24,
    rawPageSize: 30,
    requestContext: reqCtx2,
  });

  console.log('[Caso 2] Telemetria:', res2.telemetry);
  assert(res2.telemetry.candidateQueryCount === 1, 'Caso 2: candidateQueryCount deve ser 1.');
  assert(res2.telemetry.candidateUsableAccumulatedCount >= 24, 'Caso 2: cota >= 24.');
  console.log('✅ CASO 2 PASS');

  // =========================================================================
  // CASO 3 — FONTE INSUFICIENTE
  // =========================================================================
  console.log('\n--- CASO 3: Fonte Insuficiente ---');
  await resetPokemonCollection();

  const validDocsCase3 = [];
  for (let i = 0; i < 10; i++) {
    const name = `ScarceMon-${i}`;
    validDocsCase3.push({
      dexNumber: 200 + i,
      name,
      formatId: 'champions_reg_m_b_doubles',
      types: ['psychic', 'fairy'],
      variants: [{ formatId: 'champions_reg_m_b_doubles', baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, types: ['psychic', 'fairy'], abilities: { 0: 'Psychic Surge' } }],
      stats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
      abilities: { 0: 'Psychic Surge' },
      usageScore: 80 - i,
      formatLegality: { champions_reg_m_b_doubles: true },
      competitiveSet: { setId: `set3-${i}`, pokemon: name, format: 'champions_reg_m_b_doubles', item: `Item3-${i}`, ability: 'Psychic Surge', nature: 'Modest', moves: ['Protect'] },
    });
  }

  await Pokemon.create(validDocsCase3);

  const reqCtx3 = createLeadBuildRequestContext('req-c3');
  const res3 = await fetcher.fetchProgressiveCandidates({
    leadNames: ['Indeedee-F', 'Hatterene'],
    baseTeam: [],
    format: 'champions_reg_m_b_doubles',
    allowLegendaries: false,
    targetUsableCount: 24,
    rawPageSize: 30,
    requestContext: reqCtx3,
  });

  console.log('[Caso 3] Telemetria:', res3.telemetry);
  assert(res3.telemetry.candidateFetchStopReason === 'SOURCE_EXHAUSTED', 'Caso 3: stopReason deve ser SOURCE_EXHAUSTED.');
  assert(res3.telemetry.candidateUsableAccumulatedCount === 10, 'Caso 3: acumula os 10 disponiveis.');
  console.log('✅ CASO 3 PASS');

  // =========================================================================
  // CASO 4 — DEADLINE MONOTÔNICO POR FASE
  // =========================================================================
  console.log('\n--- CASO 4: Deadline Monotônico ---');
  let simulatedTime = 1000;
  const deadlineAt = 1050;

  const reqCtx4 = createLeadBuildRequestContext('req-c4');
  const res4 = await fetcher.fetchProgressiveCandidates({
    leadNames: ['Tyranitar', 'Excadrill'],
    baseTeam: [],
    format: 'champions_reg_m_b_doubles',
    allowLegendaries: false,
    targetUsableCount: 24,
    rawPageSize: 30,
    candidateFetchDeadlineAtMs: deadlineAt,
    nowMs: () => {
      simulatedTime += 60;
      return simulatedTime;
    },
    requestContext: reqCtx4,
  });

  console.log('[Caso 4] Telemetria:', res4.telemetry);
  assert(res4.telemetry.candidateFetchStopReason === 'DEADLINE_REACHED', 'Caso 4: stopReason deve ser DEADLINE_REACHED.');
  console.log('✅ CASO 4 PASS');

  // =========================================================================
  // CASO 5 — LIMITE DE SEGURANÇA (SCAN CAP)
  // =========================================================================
  console.log('\n--- CASO 5: Limite de Segurança (Scan Cap) ---');
  await resetPokemonCollection();

  const invalidDocsCase5 = [];
  for (let i = 1; i <= 350; i++) {
    invalidDocsCase5.push({
      dexNumber: 1000 + i,
      name: `CapIneligibleMon-${i}`,
      formatId: 'banned_format',
      types: ['normal'],
      variants: [{ formatId: 'banned_format', baseStats: { hp: 10, atk: 10, def: 10, spa: 10, spd: 10, spe: 10 }, types: ['normal'], abilities: { 0: 'None' } }],
      stats: { hp: 10, atk: 10, def: 10, spa: 10, spd: 10, spe: 10 },
      abilities: { 0: 'None' },
      usageScore: 50,
      formatLegality: { champions_reg_m_b_doubles: false },
    });
  }

  await Pokemon.create(invalidDocsCase5);

  const reqCtx5 = createLeadBuildRequestContext('req-c5');
  const res5 = await fetcher.fetchProgressiveCandidates({
    leadNames: ['Aggron-Mega', 'Sinistcha'],
    baseTeam: [],
    format: 'champions_reg_m_b_doubles',
    allowLegendaries: false,
    targetUsableCount: 24,
    rawPageSize: 30,
    maxDocumentsExamined: 300,
    requestContext: reqCtx5,
  });

  console.log('[Caso 5] Telemetria:', res5.telemetry);
  assert(res5.telemetry.candidateFetchStopReason === 'SCAN_CAP_REACHED', 'Caso 5: stopReason deve ser SCAN_CAP_REACHED.');
  assert(res5.telemetry.candidateDocumentsExaminedTotal <= 300, 'Caso 5: cap 300 respeitado.');
  console.log('✅ CASO 5 PASS');

  // =========================================================================
  // CASO 6 — LEXICOGRAPHICAL COMPOSITE CURSOR ORDERING
  // =========================================================================
  console.log('\n--- CASO 6: Lexicographical Composite Cursor Ordering ---');
  await resetPokemonCollection();

  const docA = new Pokemon({ dexNumber: 10, name: 'LexMon-A', formatId: 'champions_reg_m_b_doubles', types: ['fire'], variants: [{ formatId: 'champions_reg_m_b_doubles', baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, types: ['fire'], abilities: { 0: 'Blaze' } }], stats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, abilities: { 0: 'Blaze' }, usageScore: 100, formatLegality: { champions_reg_m_b_doubles: true }, competitiveSet: { setId: 'sA', pokemon: 'LexMon-A', format: 'champions_reg_m_b_doubles', item: 'ItemA', ability: 'Blaze', nature: 'Modest', moves: ['Protect'] } });
  const docB = new Pokemon({ dexNumber: 20, name: 'LexMon-B', formatId: 'champions_reg_m_b_doubles', types: ['water'], variants: [{ formatId: 'champions_reg_m_b_doubles', baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, types: ['water'], abilities: { 0: 'Torrent' } }], stats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, abilities: { 0: 'Torrent' }, usageScore: 95, formatLegality: { champions_reg_m_b_doubles: true }, competitiveSet: { setId: 'sB', pokemon: 'LexMon-B', format: 'champions_reg_m_b_doubles', item: 'ItemB', ability: 'Torrent', nature: 'Modest', moves: ['Protect'] } });
  const docC = new Pokemon({ dexNumber: 30, name: 'LexMon-C', formatId: 'champions_reg_m_b_doubles', types: ['grass'], variants: [{ formatId: 'champions_reg_m_b_doubles', baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, types: ['grass'], abilities: { 0: 'Overgrow' } }], stats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, abilities: { 0: 'Overgrow' }, usageScore: 90, formatLegality: { champions_reg_m_b_doubles: true }, competitiveSet: { setId: 'sC', pokemon: 'LexMon-C', format: 'champions_reg_m_b_doubles', item: 'ItemC', ability: 'Overgrow', nature: 'Modest', moves: ['Protect'] } });
  const docD = new Pokemon({ dexNumber: 40, name: 'LexMon-D', formatId: 'champions_reg_m_b_doubles', types: ['electric'], variants: [{ formatId: 'champions_reg_m_b_doubles', baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, types: ['electric'], abilities: { 0: 'Static' } }], stats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, abilities: { 0: 'Static' }, usageScore: 85, formatLegality: { champions_reg_m_b_doubles: true }, competitiveSet: { setId: 'sD', pokemon: 'LexMon-D', format: 'champions_reg_m_b_doubles', item: 'ItemD', ability: 'Static', nature: 'Modest', moves: ['Protect'] } });

  await Pokemon.create([docA, docB, docC, docD]);

  const reqCtx6 = createLeadBuildRequestContext('req-c6');
  const res6 = await fetcher.fetchProgressiveCandidates({
    leadNames: ['Unown', 'Magikarp'],
    baseTeam: [],
    format: 'champions_reg_m_b_doubles',
    allowLegendaries: false,
    targetUsableCount: 4,
    rawPageSize: 2,
    requestContext: reqCtx6,
  });

  const returnedNames = res6.usableCandidates.map(c => c.name);
  console.log('[Caso 6] Nomes retornados:', returnedNames);
  assert(res6.telemetry.candidateQueryCount === 2, 'Caso 6: deve realizar 2 consultas paginadas de 2 itens.');
  assert(returnedNames.length === 4, 'Caso 6: deve retornar exatamente os 4 candidatos.');
  assert(returnedNames[0] === 'LexMon-A', 'Caso 6: LexMon-A');
  assert(returnedNames[1] === 'LexMon-B', 'Caso 6: LexMon-B');
  assert(returnedNames[2] === 'LexMon-C', 'Caso 6: LexMon-C');
  assert(returnedNames[3] === 'LexMon-D', 'Caso 6: LexMon-D');
  console.log('✅ CASO 6 PASS');

  // =========================================================================
  // CASO 7 — DUPLICATE SORT VALUES (DESEMPATES)
  // =========================================================================
  console.log('\n--- CASO 7: Duplicate Sort Values (Desempates) ---');
  await resetPokemonCollection();

  const tie1 = new Pokemon({ dexNumber: 10, name: 'TieMon-1', formatId: 'champions_reg_m_b_doubles', types: ['normal'], variants: [{ formatId: 'champions_reg_m_b_doubles', baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, types: ['normal'], abilities: { 0: 'Adaptability' } }], stats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, abilities: { 0: 'Adaptability' }, usageScore: 90, formatLegality: { champions_reg_m_b_doubles: true }, competitiveSet: { setId: 't1', pokemon: 'TieMon-1', format: 'champions_reg_m_b_doubles', item: 'ItemT1', ability: 'Adaptability', nature: 'Modest', moves: ['Protect'] } });
  const tie2 = new Pokemon({ dexNumber: 20, name: 'TieMon-2', formatId: 'champions_reg_m_b_doubles', types: ['normal'], variants: [{ formatId: 'champions_reg_m_b_doubles', baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, types: ['normal'], abilities: { 0: 'Adaptability' } }], stats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, abilities: { 0: 'Adaptability' }, usageScore: 90, formatLegality: { champions_reg_m_b_doubles: true }, competitiveSet: { setId: 't2', pokemon: 'TieMon-2', format: 'champions_reg_m_b_doubles', item: 'ItemT2', ability: 'Adaptability', nature: 'Modest', moves: ['Protect'] } });

  await Pokemon.create([tie1, tie2]);

  const reqCtx7 = createLeadBuildRequestContext('req-c7');
  const res7 = await fetcher.fetchProgressiveCandidates({
    leadNames: ['Unown', 'Magikarp'],
    baseTeam: [],
    format: 'champions_reg_m_b_doubles',
    allowLegendaries: false,
    targetUsableCount: 2,
    rawPageSize: 1,
    requestContext: reqCtx7,
  });

  console.log('[Caso 7] Nomes retornados:', res7.usableCandidates.map(c => c.name));
  assert(res7.usableCandidates.length === 2, 'Caso 7: deve retornar 2 itens.');
  assert(res7.usableCandidates[0].name === 'TieMon-1', 'Caso 7: TieMon-1');
  assert(res7.usableCandidates[1].name === 'TieMon-2', 'Caso 7: TieMon-2');
  console.log('✅ CASO 7 PASS');

  // =========================================================================
  // CASO 8 — MISSING USAGESCORE / DEXNUMBER NORMALIZATION
  // =========================================================================
  console.log('\n--- CASO 8: Missing usageScore / dexNumber Normalization ---');
  await resetPokemonCollection();

  // Documentos legados de verdade: `Pokemon.create()` faria o Mongoose aplicar
  // `default: 0` em usageScore, gravando o campo e nunca exercitando o caso.
  // `collection.insertOne` grava exatamente o que se pede, que é o cenário real
  // de um documento anterior à introdução do campo.
  const buildRawDoc = (name: string, extra: Record<string, unknown>) => ({
    name,
    formatId: 'champions_reg_m_b_doubles',
    types: ['fire'],
    variants: [{ formatId: 'champions_reg_m_b_doubles', baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, types: ['fire'], abilities: { 0: 'Flash Fire' } }],
    stats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
    abilities: { 0: 'Flash Fire' },
    isLegendary: false,
    formatLegality: { champions_reg_m_b_doubles: true },
    competitiveSet: { setId: `s-${name}`, pokemon: name, format: 'champions_reg_m_b_doubles', item: 'ItemNM', ability: 'Flash Fire', nature: 'Modest', moves: ['Protect'] },
    ...extra,
  });

  await Pokemon.collection.insertMany([
    buildRawDoc('NormMon-Scored', { dexNumber: 50, usageScore: 80 }),
    buildRawDoc('NormMon-NoUsage', { dexNumber: 60 }),               // usageScore ausente
    buildRawDoc('NormMon-NoDex', { usageScore: 80 }),                // dexNumber ausente
    buildRawDoc('NormMon-Neither', {}),                              // ambos ausentes
  ] as any);

  const reqCtx8 = createLeadBuildRequestContext('req-c8');
  const res8 = await fetcher.fetchProgressiveCandidates({
    leadNames: ['Unown', 'Magikarp'],
    baseTeam: [],
    format: 'champions_reg_m_b_doubles',
    allowLegendaries: false,
    targetUsableCount: 4,
    rawPageSize: 1, // força uma página por documento: o cursor precisa avançar 4x
    requestContext: reqCtx8,
  });

  console.log('[Caso 8] EndCursor:', res8.endCursor);
  console.log('[Caso 8] Examinados:', res8.allExaminedCandidates.map(d => d.name));

  // A garantia que importa é o avanço: com um sentinela numérico no lugar do
  // valor real, o predicado do cursor não casa o próprio documento nulo e a
  // paginação devolve a mesma página para sempre.
  const examined8 = res8.allExaminedCandidates.map(d => d.name);
  const unique8 = new Set(examined8);
  assert(unique8.size === examined8.length, `Caso 8: paginação repetiu documentos: ${examined8.join(', ')}`);
  assert(unique8.size === 4, `Caso 8: esperado percorrer os 4 documentos, percorreu ${unique8.size}.`);
  assert(res8.endCursor !== null, 'Caso 8: endCursor');
  assert(res8.telemetry.candidateFetchStopReason === 'USABLE_QUOTA_REACHED', `Caso 8: stopReason ${res8.telemetry.candidateFetchStopReason}`);
  console.log('✅ CASO 8 PASS');

  // =========================================================================
  // CASO 9 — USABLE QUOTA & CAPABILITY COVERAGE CHECK
  // =========================================================================
  console.log('\n--- CASO 9: Usable Quota & Capability Coverage Check ---');
  await resetPokemonCollection();

  const covDocs = [];
  for (let i = 0; i < 30; i++) {
    const name = `CovMon-${i}`;
    covDocs.push({
      dexNumber: 300 + i,
      name,
      formatId: 'champions_reg_m_b_doubles',
      types: ['grass'],
      variants: [{ formatId: 'champions_reg_m_b_doubles', baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, types: ['grass'], abilities: { 0: 'Chlorophyll' } }],
      stats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
      abilities: { 0: 'Chlorophyll' },
      usageScore: 100 - i,
      formatLegality: { champions_reg_m_b_doubles: true },
      competitiveSet: { setId: `cov-${i}`, pokemon: name, format: 'champions_reg_m_b_doubles', item: `ItemCov-${i}`, ability: 'Chlorophyll', nature: 'Modest', moves: ['Protect'] },
    });
  }

  await Pokemon.create(covDocs);

  const reqCtx9 = createLeadBuildRequestContext('req-c9');
  const res9 = await fetcher.fetchProgressiveCandidates({
    leadNames: ['Unown', 'Magikarp'],
    baseTeam: [],
    format: 'champions_reg_m_b_doubles',
    allowLegendaries: false,
    targetUsableCount: 10,
    rawPageSize: 10,
    checkCapabilityCoverage: (usable) => {
      return usable.length >= 15;
    },
    requestContext: reqCtx9,
  });

  console.log('[Caso 9] Telemetria:', res9.telemetry);
  assert(res9.telemetry.candidateQueryCount === 2, 'Caso 9: 2 paginas para atingir 15.');
  assert(res9.telemetry.candidateUsableAccumulatedCount >= 15, 'Caso 9: 15 acumulados.');
  assert(res9.telemetry.capabilityCoverageSatisfied === true, 'Caso 9: capabilityCoverageSatisfied true.');
  console.log('✅ CASO 9 PASS');

  // =========================================================================
  // CASO 10 — RECOVERY CONTINUATION FROM PRIMARY CURSOR WITHOUT DUPLICATE QUERIES
  // =========================================================================
  console.log('\n--- CASO 10: Recovery Continuation from Primary Cursor ---');
  await resetPokemonCollection();

  const recDocs = [];
  for (let i = 0; i < 40; i++) {
    const name = `RecMon-${i}`;
    recDocs.push({
      dexNumber: 400 + i,
      name,
      formatId: 'champions_reg_m_b_doubles',
      types: ['water'],
      variants: [{ formatId: 'champions_reg_m_b_doubles', baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, types: ['water'], abilities: { 0: 'Torrent' } }],
      stats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
      abilities: { 0: 'Torrent' },
      usageScore: 100 - i,
      formatLegality: { champions_reg_m_b_doubles: true },
      competitiveSet: { setId: `rec-${i}`, pokemon: name, format: 'champions_reg_m_b_doubles', item: `ItemRec-${i}`, ability: 'Torrent', nature: 'Modest', moves: ['Protect'] },
    });
  }

  await Pokemon.create(recDocs);

  const reqCtx10 = createLeadBuildRequestContext('req-c10');
  const primaryRes = await fetcher.fetchProgressiveCandidates({
    leadNames: ['Charizard-Mega-Y', 'Whimsicott'],
    baseTeam: [],
    format: 'champions_reg_m_b_doubles',
    allowLegendaries: false,
    targetUsableCount: 20,
    rawPageSize: 20,
    requestContext: reqCtx10,
  });

  const endCursorOfPrimary = primaryRes.endCursor;

  const recoveryRes = await fetcher.fetchProgressiveCandidates({
    leadNames: ['Charizard-Mega-Y', 'Whimsicott'],
    baseTeam: [],
    format: 'champions_reg_m_b_doubles',
    allowLegendaries: false,
    targetUsableCount: 15,
    rawPageSize: 15,
    initialCursor: endCursorOfPrimary,
    excludeNames: primaryRes.usableCandidates.map(c => c.name),
    requestContext: reqCtx10,
  });

  const primaryNamesSet = new Set(primaryRes.usableCandidates.map(c => c.name));
  const recoveryHasDuplicates = recoveryRes.usableCandidates.some(c => primaryNamesSet.has(c.name));

  assert(!recoveryHasDuplicates, 'Caso 10: Sem duplicados.');
  assert(recoveryRes.usableCandidates.length === 15, 'Caso 10: 15 novos.');
  assert(reqCtx10.invocationCounters.duplicateCandidateQueryCount === 0, 'Caso 10: duplicateCandidateQueryCount 0.');
  console.log('✅ CASO 10 PASS');

  console.log('\n=========================================================================');
  console.log('✅ TODOS OS 10 CASOS DE TESTE MANDATÓRIOS DA AUTORIZAÇÃO 087-A FORAM APROVADOS!');
  console.log('=========================================================================');
}

/**
 * Derruba o banco efêmero mesmo quando a suíte falha — um banco órfão por
 * execução com falha acumularia lixo no servidor local indefinidamente.
 */
async function disposeIsolatedDatabase(): Promise<void> {
  if (!isolatedDatabase) {
    await mongoose.disconnect();
    return;
  }
  const { databaseName } = isolatedDatabase;
  await isolatedDatabase.dispose();
  isolatedDatabase = null;
  console.log(`[Isolamento] Banco efêmero removido: ${databaseName}`);
}

if (require.main === module) {
  runProgressiveCandidateFetcherAll10Tests()
    .then(async () => {
      await disposeIsolatedDatabase();
      console.log('✅ ProgressiveCandidateFetcher.prototype.test ALL 10 TESTS FINISHED WITH FULL SUCCESS');
    })
    .catch(async (err) => {
      console.error('❌ ProgressiveCandidateFetcher.prototype.test FAIL:', err);
      await disposeIsolatedDatabase();
      process.exit(1);
    });
}
