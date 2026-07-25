import crypto from 'crypto';

export type ReferenceMethod = 'canonical-precalculation' | 'vendored-reference';

export interface IndependentDamageFixture {
  fixtureId: string;
  description: string;
  generation: 9;
  attacker: {
    species: string;
    level: number;
    nature: string;
    item?: string;
    ability?: string;
    evs: Record<string, number>;
    ivs: Record<string, number>;
    boosts?: Record<string, number>;
    types: string[];
  };
  defender: {
    species: string;
    level: number;
    nature: string;
    item?: string;
    ability?: string;
    evs: Record<string, number>;
    ivs: Record<string, number>;
    boosts?: Record<string, number>;
    types: string[];
    currentHp?: number;
  };
  move: {
    name: string;
    type: string;
    category: 'Physical' | 'Special' | 'Status';
    basePower: number;
    spread: boolean;
  };
  field: {
    weather?: string;
    terrain?: string;
    reflect?: boolean;
    lightScreen?: boolean;
    auroraVeil?: boolean;
    doubles: boolean;
  };
  expected: {
    calculatedAttackStat: number;
    calculatedDefenseStat: number;
    defenderHp: number;
    rolls: number[];
    minDamage: number;
    maxDamage: number;
    minPercent: number;
    maxPercent: number;
    classification: 'guaranteed-ohko' | 'possible-ohko' | 'guaranteed-two-hit-ko' | 'possible-two-hit-ko' | 'not-two-hit-ko' | 'immunity' | 'unsupported';
  };
  referenceMethod: ReferenceMethod;
  sourceReferences: string[];
  calculationSteps: string[];
  inputDigest: string;
  resultDigest: string;
  fixtureDigest: string;
}

export type SpeedActionOrder =
  | 'actor-first' | 'opponent-first' | 'speed-tie'
  | 'priority-actor-first' | 'priority-opponent-first'
  | 'trick-room-actor-first' | 'trick-room-opponent-first'
  | 'unsupported';

export interface IndependentSpeedActor {
  species: string;
  level: number;
  baseSpeed: number;
  nature: string;
  speedEv: number;
  speedIv: number;
  speedStage: number;
  ability?: string;
  item?: string;
  status?: string;
  move: string;
  movePriority: number;
}

export interface IndependentSpeedFixture {
  fixtureId: string;
  description: string;
  generation: 9;
  formatId: string;
  actor: IndependentSpeedActor;
  opponent: IndependentSpeedActor;
  battleContext: {
    doubles: true;
    weather?: string;
    terrain?: string;
    actorTailwind: boolean;
    opponentTailwind: boolean;
    trickRoom: boolean;
    seed: string;
  };
  expected: {
    actorCalculatedSpeed: number;
    actorEffectiveSpeed: number;
    actorPriorityBracket: number;
    opponentCalculatedSpeed: number;
    opponentEffectiveSpeed: number;
    opponentPriorityBracket: number;
    actionOrder: SpeedActionOrder;
    speedTie: boolean;
    trickRoomReversedOrder: boolean;
  };
  referenceMethod: ReferenceMethod;
  sourceReferences: string[];
  calculationSteps: string[];
  assumptions: string[];
  limitations: string[];
  inputDigest: string;
  resultDigest: string;
  fixtureDigest: string;
}

export interface ReferenceDigestRecord {
  artifact: string;
  sha256: string;
}

export function stableDigest(value: unknown): string {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

export function digestWithout<T extends object>(value: T, keys: readonly (keyof T)[]): string {
  const copy = { ...value } as Record<string, unknown>;
  for (const key of keys) delete copy[String(key)];
  return stableDigest(copy);
}
