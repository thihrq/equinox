import { runActiveV2RuntimeShadow } from '../services/competitive-data/runtime-shadow/ActiveV2RuntimeShadowOrchestrator';
import type { ActiveV2RuntimeShadowInput } from '../services/competitive-data/runtime-shadow/ActiveV2RuntimeShadowTypes';

const ENABLED_FLAG = 'EQUINOX_ACTIVE_V2_RUNTIME_SHADOW_ENABLED';

interface MockOptions {
  circuitBreakerDoc?: any | null;
  canaryConfigDoc?: any | null;
  v2SetsByPokemon?: Record<string, any[]>;
}

function makeConnection(options: MockOptions): { connection: any; requestedCollections: string[]; insertedEvents: any[] } {
  const requestedCollections: string[] = [];
  const insertedEvents: any[] = [];
  const v2SetsByPokemon = options.v2SetsByPokemon ?? {};

  const connection = {
    db: {
      collection: (name: string) => {
        requestedCollections.push(name);

        if (name === 'active-v2-runtime-control') {
          return { findOne: async () => options.circuitBreakerDoc ?? null };
        }
        if (name === 'active-v2-canary-config') {
          return { findOne: async () => options.canaryConfigDoc ?? null };
        }
        if (name === 'pokemonsets_v2') {
          return {
            find: (query: any) => ({
              toArray: async () => v2SetsByPokemon[query.pokemonName] ?? [],
            }),
          };
        }
        if (name === 'active_v2_runtime_telemetry') {
          return {
            insertOne: async (doc: any) => {
              insertedEvents.push(doc);
              return { acknowledged: true };
            },
          };
        }
        throw new Error(`unexpected collection requested: ${name}`);
      },
    },
  };

  return { connection, requestedCollections, insertedEvents };
}

function baseInput(overrides: Partial<ActiveV2RuntimeShadowInput> = {}): ActiveV2RuntimeShadowInput {
  return {
    requestId: 'req-1',
    format: 'champions_reg_m_b_doubles',
    teamIdentity: 'balanced',
    primaryTeamSuggestedPokemons: [
      { name: 'Sinistcha', item: 'Sitrus Berry', ability: 'Hospitality', nature: 'Sassy', moves: ['Trick Room', 'Rage Powder', 'Matcha Gotcha', 'Protect'] },
    ],
    baselineLatencyMs: 120,
    ...overrides,
  };
}

const SHADOW_CANARY_CONFIG = { mode: 'shadow', percentage: null, canaryCampaignId: 'campaign-1', seed: 'seed-1', windowStartedAt: new Date().toISOString(), windowEndedAt: null, version: 1 };
const OFF_CANARY_CONFIG = { mode: 'off', percentage: null, canaryCampaignId: 'unstarted', seed: 'unstarted', windowStartedAt: new Date(0).toISOString(), windowEndedAt: null, version: 0 };

async function runTests(): Promise<void> {
  const originalFlag = process.env[ENABLED_FLAG];

  try {
    // --- Caso de Teste 1: formato não coberto -> nenhuma coleção Mongo é tocada, mesmo com a flag ligada ---
    process.env[ENABLED_FLAG] = 'true';
    const { connection: conn1, requestedCollections: req1 } = makeConnection({});
    await runActiveV2RuntimeShadow(conn1, baseInput({ format: 'vanilla' }));
    if (req1.length !== 0) throw new Error(`Test 1 failed: expected zero Mongo interactions for uncovered format, got ${req1.join(',')}`);

    // --- Caso de Teste 2: flag estática desligada -> nenhuma coleção Mongo é tocada, mesmo com formato coberto ---
    delete process.env[ENABLED_FLAG];
    const { connection: conn2, requestedCollections: req2 } = makeConnection({ canaryConfigDoc: SHADOW_CANARY_CONFIG });
    await runActiveV2RuntimeShadow(conn2, baseInput());
    if (req2.length !== 0) throw new Error(`Test 2 failed: expected zero Mongo interactions when the static flag is off, got ${req2.join(',')}`);

    process.env[ENABLED_FLAG] = 'true';

    // --- Caso de Teste 3: flag ligada, mas canário em modo != shadow (padrão 'off') -> lê só a config, nunca o breaker ---
    const { connection: conn3, requestedCollections: req3, insertedEvents: events3 } = makeConnection({ canaryConfigDoc: OFF_CANARY_CONFIG });
    await runActiveV2RuntimeShadow(conn3, baseInput());
    if (events3.length !== 0) throw new Error('Test 3 failed: expected no telemetry write when canary mode is not shadow');
    if (req3.includes('active-v2-runtime-control')) {
      throw new Error('Test 3 failed: expected the circuit breaker read to be skipped when canary mode is not shadow (minimize Mongo reads in the common case)');
    }
    if (!req3.includes('active-v2-canary-config')) throw new Error('Test 3 failed: expected the canary config to have been read');

    // --- Caso de Teste 4: modo shadow + set V2 idêntico -> escreve evento "equivalent" ---
    const { connection: conn4, insertedEvents: events4 } = makeConnection({
      canaryConfigDoc: SHADOW_CANARY_CONFIG,
      circuitBreakerDoc: null,
      v2SetsByPokemon: {
        Sinistcha: [{ item: 'Sitrus Berry', ability: 'Hospitality', nature: 'Sassy', moves: ['Trick Room', 'Rage Powder', 'Matcha Gotcha', 'Protect'] }],
      },
    });
    await runActiveV2RuntimeShadow(conn4, baseInput());
    if (events4.length !== 1) throw new Error('Test 4 failed: expected exactly 1 telemetry event to be written');
    if (events4[0].comparison.classification !== 'equivalent') throw new Error(`Test 4 failed: expected equivalent, got ${events4[0].comparison.classification}`);
    if (events4[0].v2.fallbackTriggered) throw new Error('Test 4 failed: expected fallbackTriggered=false');

    // --- Caso de Teste 5: modo shadow + nenhum set V2 encontrado -> acceptable-divergence + fallback ---
    const { connection: conn5, insertedEvents: events5 } = makeConnection({
      canaryConfigDoc: SHADOW_CANARY_CONFIG,
      circuitBreakerDoc: null,
      v2SetsByPokemon: {},
    });
    await runActiveV2RuntimeShadow(conn5, baseInput());
    if (events5.length !== 1) throw new Error('Test 5 failed: expected exactly 1 telemetry event to be written');
    if (events5[0].comparison.classification !== 'acceptable-divergence') throw new Error('Test 5 failed: expected acceptable-divergence');
    if (!events5[0].v2.fallbackTriggered || events5[0].v2.fallbackReason !== 'no-v2-data') {
      throw new Error('Test 5 failed: expected fallbackTriggered=true with reason no-v2-data');
    }

    // --- Caso de Teste 6: circuit breaker em force-baseline vence o modo shadow -> nenhuma escrita ---
    const { connection: conn6, insertedEvents: events6 } = makeConnection({
      canaryConfigDoc: SHADOW_CANARY_CONFIG,
      circuitBreakerDoc: { mode: 'force-baseline', reasonCode: 'MANUAL_OPERATOR_TRIP', triggeredBy: 'manual', triggeredAt: new Date().toISOString(), metricsWindowId: null, requiresManualRecovery: true, version: 1 },
      v2SetsByPokemon: { Sinistcha: [{ item: 'Sitrus Berry', ability: 'Hospitality', nature: 'Sassy', moves: ['Trick Room', 'Rage Powder', 'Matcha Gotcha', 'Protect'] }] },
    });
    await runActiveV2RuntimeShadow(conn6, baseInput());
    if (events6.length !== 0) throw new Error('Test 6 failed: expected circuit breaker force-baseline to suppress the shadow write entirely');

    console.log('[Equinox] Active V2 runtime shadow orchestrator validation passed.');
  } finally {
    if (originalFlag === undefined) delete process.env[ENABLED_FLAG];
    else process.env[ENABLED_FLAG] = originalFlag;
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
