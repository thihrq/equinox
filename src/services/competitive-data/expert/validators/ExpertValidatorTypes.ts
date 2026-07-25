import { ExpertCandidateRef, ExpertComponentResult } from '../CompetitiveDoublesExpertTypes';

export interface ExpertValidationInput {
  candidate: ExpertCandidateRef;
  regulationId: 'M-B';
  packageDigest: string;
}

export interface ExpertValidatorResult extends ExpertComponentResult {
  candidateId: string;
}

export type ExpertValidator = (input: ExpertValidationInput) => ExpertValidatorResult;
