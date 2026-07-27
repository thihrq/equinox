import type { PokemonData } from '../core/AnalysisContext';
import type { CompleteTeamCandidate } from './AnytimeSearchResult';

export interface FirstCompleteTeamBuilderInput {
  lead: readonly PokemonData[];
  candidates: readonly PokemonData[];
}

export class FirstCompleteTeamBuilder {
  public build(input: FirstCompleteTeamBuilderInput): CompleteTeamCandidate | null {
    const { lead, candidates } = input;
    if (lead.length !== 2) return null;

    const chosen: PokemonData[] = [...lead];
    const speciesClauseKeys = new Set<string>();
    const itemKeys = new Set<string>();

    for (const member of lead) {
      speciesClauseKeys.add(member.name.toLowerCase());
      if (member.item) itemKeys.add(member.item.toLowerCase());
    }

    const sortedCandidates = [...candidates].sort((a, b) =>
      ((b as any).usageScore ?? 0) - ((a as any).usageScore ?? 0) ||
      a.name.localeCompare(b.name) ||
      (a.item ?? '').localeCompare(b.item ?? '')
    );

    for (const c of sortedCandidates) {
      if (chosen.length >= 6) break;

      const specKey = c.name.toLowerCase();
      const itemKey = c.item ? c.item.toLowerCase() : undefined;

      if (speciesClauseKeys.has(specKey)) continue;
      if (itemKey && itemKeys.has(itemKey)) continue;

      chosen.push(c);
      speciesClauseKeys.add(specKey);
      if (itemKey) itemKeys.add(itemKey);
    }

    if (chosen.length < 6) return null;

    return {
      members: chosen,
      legalityPrecheckPassed: true,
      structuralCompletenessPassed: true,
      compositionCoverageScore: 100,
      speciesIds: Array.from(speciesClauseKeys),
      itemIds: Array.from(itemKeys),
    };
  }
}
