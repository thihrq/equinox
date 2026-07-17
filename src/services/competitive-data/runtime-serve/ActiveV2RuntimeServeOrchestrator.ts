import mongoose from 'mongoose';
import * as crypto from 'crypto';
import { readActiveV2CanaryConfig } from '../runtime-control/ActiveV2CanaryConfigStore';
import { readActiveV2RuntimeControl } from '../runtime-control/ActiveV2RuntimeControlStore';
import { resolveActiveV2RuntimeDecision } from '../runtime-control/ActiveV2RuntimeDecisionResolver';
import { ACTIVE_V2_COVERED_FORMAT } from '../runtime-control/ActiveV2RuntimeCoverage';
import { resolveActiveV2RuntimeServeMode } from './ActiveV2RuntimeServeFlagResolver';
import { validateActiveV2InternalCanaryRequest } from '../internal-canary-auth/ActiveV2InternalCanaryAuthValidator';
import { ALLOWED_TARGET_COLLECTION } from '../publication/ActiveV2ProductionPolicy';
import type {
  ActiveV2RuntimeServeInput,
  ActiveV2RuntimeServeResult,
  ActiveV2ServeSuggestedPokemon,
} from './ActiveV2RuntimeServeTypes';
import type { ActiveV2RuntimeFallbackReason, ActiveV2RuntimeOutcome, ActiveV2RuntimeTelemetryEvent } from '../runtime-observability/ActiveV2RuntimeTelemetryTypes';

/** Mesma coleção usada pela Fase 3 (shadow) — ver ActiveV2RuntimeShadowOrchestrator.ts. */
const TELEMETRY_COLLECTION = 'active_v2_runtime_telemetry';

/**
 * Orçamento de tempo para todo o trabalho de decisão+leitura antes de
 * desistir e servir baseline. Ao contrário do shadow mode (fire-and-forget,
 * latência não importa), este caminho roda ANTES da resposta ser enviada —
 * um Mongo lento aqui atrasaria toda requisição com o canário ligado.
 *
 * Era 300ms originalmente; validação real em produção (2026-07-17, Render
 * Free) mostrou que isso é curto demais — em 4/4 requisições reais o
 * caminho `internal` (autenticação HMAC com leitura+escrita de nonce/rate
 * limit no Mongo, mais a própria leitura de pokemonsets_v2) estourou
 * consistentemente os 300ms, mesmo em condições normais, nunca chegando a
 * completar. O fallback funcionou corretamente (nunca quebrou a resposta),
 * mas o canário nunca conseguia hidratar de verdade. 1500ms dá margem real
 * pro Mongo responder sob o CPU limitado do tier gratuito, mantendo um
 * teto — não é "sem limite".
 */
const V2_SERVE_TIMEOUT_MS = 1500;

function baselineResult(): ActiveV2RuntimeServeResult {
  return { servePath: 'baseline', hydratedSuggestedPokemons: null, telemetryEvent: null };
}

function buildTelemetryEvent(input: ActiveV2RuntimeServeInput, params: {
  outcome: ActiveV2RuntimeOutcome;
  fallbackTriggered: boolean;
  fallbackReason: ActiveV2RuntimeFallbackReason | null;
  v2LatencyMs: number | null;
  publishRunId?: string | null;
}): ActiveV2RuntimeTelemetryEvent {
  return {
    eventId: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    requestId: input.requestId,
    format: input.format,
    teamIdentity: input.teamIdentity,
    // /api/team/suggest não calcula um arquétipo tático — sem dado real aqui,
    // mesma limitação já documentada no orquestrador de shadow.
    archetype: 'unknown',
    publishRunId: params.publishRunId ?? null,
    activeV2DataDigest: null,
    baseline: { outcome: 'success', latencyMs: input.baselineLatencyMs },
    v2: {
      outcome: params.outcome,
      latencyMs: params.v2LatencyMs,
      fallbackTriggered: params.fallbackTriggered,
      fallbackReason: params.fallbackReason,
    },
    // Serving real não classifica divergência como o shadow faz — não há um
    // "baseline" para comparar, o V2 É o que está sendo servido ao usuário.
    comparison: null,
  };
}

function fallbackTelemetryResult(
  input: ActiveV2RuntimeServeInput,
  startedAt: number,
  fallbackReason: Extract<ActiveV2RuntimeFallbackReason, 'v2-timeout' | 'v2-error'>
): ActiveV2RuntimeServeResult {
  return {
    servePath: 'baseline',
    hydratedSuggestedPokemons: null,
    telemetryEvent: buildTelemetryEvent(input, {
      outcome: fallbackReason === 'v2-timeout' ? 'timeout' : 'error',
      fallbackTriggered: true,
      fallbackReason,
      v2LatencyMs: Date.now() - startedAt,
    }),
  };
}

async function resolveActiveV2RuntimeServeInternal(
  connection: mongoose.Connection,
  input: ActiveV2RuntimeServeInput,
  startedAt: number
): Promise<ActiveV2RuntimeServeResult> {
  // Ordem "mais barato primeiro" (mesmo padrão aplicado ao orquestrador de
  // shadow nesta sessão): mode='off' nunca precisa ler o circuit breaker,
  // já que o resultado é baseline de qualquer forma.
  const canaryConfig = await readActiveV2CanaryConfig(connection);
  if (canaryConfig.mode === 'off') return baselineResult();

  const circuitBreaker = await readActiveV2RuntimeControl(connection);

  let isAuthorizedInternalCanaryRequest = false;
  if (canaryConfig.mode === 'internal' && input.internalCanaryAuthHeaders) {
    const authResult = await validateActiveV2InternalCanaryRequest(
      connection,
      input.internalCanaryAuthHeaders,
      input.requestPath
    );
    isAuthorizedInternalCanaryRequest = authResult.authorized;
  }

  const decision = resolveActiveV2RuntimeDecision({
    circuitBreaker,
    staticForceBaseline: process.env.EQUINOX_ACTIVE_V2_FORCE_BASELINE === 'true',
    canaryConfig,
    identifier: input.identifier,
    isAuthorizedInternalCanaryRequest,
    perRequestFallbackRequested: false,
  });

  if (decision.servePath !== 'active-v2') return baselineResult();

  const db = connection.db;
  if (!db) return fallbackTelemetryResult(input, startedAt, 'v2-error');

  const names = input.primaryTeamSuggestedPokemons.map(p => p.name);
  let v2Docs: any[];
  try {
    v2Docs = await db
      .collection(ALLOWED_TARGET_COLLECTION)
      .find({ pokemonName: { $in: names }, formatId: input.format, active: true })
      .toArray();
  } catch (error) {
    return fallbackTelemetryResult(input, startedAt, 'v2-error');
  }

  const byName = new Map<string, any[]>();
  for (const doc of v2Docs) {
    const list = byName.get(doc.pokemonName) ?? [];
    list.push(doc);
    byName.set(doc.pokemonName, list);
  }

  let anyHydrated = false;
  let fallbackReason: ActiveV2RuntimeFallbackReason | null = null;
  const hydrated: ActiveV2ServeSuggestedPokemon[] = input.primaryTeamSuggestedPokemons.map(pokemon => {
    const matches = byName.get(pokemon.name) ?? [];
    if (matches.length === 1) {
      anyHydrated = true;
      const v2 = matches[0];
      return { name: pokemon.name, item: v2.item, ability: v2.ability, nature: v2.nature, moves: v2.moves };
    }
    // Ambiguidade (>1 set ativo para o mesmo Pokémon+formato) tem precedência
    // na sinalização sobre lacuna de cobertura — ambas resultam em manter o
    // baseline para este Pokémon especificamente, nunca uma escolha arbitrária.
    fallbackReason = matches.length > 1 ? 'ambiguous-v2-data' : (fallbackReason ?? 'no-v2-data');
    return pokemon;
  });

  const fallbackTriggered = fallbackReason !== null;
  const publishRunId = anyHydrated ? (v2Docs.find(d => byName.get(d.pokemonName)?.length === 1)?.publishRunId ?? null) : null;

  return {
    servePath: 'active-v2',
    hydratedSuggestedPokemons: anyHydrated ? hydrated : null,
    telemetryEvent: buildTelemetryEvent(input, {
      outcome: 'success',
      fallbackTriggered,
      fallbackReason,
      v2LatencyMs: Date.now() - startedAt,
      publishRunId,
    }),
  };
}

/**
 * Decide, de verdade, se esta requisição deve receber dados de
 * `pokemonsets_v2` em vez do baseline — e, quando sim, já devolve os dados
 * hidratados prontos para substituir a resposta. Precisa rodar ANTES de
 * `res.json(...)` (diferente do shadow mode, fire-and-forget e sempre
 * depois). Nunca lança: qualquer erro ou timeout cai em baseline.
 *
 * Escopo deliberadamente igual ao do shadow mode (adendo/Fase 3): não
 * re-executa o algoritmo de seleção de candidatos contra o Active V2, só
 * substitui os dados de set (item/ability/nature/moves) dos Pokémon que o
 * baseline já escolheu, quando existir exatamente um set ativo
 * correspondente — em caso de lacuna de cobertura ou ambiguidade, mantém o
 * dado do baseline para aquele Pokémon específico.
 */
export async function resolveActiveV2RuntimeServe(
  connection: mongoose.Connection,
  input: ActiveV2RuntimeServeInput
): Promise<ActiveV2RuntimeServeResult> {
  if (input.format !== ACTIVE_V2_COVERED_FORMAT) return baselineResult();
  if (resolveActiveV2RuntimeServeMode() !== 'active-v2-serve') return baselineResult();

  const startedAt = Date.now();
  const timeoutResult = new Promise<ActiveV2RuntimeServeResult>(resolve => {
    setTimeout(() => resolve(fallbackTelemetryResult(input, startedAt, 'v2-timeout')), V2_SERVE_TIMEOUT_MS);
  });

  try {
    return await Promise.race([resolveActiveV2RuntimeServeInternal(connection, input, startedAt), timeoutResult]);
  } catch (error) {
    console.warn('[Equinox] Active V2 runtime serve failed (ignored, baseline usado):', error);
    return fallbackTelemetryResult(input, startedAt, 'v2-error');
  }
}

/**
 * Grava o evento de telemetria — sempre fire-and-forget, sempre depois da
 * resposta já ter sido enviada, mesmo quando `resolveActiveV2RuntimeServe`
 * rodou antes da resposta para decidir se hidratava os dados.
 */
export async function writeActiveV2RuntimeServeTelemetry(
  connection: mongoose.Connection,
  event: ActiveV2RuntimeTelemetryEvent
): Promise<void> {
  const db = connection.db;
  if (!db) return;
  await db.collection(TELEMETRY_COLLECTION).insertOne(event as any);
}
