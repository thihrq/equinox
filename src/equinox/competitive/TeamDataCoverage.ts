import { PokemonData } from '../core/AnalysisContext';

export interface TeamDataCoverage {
  verifiedSets: number;
  reviewedSets: number;
  draftSets: number;
  generatedFallbacks: number;
  legacyFallbacks: number;
  unknownSets: number;
  confidenceScore: number;
  verifiedCompetitiveLabel: boolean;
  competitiveIndexCap: number;
  notes: string[];
}

export function calculateTeamDataCoverage(team: PokemonData[]): TeamDataCoverage {
  const coverage: TeamDataCoverage = {
    verifiedSets: 0,
    reviewedSets: 0,
    draftSets: 0,
    generatedFallbacks: 0,
    legacyFallbacks: 0,
    unknownSets: 0,
    confidenceScore: 100,
    verifiedCompetitiveLabel: true,
    competitiveIndexCap: 100,
    notes: [],
  };

  for (const member of team) {
    const set = member.competitiveSet;
    if (!set) {
      coverage.unknownSets += 1;
    } else if (set.setSource === 'v2-verified' || set.status === 'verified' || set.status === 'active') {
      coverage.verifiedSets += 1;
    } else if (set.setSource === 'v2-reviewed' || set.status === 'reviewed') {
      coverage.reviewedSets += 1;
    } else if (set.setSource === 'v2-draft' || set.status === 'draft') {
      coverage.draftSets += 1;
    } else if (set.setSource === 'generated') {
      coverage.generatedFallbacks += 1;
    } else if (set.setSource === 'legacy' || set.setSource === 'database') {
      coverage.legacyFallbacks += 1;
    } else {
      coverage.unknownSets += 1;
    }
  }

  if (coverage.unknownSets > 0) {
    coverage.verifiedCompetitiveLabel = false;
    coverage.notes.push('Unknown set sources prevent a verified competitive label.');
  }

  if (coverage.generatedFallbacks >= 3) {
    coverage.competitiveIndexCap = Math.min(coverage.competitiveIndexCap, 65);
    coverage.notes.push('Three or more generated fallbacks cap the competitive index at 65.');
  }

  if (coverage.verifiedSets < 4) {
    coverage.confidenceScore = Math.min(coverage.confidenceScore, 70);
    coverage.notes.push('Fewer than four verified sets cap data confidence at 70.');
  }

  coverage.confidenceScore = Math.min(
    coverage.confidenceScore,
    Math.max(0, Math.round(
      coverage.verifiedSets * 16 +
      coverage.reviewedSets * 13 +
      coverage.draftSets * 10 +
      coverage.legacyFallbacks * 7 +
      coverage.generatedFallbacks * 4,
    )),
  );

  return coverage;
}
