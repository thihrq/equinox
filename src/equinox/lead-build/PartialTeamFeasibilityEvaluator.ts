import type { PokemonData } from '../core/AnalysisContext';

export type HardPruneReason =
  | 'DUPLICATE_ITEM'
  | 'DUPLICATE_SPECIES'
  | 'MULTIPLE_MEGAS'
  | 'EXCEEDED_SLOT_CAPACITY';

export type PartialFeasibilityDecision =
  | {
      kind: 'FEASIBLE';
      penalties: { reason: string; penaltyScore: number }[];
    }
  | {
      kind: 'HARD_PRUNE';
      reasons: HardPruneReason[];
      proof: { detail: string };
    };

export class PartialTeamFeasibilityEvaluator {
  public evaluate(members: readonly PokemonData[]): PartialFeasibilityDecision {
    const speciesSeen = new Set<string>();
    const itemsSeen = new Set<string>();
    let megaCount = 0;

    for (const m of members) {
      const spec = m.name.toLowerCase();
      if (speciesSeen.has(spec)) {
        return {
          kind: 'HARD_PRUNE',
          reasons: ['DUPLICATE_SPECIES'],
          proof: { detail: `Espécie duplicada detectada: ${m.name}` },
        };
      }
      speciesSeen.add(spec);

      if (m.item) {
        const itemKey = m.item.toLowerCase();
        if (itemsSeen.has(itemKey)) {
          return {
            kind: 'HARD_PRUNE',
            reasons: ['DUPLICATE_ITEM'],
            proof: { detail: `Item duplicado detectado: ${m.item}` },
          };
        }
        itemsSeen.add(itemKey);

        if (m.item.toLowerCase().includes('ite')) {
          megaCount += 1;
        }
      }
    }

    if (megaCount > 1) {
      return {
        kind: 'HARD_PRUNE',
        reasons: ['MULTIPLE_MEGAS'],
        proof: { detail: `Múltiplos Pokémon Mega Evolved detectados: ${megaCount}` },
      };
    }

    if (members.length > 6) {
      return {
        kind: 'HARD_PRUNE',
        reasons: ['EXCEEDED_SLOT_CAPACITY'],
        proof: { detail: `Número de membros excedeu 6: ${members.length}` },
      };
    }

    return {
      kind: 'FEASIBLE',
      penalties: [],
    };
  }
}
