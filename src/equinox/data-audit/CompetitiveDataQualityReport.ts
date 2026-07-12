import { auditCompetitiveSetCoverage, CompetitiveRosterEntry, CompetitiveCoverageSet } from './CompetitiveSetCoverageAuditor';
import { detectCompetitiveSetDuplicates, CompetitiveDuplicateInput } from './CompetitiveSetDuplicateDetector';

export interface CompetitiveDataQualityReport {
  totalSets: number;
  legalPercent: number;
  averageConfidence: number;
  averageCoherence: number;
  duplicateGroups: number;
  quarantinedSets: number;
  setsBySource: Record<string, number>;
  setsByRole: Record<string, number>;
  coverage?: ReturnType<typeof auditCompetitiveSetCoverage>;
  warnings: string[];
}

export function buildCompetitiveDataQualityReport(input: {
  sets: Array<CompetitiveCoverageSet & CompetitiveDuplicateInput & {
    sourceId?: string;
    status: string;
    primaryRole?: string;
  }>;
  eligibleRoster?: CompetitiveRosterEntry[];
  regulationId?: string;
  battleStyle?: 'singles' | 'doubles';
}): CompetitiveDataQualityReport {
  const totalSets = input.sets.length;
  const legalSets = input.sets.filter(set => set.legal).length;
  const duplicateGroups = detectCompetitiveSetDuplicates(input.sets).length;
  const warnings: string[] = [];

  if (duplicateGroups > 0) warnings.push(`${duplicateGroups} duplicate/conflict set groups detected.`);
  if (input.sets.some(set => set.status === 'quarantined')) warnings.push('Quarantined sets exist and must not be used in active ranking.');
  if (input.sets.some(set => set.confidence < 70)) warnings.push('Low-confidence sets exist; UI must expose fallback/experimental status.');

  return {
    totalSets,
    legalPercent: totalSets ? Math.round((legalSets / totalSets) * 100) : 0,
    averageConfidence: average(input.sets.map(set => set.confidence)),
    averageCoherence: average(input.sets.map(set => set.coherenceScore)),
    duplicateGroups,
    quarantinedSets: input.sets.filter(set => set.status === 'quarantined').length,
    setsBySource: countBy(input.sets.map(set => set.sourceId ?? 'unknown')),
    setsByRole: countBy(input.sets.map(set => set.primaryRole ?? 'unknown')),
    coverage: input.eligibleRoster && input.regulationId && input.battleStyle
      ? auditCompetitiveSetCoverage({
          eligibleRoster: input.eligibleRoster,
          sets: input.sets,
          regulationId: input.regulationId,
          battleStyle: input.battleStyle,
        })
      : undefined,
    warnings,
  };
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}
