import type { PokemonData } from '../core/AnalysisContext';
import type { CandidateCapabilityIndex } from './CandidateCapabilityIndex';

export interface RecoveryGapResolution {
  resolvedCandidates: readonly PokemonData[];
  capabilitiesCovered: readonly string[];
}

export class RecoveryCapabilityGapResolver {
  public resolve(
    targetCapabilities: readonly string[],
    index: CandidateCapabilityIndex,
    usedKeys: ReadonlySet<string>,
  ): RecoveryGapResolution {
    const resolved: PokemonData[] = [];
    const covered = new Set<string>();

    for (const cap of targetCapabilities) {
      const candidates = index.findByCapability(cap);
      for (const c of candidates) {
        const key = `${c.name}_${c.item ?? ''}`;
        if (!usedKeys.has(key)) {
          resolved.push(c);
          covered.add(cap);
          break;
        }
      }
    }

    return {
      resolvedCandidates: resolved,
      capabilitiesCovered: Array.from(covered),
    };
  }
}
