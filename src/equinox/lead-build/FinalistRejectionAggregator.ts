import { PokemonType } from './TeamDefensiveProfile';
import { FinalistDecisionTrace } from './FinalistDecisionTrace';

export interface RejectionReasonAggregate {
  reasonCode: string;
  count: number;
  attackType?: PokemonType;
  capability?: string;
  gate?: string;
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
  const failuresByReasonMap = new Map<string, { count: number; attackType?: PokemonType; gate?: string; keys: Set<string> }>();
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

        // Processar razões de falha dentro do gate
        const uniqueReasonsInGate = new Set(gTrace.reasons);
        for (const rawReason of uniqueReasonsInGate) {
          let reasonCode = rawReason;
          let attackType: PokemonType | undefined = undefined;

          if (rawReason.includes(':')) {
            const parts = rawReason.split(':');
            reasonCode = parts[0];
            const candidateType = parts[1] as PokemonType;
            if ([
              'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
              'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
              'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
            ].includes(candidateType)) {
              attackType = candidateType;
            }
          }

          const mapKey = `${reasonCode}_${attackType || ''}_${gTrace.gate}`;
          let entry = failuresByReasonMap.get(mapKey);
          if (!entry) {
            entry = { count: 0, attackType, gate: gTrace.gate, keys: new Set() };
            failuresByReasonMap.set(mapKey, entry);
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

  const failuresByReason: RejectionReasonAggregate[] = Array.from(failuresByReasonMap.entries()).map(
    ([key, value]) => {
      const reasonCode = key.split('_')[0];
      return {
        reasonCode,
        count: value.count,
        attackType: value.attackType,
        gate: value.gate,
        finalistKeys: Array.from(value.keys),
      };
    },
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
