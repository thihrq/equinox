import type { PokemonData } from '../core/AnalysisContext';
import type { CompleteTeamCandidate } from './AnytimeSearchResult';
import type { TeamCompositionPlan } from './TeamCompositionPlan';
import type { CandidateCapabilityIndex } from './CandidateCapabilityIndex';
import type { LeadBuildRequestContext } from './LeadBuildRequestContext';
import { scoreCandidateForStrategy } from '../scoring/LeadStrategyCandidateScore';
import { evaluatePartialTeamDefensiveQuality } from './PartialTeamDefensiveEvaluator';

export interface FirstCompleteTeamBuilderInput {
  lead: readonly PokemonData[];
  candidates: readonly PokemonData[];
  strategy?: any;
  compositionPlan?: TeamCompositionPlan;
  candidateCapabilityIndex?: CandidateCapabilityIndex;
  requestContext?: LeadBuildRequestContext;
  format?: string;
  /**
   * Experimental (default false, sem efeito em produção hoje): quando
   * true, subtrai do score de cada candidato a penalidade de
   * `evaluatePartialTeamDefensiveQuality` para o time parcial resultante
   * de escolhê-lo, fazendo o builder preferir candidatos que reduzam o
   * empilhamento de fraqueza elemental sem resposta. Ver
   * docs/superpowers/specs/2026-08-02-weakness-stacking-penalty-experiment-design.md.
   */
  applyWeaknessPenalty?: boolean;
}

export class FirstCompleteTeamBuilder {
  public build(input: FirstCompleteTeamBuilderInput): CompleteTeamCandidate | null {
    const { lead, candidates, strategy, compositionPlan, candidateCapabilityIndex, requestContext, format = 'champions_reg_m_b_doubles', applyWeaknessPenalty = false } = input;
    if (lead.length !== 2) return null;

    if (requestContext?.invocationCounters) {
      requestContext.invocationCounters.firstCompleteTeamBuilderInvocationCount += 1;
    }

    const chosen: PokemonData[] = [...lead];
    const speciesClauseKeys = new Set<string>();
    const itemKeys = new Set<string>();

    for (const member of lead) {
      speciesClauseKeys.add(member.name.toLowerCase());
      if (member.item) itemKeys.add(member.item.toLowerCase());
    }

    const pool = [...candidates];

    while (chosen.length < 6 && pool.length > 0) {
      // Ordenar dinamicamente o pool restante pelo score de estrategia relativo ao time parcial `chosen`
      pool.sort((a, b) => {
        const scoreA = strategy ? scoreCandidateForStrategy(a, strategy, chosen, format) : 0;
        const scoreB = strategy ? scoreCandidateForStrategy(b, strategy, chosen, format) : 0;
        const hasSetA = a.competitiveSet ? 1 : 0;
        const hasSetB = b.competitiveSet ? 1 : 0;

        const remainingSlots = 6 - chosen.length - 1;
        const penaltyA = applyWeaknessPenalty
          ? evaluatePartialTeamDefensiveQuality([...chosen, a], remainingSlots, pool).totalPenalty
          : 0;
        const penaltyB = applyWeaknessPenalty
          ? evaluatePartialTeamDefensiveQuality([...chosen, b], remainingSlots, pool).totalPenalty
          : 0;

        return (scoreB + hasSetB * 200 - penaltyB) - (scoreA + hasSetA * 200 - penaltyA) ||
          ((b as any).usageScore ?? 0) - ((a as any).usageScore ?? 0);
      });

      const next = pool.shift();
      if (!next) break;

      const specKey = next.name.toLowerCase();
      const itemKey = next.item ? next.item.toLowerCase() : undefined;

      if (speciesClauseKeys.has(specKey)) continue;
      if (itemKey && itemKeys.has(itemKey)) continue;

      chosen.push(next);
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
