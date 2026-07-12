import { normalizeRoleId } from '../data-normalization/CompetitiveDataNormalizer';

export type CompetitiveRole =
  | 'trick-room-setter'
  | 'redirection-support'
  | 'slow-physical-breaker'
  | 'slow-special-breaker'
  | 'bulky-pivot'
  | 'fake-out-control'
  | 'special-wall'
  | 'physical-wall'
  | 'weather-setter'
  | 'weather-abuser'
  | 'speed-control'
  | 'anti-intimidate'
  | 'primary-win-condition'
  | 'secondary-win-condition';

export interface CompetitiveRoleDefinition {
  id: CompetitiveRole;
  expectedMoves: string[];
  compatibleNatures: string[];
  minimumEvs?: Partial<Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>;
  ivPolicy?: Partial<Record<'atk' | 'spe', 'zero-preferred' | 'any'>>;
  commonItems: string[];
  compatibleArchetypes: string[];
  conflicts: CompetitiveRole[];
}

export const COMPETITIVE_ROLE_CATALOG: Record<CompetitiveRole, CompetitiveRoleDefinition> = {
  'trick-room-setter': {
    id: 'trick-room-setter',
    expectedMoves: ['trickroom', 'protect'],
    compatibleNatures: ['sassy', 'relaxed', 'bold', 'calm'],
    minimumEvs: { hp: 180 },
    ivPolicy: { spe: 'zero-preferred' },
    commonItems: ['sitrusberry', 'mentalherb', 'safetygoggles'],
    compatibleArchetypes: ['trick-room', 'balance'],
    conflicts: ['speed-control'],
  },
  'redirection-support': {
    id: 'redirection-support',
    expectedMoves: ['followme', 'ragepowder', 'protect'],
    compatibleNatures: ['bold', 'calm', 'sassy', 'relaxed'],
    minimumEvs: { hp: 180 },
    commonItems: ['safetygoggles', 'sitrusberry', 'rockyhelmet'],
    compatibleArchetypes: ['balance', 'trick-room', 'setup'],
    conflicts: [],
  },
  'slow-physical-breaker': {
    id: 'slow-physical-breaker',
    expectedMoves: ['protect'],
    compatibleNatures: ['brave', 'adamant'],
    minimumEvs: { hp: 120, atk: 180 },
    ivPolicy: { spe: 'zero-preferred' },
    commonItems: ['lifeorb', 'clearamulet', 'assaultvest'],
    compatibleArchetypes: ['trick-room', 'balance'],
    conflicts: [],
  },
  'slow-special-breaker': {
    id: 'slow-special-breaker',
    expectedMoves: ['protect'],
    compatibleNatures: ['quiet', 'modest'],
    minimumEvs: { hp: 120, spa: 180 },
    ivPolicy: { atk: 'zero-preferred', spe: 'zero-preferred' },
    commonItems: ['lifeorb', 'throatspray', 'assaultvest'],
    compatibleArchetypes: ['trick-room', 'balance'],
    conflicts: [],
  },
  'bulky-pivot': {
    id: 'bulky-pivot',
    expectedMoves: ['fakeout', 'partingshot', 'uturn', 'voltswitch'],
    compatibleNatures: ['careful', 'impish', 'sassy', 'relaxed'],
    minimumEvs: { hp: 180 },
    commonItems: ['sitrusberry', 'assaultvest', 'safetygoggles'],
    compatibleArchetypes: ['balance', 'weather'],
    conflicts: [],
  },
  'fake-out-control': {
    id: 'fake-out-control',
    expectedMoves: ['fakeout'],
    compatibleNatures: ['careful', 'impish', 'jolly', 'adamant'],
    commonItems: ['sitrusberry', 'safetygoggles'],
    compatibleArchetypes: ['balance', 'offense'],
    conflicts: [],
  },
  'special-wall': {
    id: 'special-wall',
    expectedMoves: ['protect'],
    compatibleNatures: ['calm', 'sassy', 'careful'],
    minimumEvs: { hp: 180, spd: 100 },
    commonItems: ['leftovers', 'sitrusberry'],
    compatibleArchetypes: ['balance', 'stall'],
    conflicts: [],
  },
  'physical-wall': {
    id: 'physical-wall',
    expectedMoves: ['protect'],
    compatibleNatures: ['bold', 'relaxed', 'impish'],
    minimumEvs: { hp: 180, def: 100 },
    commonItems: ['leftovers', 'sitrusberry', 'rockyhelmet'],
    compatibleArchetypes: ['balance', 'stall'],
    conflicts: [],
  },
  'weather-setter': {
    id: 'weather-setter',
    expectedMoves: ['protect'],
    compatibleNatures: ['bold', 'calm', 'modest', 'timid'],
    commonItems: ['damprock', 'heatrock', 'sitrusberry'],
    compatibleArchetypes: ['weather'],
    conflicts: [],
  },
  'weather-abuser': {
    id: 'weather-abuser',
    expectedMoves: ['protect'],
    compatibleNatures: ['timid', 'jolly', 'modest', 'adamant'],
    commonItems: ['lifeorb', 'choicespecs', 'focussash'],
    compatibleArchetypes: ['weather', 'offense'],
    conflicts: [],
  },
  'speed-control': {
    id: 'speed-control',
    expectedMoves: ['tailwind', 'icywind', 'electroweb', 'trickroom'],
    compatibleNatures: ['timid', 'jolly', 'calm', 'bold'],
    commonItems: ['focussash', 'sitrusberry', 'covertcloak'],
    compatibleArchetypes: ['balance', 'offense'],
    conflicts: [],
  },
  'anti-intimidate': {
    id: 'anti-intimidate',
    expectedMoves: ['protect'],
    compatibleNatures: ['adamant', 'jolly', 'brave'],
    commonItems: ['clearamulet', 'lifeorb'],
    compatibleArchetypes: ['offense', 'balance'],
    conflicts: [],
  },
  'primary-win-condition': {
    id: 'primary-win-condition',
    expectedMoves: ['protect'],
    compatibleNatures: ['adamant', 'modest', 'jolly', 'timid', 'brave', 'quiet'],
    commonItems: ['lifeorb', 'clearamulet', 'choicespecs', 'choicescarf'],
    compatibleArchetypes: ['offense', 'balance', 'trick-room'],
    conflicts: [],
  },
  'secondary-win-condition': {
    id: 'secondary-win-condition',
    expectedMoves: ['protect'],
    compatibleNatures: ['adamant', 'modest', 'jolly', 'timid', 'brave', 'quiet'],
    commonItems: ['lifeorb', 'clearamulet', 'assaultvest'],
    compatibleArchetypes: ['offense', 'balance', 'trick-room'],
    conflicts: [],
  },
};

export function getCompetitiveRole(role: string): CompetitiveRoleDefinition | undefined {
  return COMPETITIVE_ROLE_CATALOG[normalizeRoleId(role) as CompetitiveRole];
}

export function listCompetitiveRoles(): CompetitiveRoleDefinition[] {
  return Object.values(COMPETITIVE_ROLE_CATALOG);
}
