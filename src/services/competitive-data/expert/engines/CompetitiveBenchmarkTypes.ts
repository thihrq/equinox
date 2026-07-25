import { ExpertComponentResult } from '../CompetitiveDoublesExpertTypes';

export interface CompetitiveBenchmarkInput {
  candidateId: string;
  alternativeCandidateIds: string[];
  comparisonLimit: number;
  candidate: BenchmarkCandidate;
  alternativeCandidates: BenchmarkCandidate[];
  maxAlternativesPerCandidate: number;
  maxMoveVariations: number;
  maxItemVariations: number;
  maxNatureVariations: number;
}

export interface BenchmarkDimensions {
  damagePressure: number;
  speedTier: number;
  roleFit: number;
  archetypeFit: number;
  fullTeamFit: number;
}

export interface BenchmarkCandidate {
  candidateId: string;
  legal: boolean;
  evidenceIds: string[];
  dimensions: BenchmarkDimensions;
  creative?: boolean;
}

export type BenchmarkClassification = 'different' | 'inferior-in-one-dimension' | 'dominated' | 'strictly-inferior' | 'creative-but-unproven';

export interface BenchmarkComparison {
  candidateId: string;
  classification: BenchmarkClassification;
  warnings: string[];
}

export interface CompetitiveBenchmarkResult extends ExpertComponentResult {
  candidateId: string;
  comparedAlternativeIds: string[];
  dimensions: {
    damagePressure: number;
    speedTier: number;
    roleFit: number;
    archetypeFit: number;
    fullTeamFit: number;
  };
  dominated: boolean;
  assumptions: string[];
  resultDigest: string;
  inputDigest: string;
  comparisons: BenchmarkComparison[];
  unsupportedMechanics: string[];
}
