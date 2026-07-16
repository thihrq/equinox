import {
  ACTIVE_V2_COST_PROJECTION_TARGET_PERCENTAGES,
  type ActiveV2MongoCostRates,
  type ActiveV2MongoIoProfile,
} from './ActiveV2CostProjectionPolicy';

/**
 * Base de tráfego observada: no shadow mode (Fase 3) o volume observado já
 * representa 100% do tráfego elegível (todo request de formato coberto é
 * avaliado, sem seleção percentual). No canário percentual (Fases 6-9), o
 * volume observado representa apenas `currentPercentage`% do tráfego
 * elegível total — a projeção precisa reescalar a partir disso.
 */
export type ActiveV2CostProjectionTrafficBasis =
  | { kind: 'shadow-full-traffic' }
  | { kind: 'percentage'; currentPercentage: number };

export interface ActiveV2CostProjectionInput {
  windowStartedAt: string;
  windowEndedAt: string;
  evaluatedRequestCount: number;
  trafficBasis: ActiveV2CostProjectionTrafficBasis;
  ioProfile: ActiveV2MongoIoProfile;
  /** Sobrescreve `ioProfile.defaultSuggestedTeamSize` quando o time observado tiver outro tamanho. */
  suggestedTeamSize?: number;
  /** Tarifa real do Atlas — omitida por padrão (ver ActiveV2MongoCostRates). Sem ela, só operações são projetadas, nunca dinheiro. */
  costRates?: ActiveV2MongoCostRates;
}

export interface ActiveV2CostProjectionPerPercentage {
  targetPercentage: number;
  projectedEvaluatedRequests: number;
  projectedMongoReads: number;
  projectedMongoWrites: number;
  estimatedCost: { amount: number; currency: string } | null;
}

export interface ActiveV2CostProjectionResult {
  windowStartedAt: string;
  windowEndedAt: string;
  observedEvaluatedRequestCount: number;
  estimatedFullEligibleTrafficForWindow: number;
  readsPerEvaluatedRequest: number;
  writesPerEvaluatedRequest: number;
  readsPerThousandRequests: number;
  writesPerThousandRequests: number;
  costPerThousandRequests: { amount: number; currency: string } | null;
  projections: ActiveV2CostProjectionPerPercentage[];
  costRatesProvided: boolean;
}

/**
 * Projeta operações Mongo (e, opcionalmente, custo em dinheiro) para os
 * percentuais padrão de rollout (5/10/25/50/100%) a partir de um volume de
 * requisições avaliadas realmente observado na telemetria. Função pura —
 * não lê nada, não conhece Atlas nem Render; é só aritmética sobre o
 * perfil de I/O declarado e o tráfego observado. A conversão para dinheiro
 * só ocorre se `costRates` for explicitamente fornecido pelo chamador com
 * uma tarifa real — nunca com um valor padrão inventado.
 *
 * Cobre apenas operações Mongo. CPU, memória, logs e billing de Render
 * ficam fora do escopo desta função — exigem acesso real à infraestrutura,
 * que este ambiente não tem (ver runbook, seção de monitoramento de custo).
 */
export function projectActiveV2MongoOperationsCost(
  input: ActiveV2CostProjectionInput
): ActiveV2CostProjectionResult {
  const { trafficBasis, ioProfile, evaluatedRequestCount, costRates } = input;
  const suggestedTeamSize = input.suggestedTeamSize ?? ioProfile.defaultSuggestedTeamSize;

  if (suggestedTeamSize <= 0) {
    throw new Error('COST_PROJECTION_INVALID: suggestedTeamSize deve ser maior que zero.');
  }
  if (evaluatedRequestCount < 0) {
    throw new Error('COST_PROJECTION_INVALID: evaluatedRequestCount nao pode ser negativo.');
  }

  const readsPerEvaluatedRequest =
    ioProfile.configReadsPerEvaluatedRequest + ioProfile.setReadsPerSuggestedPokemon * suggestedTeamSize;
  const writesPerEvaluatedRequest = ioProfile.telemetryWritesPerEvaluatedRequest;

  let estimatedFullEligibleTrafficForWindow: number;
  if (trafficBasis.kind === 'shadow-full-traffic') {
    estimatedFullEligibleTrafficForWindow = evaluatedRequestCount;
  } else {
    if (trafficBasis.currentPercentage <= 0 || trafficBasis.currentPercentage > 100) {
      throw new Error('COST_PROJECTION_INVALID: currentPercentage deve estar entre 0 (exclusivo) e 100.');
    }
    estimatedFullEligibleTrafficForWindow = evaluatedRequestCount / (trafficBasis.currentPercentage / 100);
  }

  function costFor(reads: number, writes: number): { amount: number; currency: string } | null {
    if (!costRates) return null;
    const amount = (reads / 1000) * costRates.costPerThousandReads + (writes / 1000) * costRates.costPerThousandWrites;
    return { amount, currency: costRates.currency };
  }

  const projections: ActiveV2CostProjectionPerPercentage[] = ACTIVE_V2_COST_PROJECTION_TARGET_PERCENTAGES.map(
    targetPercentage => {
      const projectedEvaluatedRequests = estimatedFullEligibleTrafficForWindow * (targetPercentage / 100);
      const projectedMongoReads = projectedEvaluatedRequests * readsPerEvaluatedRequest;
      const projectedMongoWrites = projectedEvaluatedRequests * writesPerEvaluatedRequest;
      return {
        targetPercentage,
        projectedEvaluatedRequests,
        projectedMongoReads,
        projectedMongoWrites,
        estimatedCost: costFor(projectedMongoReads, projectedMongoWrites),
      };
    }
  );

  return {
    windowStartedAt: input.windowStartedAt,
    windowEndedAt: input.windowEndedAt,
    observedEvaluatedRequestCount: evaluatedRequestCount,
    estimatedFullEligibleTrafficForWindow,
    readsPerEvaluatedRequest,
    writesPerEvaluatedRequest,
    readsPerThousandRequests: readsPerEvaluatedRequest * 1000,
    writesPerThousandRequests: writesPerEvaluatedRequest * 1000,
    costPerThousandRequests: costFor(readsPerEvaluatedRequest * 1000, writesPerEvaluatedRequest * 1000),
    projections,
    costRatesProvided: costRates !== undefined,
  };
}
