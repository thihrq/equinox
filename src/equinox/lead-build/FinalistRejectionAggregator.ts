import { PokemonType } from './TeamDefensiveProfile';
import { FinalistDecisionTrace } from './FinalistDecisionTrace';
import {
  StructuredGateReason,
  OffensivePressureMetadata,
  OffensiveCoverageMetadata,
} from './StrategyQualityDiagnostics';

export type RejectionReasonMetadata = OffensivePressureMetadata | OffensiveCoverageMetadata;

export interface RejectionReasonAggregate {
  reasonCode: string;
  count: number;
  attackType?: PokemonType;
  capability?: string;
  gate?: string;
  metadata?: RejectionReasonMetadata;
  finalistKeys: readonly string[];
}

export interface FinalistRejectionAggregate {
  strategyId: string;

  evaluatedFinalists: number;
  acceptedFinalists: number;
  rejectedFinalists: number;

  legalCompleteFinalists: number;
  defensivelyValidFinalists: number;
  offensivelyValidFinalists: number;
  setCoherentFinalists: number;

  failuresByGate: Readonly<Record<string, number>>;
  failuresByReason: readonly RejectionReasonAggregate[];
  failuresByAttackType: Readonly<Partial<Record<PokemonType, number>>>;

  dominantFailureReasons: readonly string[];
}

const CANONICAL_ATTACK_TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
  'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
];

function isPressureMetadata(metadata: RejectionReasonMetadata): metadata is OffensivePressureMetadata {
  return 'primaryPressure' in metadata;
}

function isCoverageMetadata(metadata: RejectionReasonMetadata): metadata is OffensiveCoverageMetadata {
  return 'offensiveTypesPresent' in metadata;
}

/**
 * Assinatura explícita de deduplicação — nunca `JSON.stringify` de objeto
 * arbitrário. Cada reasonCode com metadata estruturada tem sua própria
 * chave semântica; os demais (sem metadata) caem na chave legada
 * (reasonCode + attackType + gate), preservando o comportamento anterior.
 */
function buildReasonMetadataKey(
  reasonCode: string,
  gate: string,
  metadata: RejectionReasonMetadata | undefined,
  attackType: PokemonType | undefined,
): string {
  if (metadata && isPressureMetadata(metadata)) {
    return `${reasonCode}|${gate}|deficient=${metadata.deficientSides.join(',')}|strongest=${metadata.strongestSide}`;
  }
  if (metadata && isCoverageMetadata(metadata)) {
    return `${reasonCode}|${gate}|present=${[...metadata.offensiveTypesPresent].sort().join(',')}`;
  }
  return `${reasonCode}_${attackType || ''}_${gate}`;
}

/** Menor primaryPressure = déficit pior (mais longe do mínimo exigido). */
function isWorsePressure(candidate: OffensivePressureMetadata, current: OffensivePressureMetadata): boolean {
  return candidate.primaryPressure < current.primaryPressure;
}

/** Menos tipos presentes = déficit pior (cobertura mais estreita). */
function isWorseCoverage(candidate: OffensiveCoverageMetadata, current: OffensiveCoverageMetadata): boolean {
  return candidate.offensiveTypesPresent.length < current.offensiveTypesPresent.length;
}

function isWorseMetadata(candidate: RejectionReasonMetadata, current: RejectionReasonMetadata): boolean {
  if (isPressureMetadata(candidate) && isPressureMetadata(current)) {
    return isWorsePressure(candidate, current);
  }
  if (isCoverageMetadata(candidate) && isCoverageMetadata(current)) {
    return isWorseCoverage(candidate, current);
  }
  return false;
}

export function aggregateFinalistRejections(
  strategyId: string,
  traces: readonly FinalistDecisionTrace[],
): FinalistRejectionAggregate {
  let acceptedFinalists = 0;
  let rejectedFinalists = 0;

  let legalCompleteFinalists = 0;
  let defensivelyValidFinalists = 0;
  let offensivelyValidFinalists = 0;
  let setCoherentFinalists = 0;

  const failuresByGateMap: Record<string, number> = {};
  const failuresByReasonMap = new Map<string, {
    reasonCode: string;
    count: number;
    attackType?: PokemonType;
    gate?: string;
    metadata?: RejectionReasonMetadata;
    keys: Set<string>;
  }>();
  const failuresByAttackTypeMap: Partial<Record<PokemonType, number>> = {};

  for (const trace of traces) {
    if (trace.valid) {
      acceptedFinalists++;
    } else {
      rejectedFinalists++;
    }

    let isLegalComplete = true;
    let isDefensiveValid = true;
    let isOffensiveValid = true;
    let isSetCoherent = true;

    const failedGatesInTrace = new Set<string>();

    for (const gTrace of trace.gates) {
      if (!gTrace.valid) {
        failedGatesInTrace.add(gTrace.gate);

        if (gTrace.gate === 'Legality' || gTrace.gate === 'StrategyCompleteness') {
          isLegalComplete = false;
        }
        if (gTrace.gate === 'DefensiveQuality') {
          isDefensiveValid = false;
        }
        if (gTrace.gate === 'OffensiveQuality' || gTrace.gate === 'RoleCoverage') {
          isOffensiveValid = false;
        }
        if (gTrace.gate === 'SetCoherence') {
          isSetCoherent = false;
        }

        // Processar razões de falha dentro do gate — deduplicado por
        // reasonCode (cada reasonCode aparece no máximo uma vez por gate,
        // por construção de FullTeamAcceptanceDecision/evaluateStrategyQuality).
        const seenReasonCodes = new Set<string>();
        for (const structuredReason of gTrace.reasons as readonly StructuredGateReason[]) {
          if (seenReasonCodes.has(structuredReason.reasonCode)) continue;
          seenReasonCodes.add(structuredReason.reasonCode);

          let reasonCode = structuredReason.reasonCode;
          let attackType: PokemonType | undefined = undefined;

          if (reasonCode.includes(':')) {
            const parts = reasonCode.split(':');
            reasonCode = parts[0];
            const candidateType = parts[1] as PokemonType;
            if (CANONICAL_ATTACK_TYPES.includes(candidateType)) {
              attackType = candidateType;
            }
          }

          const metadata = structuredReason.metadata as RejectionReasonMetadata | undefined;
          const mapKey = buildReasonMetadataKey(reasonCode, gTrace.gate, metadata, attackType);

          let entry = failuresByReasonMap.get(mapKey);
          if (!entry) {
            entry = { reasonCode, count: 0, attackType, gate: gTrace.gate, metadata, keys: new Set() };
            failuresByReasonMap.set(mapKey, entry);
          } else if (metadata && entry.metadata && isWorseMetadata(metadata, entry.metadata)) {
            // Preserva como representante o pior déficit observado no bucket.
            entry.metadata = metadata;
          }
          entry.count++;
          entry.keys.add(trace.teamKey);

          if (attackType) {
            failuresByAttackTypeMap[attackType] = (failuresByAttackTypeMap[attackType] || 0) + 1;
          }
        }
      }
    }

    for (const failedGate of failedGatesInTrace) {
      failuresByGateMap[failedGate] = (failuresByGateMap[failedGate] || 0) + 1;
    }

    if (isLegalComplete) legalCompleteFinalists++;
    if (isDefensiveValid) defensivelyValidFinalists++;
    if (isOffensiveValid) offensivelyValidFinalists++;
    if (isSetCoherent) setCoherentFinalists++;
  }

  // `reasonCode` vem do próprio valor guardado na entrada — reconstruí-lo a
  // partir da chave composta cortava tudo após o primeiro `_`, corrompendo
  // qualquer reason code que contenha `_`, que é o caso de todos os reason
  // codes reais do planner (`UNANSWERED_REPEATED_WEAKNESS`,
  // `NO_DEFENSIVE_SWITCH_IN`, `CRITICAL_SPREAD_EXPOSURE`,
  // `INSUFFICIENT_ROLE_COVERAGE`). O resultado era um `reasonCode` truncado
  // (`UNANSWERED`) que nunca casava com nenhum branch de
  // `deriveRecoveryCapabilityPlan`, produzindo planos "elegíveis" sem
  // nenhuma capability request — a causa raiz confirmada nas investigações
  // 087-D/087-E, agora coberta por um teste que a detecta.
  const failuresByReason: RejectionReasonAggregate[] = Array.from(failuresByReasonMap.values()).map(
    value => ({
      reasonCode: value.reasonCode,
      count: value.count,
      attackType: value.attackType,
      gate: value.gate,
      metadata: value.metadata,
      finalistKeys: Array.from(value.keys),
    }),
  );

  // Ordenar deterministicamente
  failuresByReason.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.reasonCode !== b.reasonCode) return a.reasonCode.localeCompare(b.reasonCode);
    return (a.attackType || '').localeCompare(b.attackType || '');
  });

  const dominantFailureReasons = failuresByReason.slice(0, 5).map(r => r.attackType ? `${r.reasonCode}:${r.attackType}` : r.reasonCode);

  return {
    strategyId,
    evaluatedFinalists: traces.length,
    acceptedFinalists,
    rejectedFinalists,
    legalCompleteFinalists,
    defensivelyValidFinalists,
    offensivelyValidFinalists,
    setCoherentFinalists,
    failuresByGate: failuresByGateMap,
    failuresByReason,
    failuresByAttackType: failuresByAttackTypeMap,
    dominantFailureReasons,
  };
}
