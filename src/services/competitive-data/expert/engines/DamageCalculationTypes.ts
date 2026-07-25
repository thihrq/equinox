import { ExpertComponentResult } from '../CompetitiveDoublesExpertTypes';

export interface DamageCalculationInput {
  attackerPokemonId: string;
  defenderPokemonId: string;
  moveId: string;
  formatId: 'champions-reg-mb-doubles';
  level: number;
  isSpreadMove: boolean;
  targetsHit: number;
  weather?: string;
  terrain?: string;
  attackerTypes: string[];
  defenderTypes: string[];
  attackerStats: DamageStats;
  defenderStats: DamageStats;
  move: DamageMove;
  attackerStatStage?: number;
  defenderStatStage?: number;
  criticalHit?: boolean;
  screens?: DamageScreens;
}

export interface DamageStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export type DamageCategory = 'physical' | 'special' | 'fixed' | 'status';

export interface DamageMove {
  type: string;
  category: DamageCategory;
  basePower?: number;
  fixedDamage?: number;
}

export interface DamageScreens {
  reflect?: boolean;
  lightScreen?: boolean;
  auroraVeil?: boolean;
}

export interface DamageCalculationResult extends ExpertComponentResult {
  minDamage?: number;
  maxDamage?: number;
  minPercent?: number;
  maxPercent?: number;
  damageRolls: number[];
  guaranteedOhko: boolean;
  possibleOhko: boolean;
  guaranteedTwoHitKo: boolean;
  possibleTwoHitKo: boolean;
  assumptions: string[];
  appliedModifiers: string[];
  unsupportedMechanics: string[];
  formulaVersion: string;
  inputDigest: string;
  resultDigest: string;
}
