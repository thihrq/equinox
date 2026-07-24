import { calculate, Field, Move, Pokemon } from '@smogon/calc';
import { IndependentDamageFixture, stableDigest } from '../contracts/ReferenceConformanceContracts';

export interface IndependentDamageReferenceResult {
  fixtureId: string;
  supported: boolean;
  unsupportedReasons: string[];
  calculatedStats: { attackerRelevantStat: number; defenderRelevantStat: number; defenderHp: number };
  rolls: number[];
  minDamage: number;
  maxDamage: number;
  minPercent: number;
  maxPercent: number;
  classification: IndependentDamageFixture['expected']['classification'];
  referencePackage: '@smogon/calc';
  referenceVersion: '0.11.0';
  inputDigest: string;
  resultDigest: string;
}

function flattenDamage(value: number | number[] | number[][]): number[] {
  if (typeof value === 'number') return [value];
  return value.flatMap(item => Array.isArray(item) ? item : [item]);
}

function classify(minDamage: number, maxDamage: number, hp: number): IndependentDamageFixture['expected']['classification'] {
  if (maxDamage === 0) return 'immunity';
  if (minDamage >= hp) return 'guaranteed-ohko';
  if (maxDamage >= hp) return 'possible-ohko';
  if (minDamage * 2 >= hp) return 'guaranteed-two-hit-ko';
  if (maxDamage * 2 >= hp) return 'possible-two-hit-ko';
  return 'not-two-hit-ko';
}

function statTable(values: Record<string, number>): { hp?: number; atk?: number; def?: number; spa?: number; spd?: number; spe?: number } {
  return { hp: values.hp, atk: values.attack, def: values.defense, spa: values.specialAttack, spd: values.specialDefense, spe: values.speed };
}

export function calculateIndependentDamage(fixture: IndependentDamageFixture): IndependentDamageReferenceResult {
  const unsupportedReasons: string[] = [];
  if (fixture.field.terrain && !['Electric', 'Grassy', 'Misty', 'Psychic'].includes(fixture.field.terrain)) unsupportedReasons.push(`terrain:${fixture.field.terrain}`);
  const attacker = new Pokemon(9, fixture.attacker.species, {
    level: fixture.attacker.level,
    nature: fixture.attacker.nature,
    item: fixture.attacker.item,
    ability: fixture.attacker.ability,
    evs: statTable(fixture.attacker.evs),
    ivs: statTable(fixture.attacker.ivs),
    boosts: statTable(fixture.attacker.boosts ?? {}),
  });
  const defender = new Pokemon(9, fixture.defender.species, {
    level: fixture.defender.level,
    nature: fixture.defender.nature,
    item: fixture.defender.item,
    ability: fixture.defender.ability,
    evs: statTable(fixture.defender.evs),
    ivs: statTable(fixture.defender.ivs),
    boosts: statTable(fixture.defender.boosts ?? {}),
    curHP: fixture.defender.currentHp,
  });
  const move = new Move(9, fixture.move.name);
  if (fixture.move.spread) move.target = 'allAdjacentFoes';
  const field = new Field({
    gameType: fixture.field.doubles ? 'Doubles' : 'Singles',
    weather: fixture.field.weather as never,
    terrain: fixture.field.terrain as never,
    attackerSide: { isReflect: false, isLightScreen: false, isAuroraVeil: false },
    defenderSide: {
      isReflect: fixture.field.reflect ?? false,
      isLightScreen: fixture.field.lightScreen ?? false,
      isAuroraVeil: fixture.field.auroraVeil ?? false,
    },
  });
  const result = calculate(9, attacker, defender, move, field);
  const rolls = flattenDamage(result.damage);
  const minDamage = Math.min(...rolls);
  const maxDamage = Math.max(...rolls);
  const defenderHp = defender.maxHP();
  const calculatedStats = {
    attackerRelevantStat: fixture.move.category === 'Physical' ? attacker.stats.atk : attacker.stats.spa,
    defenderRelevantStat: fixture.move.category === 'Physical' ? defender.stats.def : defender.stats.spd,
    defenderHp,
  };
  const output = {
    fixtureId: fixture.fixtureId,
    supported: unsupportedReasons.length === 0,
    unsupportedReasons,
    calculatedStats,
    rolls,
    minDamage,
    maxDamage,
    minPercent: (minDamage / defenderHp) * 100,
    maxPercent: (maxDamage / defenderHp) * 100,
    classification: unsupportedReasons.length > 0 ? 'unsupported' as const : classify(minDamage, maxDamage, defenderHp),
    referencePackage: '@smogon/calc' as const,
    referenceVersion: '0.11.0' as const,
    inputDigest: stableDigest(fixture),
  };
  return { ...output, resultDigest: stableDigest(output) };
}
