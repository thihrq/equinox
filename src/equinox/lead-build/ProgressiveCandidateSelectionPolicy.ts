import type { PokemonData } from '../core/AnalysisContext';

export interface ProgressiveCandidateSelectionPolicyOptions {
  targetInitialCount?: number;
  maxTargetCount?: number;
}

export class ProgressiveCandidateSelectionPolicy {
  private readonly targetInitialCount: number;
  private readonly maxTargetCount: number;

  constructor(options?: ProgressiveCandidateSelectionPolicyOptions) {
    this.targetInitialCount = options?.targetInitialCount ?? 24;
    this.maxTargetCount = options?.maxTargetCount ?? 40;
  }

  public selectDiverseBatch(candidates: readonly PokemonData[]): PokemonData[] {
    if (candidates.length <= this.targetInitialCount) {
      return [...candidates];
    }

    const selected: PokemonData[] = [];
    const selectedKeys = new Set<string>();

    const getBucket = (p: PokemonData): string => {
      const moves = p.moves?.map(m => m.toLowerCase()) ?? [];
      const ability = p.ability?.toLowerCase() ?? '';
      if (moves.includes('fake out') || moves.includes('follow me') || moves.includes('rage powder')) {
        return 'redirection_support';
      }
      if (moves.includes('tailwind') || moves.includes('trick room')) {
        return 'speed_control';
      }
      if (ability.includes('surge') || ability.includes('drizzle') || ability.includes('drought') || ability.includes('sand stream')) {
        return 'field_abuser';
      }
      const stats = (p as any).stats ?? (p.variants?.[0]?.baseStats);
      if (stats && (stats.def ?? 0) + (stats.spd ?? 0) > 190) {
        return 'defensive_pivot';
      }
      return 'attacker';
    };

    const buckets = new Map<string, PokemonData[]>();
    for (const c of candidates) {
      const key = getBucket(c);
      const list = buckets.get(key) ?? [];
      list.push(c);
      buckets.set(key, list);
    }

    while (selected.length < this.targetInitialCount) {
      let addedInRound = false;
      for (const [_, list] of buckets) {
        if (list.length > 0 && selected.length < this.targetInitialCount) {
          const item = list.shift()!;
          const itemKey = `${item.name}_${item.item ?? ''}`;
          if (!selectedKeys.has(itemKey)) {
            selectedKeys.add(itemKey);
            selected.push(item);
            addedInRound = true;
          }
        }
      }
      if (!addedInRound) break;
    }

    if (selected.length < this.targetInitialCount) {
      const remaining = candidates.filter(c => !selectedKeys.has(`${c.name}_${c.item ?? ''}`));
      remaining.sort((a, b) =>
        ((b as any).usageScore ?? 0) - ((a as any).usageScore ?? 0) ||
        a.name.localeCompare(b.name)
      );
      for (const r of remaining) {
        if (selected.length >= this.targetInitialCount) break;
        selected.push(r);
      }
    }

    return selected;
  }
}
