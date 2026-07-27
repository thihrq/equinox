import type { TeamSlotRequirement } from './TeamSlotRequirement';

export interface TeamCompositionPlan {
  archetypeId: string;
  name: string;
  slots: readonly TeamSlotRequirement[];
  requiredCapabilities: readonly string[];
  preferredCapabilities: readonly string[];
  validationVersion: string;
}
