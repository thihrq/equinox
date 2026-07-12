import { CompetitiveSetStatus } from '../data-validation/CompetitiveValidationTypes';

export interface CompetitiveConflictInput {
  setId: string;
  regulationExact: boolean;
  battleStyle: 'singles' | 'doubles';
  confidence: number;
  sourceUpdatedAt?: string | Date;
  coherenceScore: number;
  usageScore?: number;
  sourceType: string;
}

export interface CompetitiveConflictResolution {
  winner: string;
  losers: Array<{ setId: string; status: CompetitiveSetStatus; reason: string }>;
  auditLog: string[];
}

export function resolveCompetitiveSetConflict(inputs: CompetitiveConflictInput[]): CompetitiveConflictResolution {
  const ranked = [...inputs].sort((a, b) => scoreConflictCandidate(b) - scoreConflictCandidate(a));
  const winner = ranked[0];
  if (!winner) return { winner: '', losers: [], auditLog: ['No conflict candidates supplied.'] };

  return {
    winner: winner.setId,
    losers: ranked.slice(1).map(candidate => ({
      setId: candidate.setId,
      status: candidate.coherenceScore < 70 ? 'quarantined' : 'deprecated',
      reason: `Lost conflict resolution to ${winner.setId}.`,
    })),
    auditLog: ranked.map(candidate => `${candidate.setId}: score=${scoreConflictCandidate(candidate)}`),
  };
}

function scoreConflictCandidate(input: CompetitiveConflictInput): number {
  const freshness = input.sourceUpdatedAt ? new Date(input.sourceUpdatedAt).getTime() / 86_400_000_000 : 0;
  const sourceBonus = input.sourceType === 'curated' ? 4 : input.sourceType === 'generated' ? -4 : 0;
  return (
    (input.regulationExact ? 1000 : 0) +
    (input.battleStyle === 'doubles' ? 200 : 0) +
    input.confidence * 4 +
    freshness +
    input.coherenceScore * 2 +
    (input.usageScore ?? 0) +
    sourceBonus
  );
}
