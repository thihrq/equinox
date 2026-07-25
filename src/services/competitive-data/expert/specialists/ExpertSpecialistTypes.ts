import { ExpertCandidateRef, ExpertComponentResult } from '../CompetitiveDoublesExpertTypes';

export interface ExpertSpecialistInput {
  candidate: ExpertCandidateRef;
  packageDigest: string;
  fullTeamPokemonIds: [string, string, string, string, string, string];
}

export interface ExpertSpecialistResult extends ExpertComponentResult {
  specialistId: string;
  candidateId: string;
}

export type ExpertSpecialist = (input: ExpertSpecialistInput) => ExpertSpecialistResult;
