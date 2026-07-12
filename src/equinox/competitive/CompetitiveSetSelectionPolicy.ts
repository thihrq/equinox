export interface CompetitiveSetSelectionInput<TSet> {
  pokemon: { pokemonId: string; formId: string; name?: string };
  requiredRole: string;
  strategy?: string;
  archetype?: string;
  regulation: string;
  teamContext?: unknown;
  candidates: TSet[];
  allowGeneratedFallback?: boolean;
}

export interface CompetitiveSetSelectionResult<TSet> {
  selectedSet?: TSet;
  alternatives: TSet[];
  confidence: number;
  reasons: string[];
  warnings: string[];
}

type CandidateShape = {
  primaryRole?: string;
  secondaryRoles?: string[];
  archetypes?: string[];
  confidence?: number;
  coherenceScore?: number;
  sourceType?: string;
  status?: string;
};

export function selectCompetitiveSet<TSet extends CandidateShape>(
  input: CompetitiveSetSelectionInput<TSet>,
): CompetitiveSetSelectionResult<TSet> {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const ranked = [...input.candidates].sort((a, b) => scoreCandidate(b, input) - scoreCandidate(a, input));
  const selectedSet = ranked[0];

  if (!selectedSet) {
    warnings.push(input.allowGeneratedFallback
      ? 'No trusted set found; generated fallback is allowed but must be shown as experimental.'
      : 'No trusted set found and generated fallback is disabled.');
    return { alternatives: [], confidence: 0, reasons, warnings };
  }

  reasons.push(`Selected after role-first filtering for ${input.requiredRole}.`);
  if ((selectedSet.sourceType ?? '') === 'generated' || (selectedSet.confidence ?? 0) < 70) {
    warnings.push('Selected set is fallback/experimental and lowers team confidence.');
  }

  return {
    selectedSet,
    alternatives: ranked.slice(1, 4),
    confidence: Math.min(100, Math.round(((selectedSet.confidence ?? 0) + (selectedSet.coherenceScore ?? 0)) / 2)),
    reasons,
    warnings,
  };
}

function scoreCandidate<TSet extends CandidateShape>(candidate: TSet, input: CompetitiveSetSelectionInput<TSet>): number {
  const roleMatch = candidate.primaryRole === input.requiredRole || candidate.secondaryRoles?.includes(input.requiredRole) ? 250 : 0;
  const archetypeMatch = input.archetype && candidate.archetypes?.includes(input.archetype) ? 80 : 0;
  const sourcePenalty = candidate.sourceType === 'generated' || candidate.sourceType === 'fallback' ? -100 : 0;
  return roleMatch + archetypeMatch + (candidate.confidence ?? 0) * 2 + (candidate.coherenceScore ?? 0) + sourcePenalty;
}
