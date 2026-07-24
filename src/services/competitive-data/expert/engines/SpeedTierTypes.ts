import { ExpertComponentResult } from '../CompetitiveDoublesExpertTypes';

export interface SpeedTierInput {
  pokemonId: string;
  baseSpeed: number;
  level: number;
  speedEv: number;
  speedIv: number;
  natureId: string;
  statStage: number;
  abilityId?: string;
  itemId?: string;
  tailwind: boolean;
  trickRoom: boolean;
  weather?: string;
  paralyzed?: boolean;
  movePriority?: number;
  comparisons?: SpeedComparisonInput[];
}

export interface SpeedComparisonInput {
  pokemonId: string;
  speed: number;
  priorityBracket?: number;
}

export interface SpeedTierResult extends ExpertComponentResult {
  rawSpeed?: number;
  calculatedSpeed?: number;
  modifiedSpeed?: number;
  priorityBracket?: number;
  trickRoomOrderValue?: number;
  fasterThan: string[];
  slowerThan: string[];
  speedTies: string[];
  assumptions: string[];
  appliedModifiers: string[];
  formulaVersion: string;
  inputDigest: string;
  resultDigest: string;
  unsupportedMechanics: string[];
}
