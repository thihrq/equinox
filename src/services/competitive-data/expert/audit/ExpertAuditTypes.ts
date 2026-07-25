import { ExpertFinding, ExpertVerdict } from '../CompetitiveDoublesExpertTypes';

export interface ExpertEvidenceAuditResult {
  valid: boolean;
  findings: ExpertFinding[];
  missingEvidenceIds: string[];
  mongoReads: 0;
  mongoWrites: 0;
  productionWrites: 0;
}

export interface ExpertConsolidationInput {
  candidateId: string;
  componentFindings: ExpertFinding[];
  componentEvidenceIds: string[];
  score: number;
}

export type ExpertVerdictConsolidator = (input: ExpertConsolidationInput) => ExpertVerdict;
