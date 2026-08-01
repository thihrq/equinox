import { PokemonType } from './TeamDefensiveProfile';
import { DefensiveCapability, StrategicCapability } from './CandidateCapabilityClassifier';
import { FinalistRejectionAggregate } from './FinalistRejectionAggregator';

export interface RecoveryCapabilityRequest {
  capability: DefensiveCapability | StrategicCapability;
  attackType?: PokemonType;
  priority: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  minimumDistinctAnswers: number;
  desiredDistinctAnswers: number;
  appliesTo: 'SINGLE_TARGET' | 'SPREAD' | 'BOTH';
  evidenceReasonCodes: readonly string[];
}

export interface RecoveryCapabilityPlan {
  strategyId: string;

  eligible: boolean;
  eligibilityReasons: readonly string[];
  ineligibilityReasons: readonly string[];

  requests: readonly RecoveryCapabilityRequest[];

  maximumPasses: number;
  maximumAdditionalRawCandidates: number;
  maximumAdditionalUsableCandidates: number;

  sourceLimitations: readonly string[];
}

export function deriveRecoveryCapabilityPlan(
  aggregate: FinalistRejectionAggregate,
  context: {
    parityValid?: boolean;
    hasIllegalLead?: boolean;
    hasInvalidFormat?: boolean;
  } = {},
): RecoveryCapabilityPlan {
  const eligibilityReasons: string[] = [];
  const ineligibilityReasons: string[] = [];
  const requests: RecoveryCapabilityRequest[] = [];

  // 1. Checar inelegibilidades fatais
  if (context.hasIllegalLead) {
    ineligibilityReasons.push('ILLEGAL_LEAD');
  }
  if (context.hasInvalidFormat) {
    ineligibilityReasons.push('INVALID_FORMAT');
  }
  if (context.parityValid === false) {
    ineligibilityReasons.push('CANDIDATE_SOURCE_PARITY_INVALID');
  }
  if (aggregate.acceptedFinalists > 0) {
    ineligibilityReasons.push('PRIMARY_SEARCH_SUCCEEDED');
  }

  const provisionallyEligible = ineligibilityReasons.length === 0;

  if (provisionallyEligible) {
    eligibilityReasons.push('PRIMARY_SEARCH_EXHAUSTED_QUALITY_GATES');

    // Mapear razões para solicitações de capacidade
    for (const reasonAgg of aggregate.failuresByReason) {
      if (reasonAgg.reasonCode === 'UNANSWERED_REPEATED_WEAKNESS' && reasonAgg.attackType) {
        requests.push({
          capability: 'TYPE_RESISTANCE',
          attackType: reasonAgg.attackType,
          priority: 'CRITICAL',
          minimumDistinctAnswers: 1,
          desiredDistinctAnswers: 2,
          appliesTo: 'BOTH',
          evidenceReasonCodes: ['UNANSWERED_REPEATED_WEAKNESS'],
        });
        requests.push({
          capability: 'SAFE_SWITCH_IN',
          attackType: reasonAgg.attackType,
          priority: 'HIGH',
          minimumDistinctAnswers: 1,
          desiredDistinctAnswers: 2,
          appliesTo: 'BOTH',
          evidenceReasonCodes: ['UNANSWERED_REPEATED_WEAKNESS'],
        });
      } else if (reasonAgg.reasonCode === 'NO_DEFENSIVE_SWITCH_IN' && reasonAgg.attackType) {
        requests.push({
          capability: 'SAFE_SWITCH_IN',
          attackType: reasonAgg.attackType,
          priority: 'HIGH',
          minimumDistinctAnswers: 1,
          desiredDistinctAnswers: 2,
          appliesTo: 'BOTH',
          evidenceReasonCodes: ['NO_DEFENSIVE_SWITCH_IN'],
        });
      } else if (reasonAgg.reasonCode === 'CRITICAL_SPREAD_EXPOSURE' && reasonAgg.attackType) {
        requests.push({
          capability: 'SPREAD_MOVE_MITIGATION',
          attackType: reasonAgg.attackType,
          priority: 'HIGH',
          minimumDistinctAnswers: 1,
          desiredDistinctAnswers: 1,
          appliesTo: 'SPREAD',
          evidenceReasonCodes: ['CRITICAL_SPREAD_EXPOSURE'],
        });
      } else if (reasonAgg.reasonCode === 'INSUFFICIENT_ROLE_COVERAGE') {
        requests.push({
          capability: 'POSITIONING',
          priority: 'MODERATE',
          minimumDistinctAnswers: 1,
          desiredDistinctAnswers: 1,
          appliesTo: 'BOTH',
          evidenceReasonCodes: ['INSUFFICIENT_ROLE_COVERAGE'],
        });
      }
    }
  }

  // Deduplicação e priorização de requisições
  const deduplicatedRequests: RecoveryCapabilityRequest[] = [];
  const seenMap = new Set<string>();

  for (const req of requests) {
    const key = `${req.capability}_${req.attackType || 'none'}_${req.appliesTo}`;
    if (!seenMap.has(key)) {
      seenMap.add(key);
      deduplicatedRequests.push(req);
    }
  }

  // Limite máximo de 6 solicitações por estratégia
  const truncatedRequests = deduplicatedRequests.slice(0, 6);

  // Invariante: `eligible` nunca pode ser `true` com `requests` vazio.
  //
  // Um plano provisoriamente elegível (nenhuma inelegibilidade fatal) mas sem
  // nenhuma capability request mapeada é um estado contraditório: o recovery
  // é autorizado a rodar e estruturalmente incapaz de aceitar qualquer
  // candidato, porque o filtro de correspondência é `requests.some(...)`, que
  // é `false` para todo candidato quando `requests` está vazio. Isso gastava
  // passes do orçamento global sem produzir nenhum efeito (achado real da
  // investigação 087-E, estratégia `sun_offense`: 2 passes consumidos, 0
  // candidatos alcançando o builder).
  if (provisionallyEligible && truncatedRequests.length === 0) {
    ineligibilityReasons.push('NO_CAPABILITY_REQUESTS_DERIVED');
  }

  const eligible = ineligibilityReasons.length === 0;

  return {
    strategyId: aggregate.strategyId,
    eligible,
    eligibilityReasons,
    ineligibilityReasons,
    requests: truncatedRequests,
    maximumPasses: 2,
    maximumAdditionalRawCandidates: 60,
    maximumAdditionalUsableCandidates: 16,
    sourceLimitations: [],
  };
}
