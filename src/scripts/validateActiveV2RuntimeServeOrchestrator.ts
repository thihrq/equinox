import { resolveActiveV2RuntimeServe } from '../services/competitive-data/runtime-serve/ActiveV2RuntimeServeOrchestrator';
import type { ActiveV2RuntimeServeInput } from '../services/competitive-data/runtime-serve/ActiveV2RuntimeServeTypes';

const COVERED_FORMAT = 'champions_reg_m_b_doubles';

function baseInput(overrides: Partial<ActiveV2RuntimeServeInput> = {}): ActiveV2RuntimeServeInput {
  return {
    requestId: 'req-1',
    identifier: 'champions_reg_m_b_doubles:sinistcha,incineroar,aggronmega',
    format: COVERED_FORMAT,
    teamIdentity: 'balanced',
    primaryTeamSuggestedPokemons: [
      { name: 'Sinistcha', item: 'baseline-item', ability: 'baseline-ability', nature: 'Calm', moves: ['Shadow Ball'] },
      { name: 'Incineroar', item: 'baseline-item', ability: 'baseline-ability', nature: 'Careful', moves: ['Fake Out'] },
      { name: 'Aggron-Mega', item: 'baseline-item', ability: 'baseline-ability', nature: 'Adamant', moves: ['Heavy Slam'] },
    ],
    baselineLatencyMs: 50,
    internalCanaryAuthHeaders: null,
    requestPath: '/api/team/suggest',
    ...overrides,
  };
}

interface MockOptions {
  canaryConfig?: any;
  runtimeControl?: any;
  v2Docs?: any[];
  findDelayMs?: number;
}

function makeMockConnection(options: MockOptions = {}) {
  const canaryConfig = options.canaryConfig ?? { mode: 'off', percentage: null, canaryCampaignId: 'unstarted', seed: 'unstarted', windowStartedAt: new Date(0).toISOString(), windowEndedAt: null, version: 0 };
  const runtimeControl = options.runtimeControl ?? { mode: 'normal', reasonCode: null, triggeredBy: null, triggeredAt: null, metricsWindowId: null, requiresManualRecovery: false, version: 0 };
  const v2Docs = options.v2Docs ?? [];
  let canaryConfigReads = 0;
  let runtimeControlReads = 0;

  const connection = {
    db: {
      collection: (name: string) => {
        if (name === 'active-v2-canary-config') {
          return { findOne: async () => { canaryConfigReads++; return { _id: 'active-v2-canary-config', ...canaryConfig }; } };
        }
        if (name === 'active-v2-runtime-control') {
          return { findOne: async () => { runtimeControlReads++; return { _id: 'active-v2-runtime-control', ...runtimeControl }; } };
        }
        if (name === 'pokemonsets_v2') {
          return {
            find: () => ({
              toArray: async () => {
                if (options.findDelayMs) await new Promise(resolve => setTimeout(resolve, options.findDelayMs));
                return v2Docs;
              },
            }),
          };
        }
        // Coleções de nonce/rate-limit da Fase 5 (auth interno) — sem uso nestes testes.
        return { findOne: async () => null, updateOne: async () => ({ matchedCount: 0, upsertedCount: 0 }), insertOne: async () => ({}) };
      },
    },
  } as any;

  return { connection, getCanaryConfigReads: () => canaryConfigReads, getRuntimeControlReads: () => runtimeControlReads };
}

async function runTests(): Promise<void> {
  const originalServeFlag = process.env.EQUINOX_ACTIVE_V2_RUNTIME_SERVE_ENABLED;
  process.env.EQUINOX_ACTIVE_V2_RUNTIME_SERVE_ENABLED = 'true';

  try {
    // --- Caso de Teste 1: formato nao coberto -> baseline, sem telemetria, zero leitura Mongo ---
    const { connection: conn1, getCanaryConfigReads: reads1 } = makeMockConnection();
    const result1 = await resolveActiveV2RuntimeServe(conn1, baseInput({ format: 'other_format' }));
    if (result1.servePath !== 'baseline' || result1.telemetryEvent !== null) throw new Error('Test 1 failed: expected baseline with no telemetry for uncovered format');
    if (reads1() !== 0) throw new Error('Test 1 failed: expected zero Mongo reads for uncovered format');

    // --- Caso de Teste 2: flag desligada -> baseline, sem telemetria, zero leitura Mongo ---
    process.env.EQUINOX_ACTIVE_V2_RUNTIME_SERVE_ENABLED = 'false';
    const { connection: conn2, getCanaryConfigReads: reads2 } = makeMockConnection();
    const result2 = await resolveActiveV2RuntimeServe(conn2, baseInput());
    if (result2.servePath !== 'baseline' || result2.telemetryEvent !== null) throw new Error('Test 2 failed: expected baseline with no telemetry when flag is off');
    if (reads2() !== 0) throw new Error('Test 2 failed: expected zero Mongo reads when flag is off');
    process.env.EQUINOX_ACTIVE_V2_RUNTIME_SERVE_ENABLED = 'true';

    // --- Caso de Teste 3: mode='off' -> baseline, sem telemetria, NAO le o circuit breaker ---
    const { connection: conn3, getCanaryConfigReads: c3reads, getRuntimeControlReads: c3breaker } = makeMockConnection({ canaryConfig: { mode: 'off', percentage: null } });
    const result3 = await resolveActiveV2RuntimeServe(conn3, baseInput());
    if (result3.servePath !== 'baseline' || result3.telemetryEvent !== null) throw new Error('Test 3 failed: expected baseline for mode=off');
    if (c3reads() !== 1) throw new Error('Test 3 failed: expected exactly 1 canary config read');
    if (c3breaker() !== 0) throw new Error('Test 3 failed: expected zero circuit breaker reads for mode=off (cheapest-first optimization)');

    // --- Caso de Teste 4: mode='shadow' -> baseline (shadow tem orquestrador proprio, nao este) ---
    const { connection: conn4 } = makeMockConnection({ canaryConfig: { mode: 'shadow', percentage: null } });
    const result4 = await resolveActiveV2RuntimeServe(conn4, baseInput());
    if (result4.servePath !== 'baseline' || result4.telemetryEvent !== null) throw new Error('Test 4 failed: expected baseline for mode=shadow (handled by the shadow orchestrator instead)');

    // --- Caso de Teste 5: circuit breaker force-baseline sobrepoe mode='full' ---
    const { connection: conn5 } = makeMockConnection({ canaryConfig: { mode: 'full', percentage: null }, runtimeControl: { mode: 'force-baseline' } });
    const result5 = await resolveActiveV2RuntimeServe(conn5, baseInput());
    if (result5.servePath !== 'baseline' || result5.telemetryEvent !== null) throw new Error('Test 5 failed: expected baseline when circuit breaker is tripped, even with mode=full');

    // --- Caso de Teste 6: mode='full', hidratacao bem-sucedida para os 3 Pokemon ---
    const v2Docs6 = [
      { pokemonName: 'Sinistcha', item: 'Leftovers', ability: 'Hospitality', nature: 'Bold', moves: ['Trick Room'], publishRunId: 'run-1' },
      { pokemonName: 'Incineroar', item: 'Safety Goggles', ability: 'Intimidate', nature: 'Careful', moves: ['Fake Out', 'Parting Shot'], publishRunId: 'run-1' },
      { pokemonName: 'Aggron-Mega', item: 'Aggronite', ability: 'Filter', nature: 'Adamant', moves: ['Heavy Slam'], publishRunId: 'run-1' },
    ];
    const { connection: conn6 } = makeMockConnection({ canaryConfig: { mode: 'full', percentage: null }, v2Docs: v2Docs6 });
    const result6 = await resolveActiveV2RuntimeServe(conn6, baseInput());
    if (result6.servePath !== 'active-v2') throw new Error('Test 6 failed: expected servePath=active-v2 for mode=full');
    if (!result6.hydratedSuggestedPokemons) throw new Error('Test 6 failed: expected hydrated data');
    if (result6.hydratedSuggestedPokemons[0].item !== 'Leftovers') throw new Error('Test 6 failed: expected Sinistcha item hydrated to Leftovers');
    if (result6.telemetryEvent?.v2.fallbackTriggered !== false) throw new Error('Test 6 failed: expected fallbackTriggered=false on full hydration');
    if (result6.telemetryEvent?.publishRunId !== 'run-1') throw new Error('Test 6 failed: expected publishRunId to be recorded');

    // --- Caso de Teste 7: mode='full', um Pokemon sem set V2 -> fallback parcial (no-v2-data) ---
    const v2Docs7 = [
      { pokemonName: 'Sinistcha', item: 'Leftovers', ability: 'Hospitality', nature: 'Bold', moves: ['Trick Room'], publishRunId: 'run-1' },
      { pokemonName: 'Incineroar', item: 'Safety Goggles', ability: 'Intimidate', nature: 'Careful', moves: ['Fake Out'], publishRunId: 'run-1' },
      // Aggron-Mega sem set ativo
    ];
    const { connection: conn7 } = makeMockConnection({ canaryConfig: { mode: 'full', percentage: null }, v2Docs: v2Docs7 });
    const result7 = await resolveActiveV2RuntimeServe(conn7, baseInput());
    if (result7.servePath !== 'active-v2') throw new Error('Test 7 failed: expected servePath=active-v2 even with partial fallback');
    if (!result7.hydratedSuggestedPokemons) throw new Error('Test 7 failed: expected partial hydration (2 of 3)');
    if (result7.hydratedSuggestedPokemons[2].item !== 'baseline-item') throw new Error('Test 7 failed: expected Aggron-Mega to keep baseline data');
    if (result7.telemetryEvent?.v2.fallbackReason !== 'no-v2-data') throw new Error('Test 7 failed: expected fallbackReason=no-v2-data');

    // --- Caso de Teste 8: mode='full', Pokemon com 2 sets ativos -> ambiguous-v2-data ---
    const v2Docs8 = [
      { pokemonName: 'Sinistcha', item: 'Leftovers', ability: 'Hospitality', nature: 'Bold', moves: ['Trick Room'], publishRunId: 'run-1' },
      { pokemonName: 'Sinistcha', item: 'Choice Specs', ability: 'Hospitality', nature: 'Modest', moves: ['Shadow Ball'], publishRunId: 'run-1' },
      { pokemonName: 'Incineroar', item: 'Safety Goggles', ability: 'Intimidate', nature: 'Careful', moves: ['Fake Out'], publishRunId: 'run-1' },
      { pokemonName: 'Aggron-Mega', item: 'Aggronite', ability: 'Filter', nature: 'Adamant', moves: ['Heavy Slam'], publishRunId: 'run-1' },
    ];
    const { connection: conn8 } = makeMockConnection({ canaryConfig: { mode: 'full', percentage: null }, v2Docs: v2Docs8 });
    const result8 = await resolveActiveV2RuntimeServe(conn8, baseInput());
    if (result8.hydratedSuggestedPokemons?.[0].item !== 'baseline-item') throw new Error('Test 8 failed: expected Sinistcha to keep baseline data when ambiguous');
    if (result8.telemetryEvent?.v2.fallbackReason !== 'ambiguous-v2-data') throw new Error('Test 8 failed: expected fallbackReason=ambiguous-v2-data');

    // --- Caso de Teste 9: mode='full', nenhum Pokemon com set V2 -> hydratedSuggestedPokemons=null ---
    const { connection: conn9 } = makeMockConnection({ canaryConfig: { mode: 'full', percentage: null }, v2Docs: [] });
    const result9 = await resolveActiveV2RuntimeServe(conn9, baseInput());
    if (result9.servePath !== 'active-v2') throw new Error('Test 9 failed: expected servePath=active-v2 even with zero coverage');
    if (result9.hydratedSuggestedPokemons !== null) throw new Error('Test 9 failed: expected hydratedSuggestedPokemons=null when nothing was hydrated');
    if (result9.telemetryEvent?.v2.fallbackTriggered !== true) throw new Error('Test 9 failed: expected fallbackTriggered=true');

    // --- Caso de Teste 10: mode='internal' sem headers -> baseline (nao autorizado) ---
    const { connection: conn10 } = makeMockConnection({ canaryConfig: { mode: 'internal', percentage: null }, v2Docs: [{ pokemonName: 'Sinistcha', item: 'Leftovers', ability: 'Hospitality', nature: 'Bold', moves: ['Trick Room'] }] });
    const result10 = await resolveActiveV2RuntimeServe(conn10, baseInput({ internalCanaryAuthHeaders: null }));
    if (result10.servePath !== 'baseline') throw new Error('Test 10 failed: expected baseline for mode=internal without auth headers');

    // --- Caso de Teste 11: mode='internal' com headers mas sem segredo ativo configurado -> negado -> baseline ---
    const { connection: conn11 } = makeMockConnection({ canaryConfig: { mode: 'internal', percentage: null } });
    const result11 = await resolveActiveV2RuntimeServe(conn11, baseInput({
      internalCanaryAuthHeaders: { subject: 'tester', timestamp: String(Date.now()), nonce: 'nonce-1', signature: 'deadbeef' },
    }));
    if (result11.servePath !== 'baseline') throw new Error('Test 11 failed: expected baseline for mode=internal with invalid/unconfigured auth');

    // --- Caso de Teste 12: timeout -> fallback v2-timeout ---
    const { connection: conn12 } = makeMockConnection({ canaryConfig: { mode: 'full', percentage: null }, v2Docs: [], findDelayMs: 1600 });
    const result12 = await resolveActiveV2RuntimeServe(conn12, baseInput());
    if (result12.servePath !== 'baseline') throw new Error('Test 12 failed: expected baseline on timeout');
    if (result12.telemetryEvent?.v2.fallbackReason !== 'v2-timeout') throw new Error('Test 12 failed: expected fallbackReason=v2-timeout');
    if (result12.telemetryEvent?.v2.outcome !== 'timeout') throw new Error('Test 12 failed: expected outcome=timeout');

    console.log('[Equinox] Active V2 runtime serve orchestrator validation passed.');
  } finally {
    if (originalServeFlag === undefined) delete process.env.EQUINOX_ACTIVE_V2_RUNTIME_SERVE_ENABLED;
    else process.env.EQUINOX_ACTIVE_V2_RUNTIME_SERVE_ENABLED = originalServeFlag;
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
