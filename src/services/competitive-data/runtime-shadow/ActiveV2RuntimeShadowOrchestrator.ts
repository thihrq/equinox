import mongoose from 'mongoose';
import * as crypto from 'crypto';
import { readActiveV2CanaryConfig } from '../runtime-control/ActiveV2CanaryConfigStore';
import { readActiveV2RuntimeControl } from '../runtime-control/ActiveV2RuntimeControlStore';
import { resolveActiveV2RuntimeDecision } from '../runtime-control/ActiveV2RuntimeDecisionResolver';
import { compareBaselineAndV2Set, classifyActiveV2ShadowComparisons } from './ActiveV2ShadowSetComparator';
import { ALLOWED_TARGET_COLLECTION } from '../publication/ActiveV2ProductionPolicy';
import type { ActiveV2RuntimeShadowInput } from './ActiveV2RuntimeShadowTypes';
import type { ActiveV2RuntimeTelemetryEvent } from '../runtime-observability/ActiveV2RuntimeTelemetryTypes';

/**
 * Deve permanecer em sincronia com o terceiro argumento de
 * `mongoose.model(...)` em `src/models/ActiveV2RuntimeTelemetryEvent.ts`.
 * Escrita via coleção bruta (não via o model Mongoose) para manter o mesmo
 * padrão de testabilidade offline (conexão mockada) usado em todo o resto
 * do pipeline Active V2 nesta sessão.
 */
const TELEMETRY_COLLECTION = 'active_v2_runtime_telemetry';

/** Único formato coberto pelos dados Active V2 hoje — ver roster.json/regulation.json. */
const ACTIVE_V2_COVERED_FORMAT = 'champions_reg_m_b_doubles';

/**
 * Interruptor estático, independente do Mongo. Enquanto desligado (padrão),
 * este caminho tem ZERO interação com o banco em qualquer requisição — não
 * basta o canário estar em `shadow` no Mongo, esta flag de deploy também
 * precisa estar ligada. Isso dá um kill-switch que não depende do mesmo
 * armazenamento que se está tentando desligar, e evita gastar leituras de
 * Mongo em toda requisição do formato coberto enquanto a feature nem está
 * habilitada para uso.
 */
const RUNTIME_SHADOW_ENABLED_FLAG = 'EQUINOX_ACTIVE_V2_RUNTIME_SHADOW_ENABLED';

/**
 * Fase 3 — Runtime Shadow Mode. Chamada em fire-and-forget DEPOIS que a
 * resposta já foi enviada ao usuário (ver `TeamController.suggest`): nunca
 * pode afetar o que o usuário recebe, só observar.
 *
 * Escopo deliberadamente reduzido: NÃO re-executa o algoritmo de seleção de
 * candidatos contra o Active V2 (isso exigiria clonar o pipeline de
 * `TeamService.suggestComplements` inteiro, e a cobertura de dados V2 hoje
 * — 14 sets — tornaria a maior parte das comparações inúteis por falta de
 * cobertura). Em vez disso, compara os DADOS DE SET (item/ability/nature/
 * moves) dos Pokémon que o baseline já escolheu contra o set ativo
 * correspondente em `pokemonsets_v2`, quando existir. Isso testa
 * exatamente o que a governança Active V2 até aqui sempre validou —
 * fidelidade de dados de set — sem tocar no algoritmo de recomendação.
 *
 * Só executa quando, em ordem (do mais barato para o mais caro, para
 * minimizar leituras de Mongo no caso comum de a feature estar desligada):
 * 1. o formato da requisição é o único coberto por V2 (sem Mongo);
 * 2. `EQUINOX_ACTIVE_V2_RUNTIME_SHADOW_ENABLED=true` (sem Mongo);
 * 3. o modo de canário é `shadow` (1 leitura de Mongo);
 * 4. a cadeia de precedência completa aprova (circuit breaker, FORCE_BASELINE
 *    estático — mais 1 leitura de Mongo, só chega aqui se o passo 3 já
 *    indicou `shadow`).
 */
export async function runActiveV2RuntimeShadow(
  connection: mongoose.Connection,
  input: ActiveV2RuntimeShadowInput
): Promise<void> {
  if (input.format !== ACTIVE_V2_COVERED_FORMAT) {
    return;
  }

  if (process.env[RUNTIME_SHADOW_ENABLED_FLAG] !== 'true') {
    return;
  }

  const startedAt = Date.now();

  const canaryConfig = await readActiveV2CanaryConfig(connection);
  if (canaryConfig.mode !== 'shadow') {
    return;
  }

  const circuitBreaker = await readActiveV2RuntimeControl(connection);

  const decision = resolveActiveV2RuntimeDecision({
    circuitBreaker,
    staticForceBaseline: process.env.EQUINOX_ACTIVE_V2_FORCE_BASELINE === 'true',
    canaryConfig,
    identifier: input.requestId,
    isAuthorizedInternalCanaryRequest: false,
    perRequestFallbackRequested: false,
  });

  if (!decision.shadowParallelEvaluation) {
    return;
  }

  const db = connection.db;
  if (!db) {
    return;
  }

  const setsCol = db.collection<any>(ALLOWED_TARGET_COLLECTION);

  const comparisons = await Promise.all(
    input.primaryTeamSuggestedPokemons.map(async suggested => {
      let v2Docs: any[] = [];
      try {
        v2Docs = await setsCol
          .find({ pokemonName: suggested.name, formatId: ACTIVE_V2_COVERED_FORMAT, active: true })
          .toArray();
      } catch (error) {
        console.warn(`[Equinox] Active V2 shadow: failed to read pokemonsets_v2 for ${suggested.name} (ignored):`, error);
        v2Docs = [];
      }

      const v2Set = v2Docs[0] ?? null;
      return compareBaselineAndV2Set(
        suggested,
        v2Set ? { item: v2Set.item, ability: v2Set.ability, nature: v2Set.nature, moves: v2Set.moves } : null
      );
    })
  );

  const { classification, fallbackTriggered } = classifyActiveV2ShadowComparisons(comparisons);
  const v2LatencyMs = Date.now() - startedAt;

  const event: ActiveV2RuntimeTelemetryEvent = {
    eventId: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    requestId: input.requestId,
    format: input.format,
    teamIdentity: input.teamIdentity,
    // `/api/team/suggest` não calcula um arquétipo tático (isso é um conceito
    // do fluxo de lead da VGC) — sem dado real para reportar aqui.
    archetype: 'unknown',
    publishRunId: null,
    activeV2DataDigest: null,
    baseline: { outcome: 'success', latencyMs: input.baselineLatencyMs },
    v2: {
      outcome: 'success',
      latencyMs: v2LatencyMs,
      fallbackTriggered,
      fallbackReason: fallbackTriggered ? 'no-v2-data' : null,
    },
    comparison: { classification, scoreDelta: null },
  };

  try {
    await db.collection(TELEMETRY_COLLECTION).insertOne(event as any);
  } catch (error) {
    console.warn('[Equinox] Active V2 shadow: failed to write telemetry event (ignored):', error);
  }
}
