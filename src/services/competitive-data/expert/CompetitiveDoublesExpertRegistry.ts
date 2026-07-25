import { ExpertValidator } from './validators/ExpertValidatorTypes';
import { ExpertSpecialist } from './specialists/ExpertSpecialistTypes';

export interface CompetitiveDoublesExpertRegistry {
  validators: ReadonlyArray<ExpertValidator>;
  specialists: ReadonlyArray<ExpertSpecialist>;
}

export const EMPTY_EXPERT_REGISTRY: CompetitiveDoublesExpertRegistry = {
  validators: [],
  specialists: [],
};
