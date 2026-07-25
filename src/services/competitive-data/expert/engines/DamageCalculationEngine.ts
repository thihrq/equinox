import crypto from 'crypto';
import { ExpertEvidence, ExpertFinding } from '../CompetitiveDoublesExpertTypes';
import { DamageCalculationInput, DamageCalculationResult } from './DamageCalculationTypes';

export type { DamageCalculationInput } from './DamageCalculationTypes';

export const DAMAGE_ENGINE_VERSION = 'damage-engine-v1';
export const DAMAGE_FORMULA_VERSION = 'damage-formula-v1';

const TYPE_CHART: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: { Water: 2, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Grass: { Fire: 0.5, Water: 2, Grass: 0.5, Poison: 0.5, Ground: 2, Flying: 0.5, Bug: 0.5, Rock: 2, Dragon: 0.5, Steel: 0.5 },
  Ice: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 0.5, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5 },
  Fighting: { Normal: 2, Ice: 2, Rock: 2, Dark: 2, Steel: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Fairy: 0.5, Ghost: 0 },
  Poison: { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0, Fairy: 2 },
  Ground: { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Rock: 2, Bug: 0.5, Flying: 0 },
  Flying: { Electric: 0.5, Grass: 2, Fighting: 2, Bug: 2, Rock: 0.5, Steel: 0.5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Steel: 0.5, Dark: 0 },
  Bug: { Fire: 0.5, Grass: 2, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Psychic: 2, Ghost: 0.5, Steel: 0.5, Fairy: 0.5 },
  Rock: { Fire: 2, Ice: 2, Flying: 2, Bug: 2, Fighting: 0.5, Ground: 0.5, Steel: 0.5 },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
  Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark: { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
  Steel: { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Steel: 0.5, Fairy: 2 },
  Fairy: { Fire: 0.5, Fighting: 2, Poison: 0.5, Dragon: 2, Dark: 2, Steel: 0.5 },
};

const STAGE_MULTIPLIERS: Readonly<Record<number, number>> = {
  [-6]: 2 / 8, [-5]: 2 / 7, [-4]: 2 / 6, [-3]: 2 / 5, [-2]: 2 / 4, [-1]: 2 / 3,
  0: 1, 1: 3 / 2, 2: 4 / 2, 3: 5 / 2, 4: 6 / 2, 5: 7 / 2, 6: 8 / 2,
};

function digest(value: unknown): string {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function finding(code: string, message: string, blocking: boolean): ExpertFinding {
  return { code, message, severity: blocking ? 'error' : 'warning', blocking, evidenceIds: [] };
}

function normalize(value: string): string { return value.trim().toLowerCase(); }

// Round-half-up, matching the real Gen 9 engine's intermediate rounding (Pokemon Showdown / @smogon/calc "pokeRound").
// Plain Math.floor at every step diverges from real damage rolls whenever a modifier lands exactly on .5.
function pokeRound(value: number): number {
  return value % 1 > 0.5 ? Math.ceil(value) : Math.floor(value);
}

function effectiveness(moveType: string, defenderTypes: string[]): number {
  return defenderTypes.reduce((total, defenderType) => total * (TYPE_CHART[moveType]?.[defenderType] ?? 1), 1);
}

function stageMultiplier(stage: number | undefined): number {
  return STAGE_MULTIPLIERS[Math.max(-6, Math.min(6, stage ?? 0))];
}

function addUnsupported(findings: ExpertFinding[], unsupportedMechanics: string[], value: string): void {
  unsupportedMechanics.push(value);
  findings.push(finding('UNSUPPORTED_MECHANIC', `${value} is not supported by ${DAMAGE_ENGINE_VERSION}`, true));
}

function supportedWeatherModifier(weather: string | undefined, moveType: string, applied: string[]): number {
  if (!weather) return 1;
  const weatherId = normalize(weather);
  const typeId = normalize(moveType);
  if (weatherId === 'sun' || weatherId === 'harsh sunlight') {
    if (typeId === 'fire') { applied.push('sun:fire-boost'); return 1.5; }
    if (typeId === 'water') { applied.push('sun:water-reduction'); return 0.5; }
  }
  if (weatherId === 'rain' || weatherId === 'heavy rain') {
    if (typeId === 'water') { applied.push('rain:water-boost'); return 1.5; }
    if (typeId === 'fire') { applied.push('rain:fire-reduction'); return 0.5; }
  }
  if (['sand', 'sandstorm', 'snow', 'hail'].includes(weatherId)) {
    applied.push(`weather:${weatherId}`);
    return 1;
  }
  return Number.NaN;
}

function terrainModifier(terrain: string | undefined, moveType: string, applied: string[]): number {
  if (!terrain) return 1;
  const terrainId = normalize(terrain);
  if (terrainId === 'electric' && normalize(moveType) === 'electric') { applied.push('electric-terrain:boost'); return 1.3; }
  if (terrainId === 'psychic' && normalize(moveType) === 'psychic') { applied.push('psychic-terrain:boost'); return 1.3; }
  if (terrainId === 'grassy' && normalize(moveType) === 'ground') { applied.push('grassy-terrain:ground-reduction'); return 0.5; }
  if (['electric', 'psychic', 'grassy', 'misty'].includes(terrainId)) return 1;
  return Number.NaN;
}

export function calculateDamage(input: DamageCalculationInput): DamageCalculationResult {
  const findings: ExpertFinding[] = [];
  const unsupportedMechanics: string[] = [];
  const appliedModifiers: string[] = [];
  const assumptions = [
    'damage uses the supplied calculated stats and does not derive stats from a data source',
    'random rolls use the deterministic 85% through 100% range in 16 steps',
  ];
  const moveType = input.move.type;
  const category = input.move.category;
  const weatherModifier = supportedWeatherModifier(input.weather, moveType, appliedModifiers);
  const terrainModifierValue = terrainModifier(input.terrain, moveType, appliedModifiers);
  if (Number.isNaN(weatherModifier)) addUnsupported(findings, unsupportedMechanics, `weather:${input.weather}`);
  if (Number.isNaN(terrainModifierValue)) addUnsupported(findings, unsupportedMechanics, `terrain:${input.terrain}`);

  let damageRolls: number[];
  let baseDamage = 0;
  const typeEffectiveness = category === 'fixed' || category === 'status' ? 1 : effectiveness(moveType, input.defenderTypes);
  if (typeEffectiveness === 0) appliedModifiers.push('immunity:zero-damage');

  if (category === 'status') {
    assumptions.push('status moves are represented as zero direct damage');
    damageRolls = [0];
  } else if (category === 'fixed') {
    if (!Number.isFinite(input.move.fixedDamage) || input.move.fixedDamage! < 0) {
      addUnsupported(findings, unsupportedMechanics, 'fixed-damage-value');
      damageRolls = [0];
    } else {
      damageRolls = [Math.floor(input.move.fixedDamage!)];
      appliedModifiers.push('fixed-damage');
    }
  } else if (!input.move.basePower || input.move.basePower <= 0) {
    addUnsupported(findings, unsupportedMechanics, 'base-power');
    damageRolls = [0];
  } else if (typeEffectiveness === 0) {
    damageRolls = [0];
  } else {
    const isPhysical = category === 'physical';
    const attack = (isPhysical ? input.attackerStats.attack : input.attackerStats.specialAttack) * stageMultiplier(input.attackerStatStage);
    const defense = (isPhysical ? input.defenderStats.defense : input.defenderStats.specialDefense) * stageMultiplier(input.defenderStatStage);
    baseDamage = Math.floor(Math.floor(Math.floor((2 * input.level) / 5 + 2) * input.move.basePower * attack / Math.max(1, defense)) / 50) + 2;

    // Modifiers applied to baseDamage before the random roll, mirroring the real engine's base-stage
    // multipliers (spread reduction, weather type-boost, critical hit) -- each with its own pokeRound.
    let preRollBase = baseDamage;
    if (input.isSpreadMove || input.targetsHit > 1) { preRollBase = pokeRound(preRollBase * 0.75); appliedModifiers.push('spread:0.75'); }
    if (weatherModifier !== 1) preRollBase = pokeRound(preRollBase * weatherModifier);
    if (terrainModifierValue !== 1) preRollBase = pokeRound(preRollBase * terrainModifierValue);
    if (input.criticalHit) { preRollBase = Math.floor(preRollBase * 1.5); appliedModifiers.push('critical:1.5'); }

    const stabApplies = input.attackerTypes.some(type => normalize(type) === normalize(moveType));
    const stabMultiplier = stabApplies ? 1.5 : 1;
    if (stabApplies) appliedModifiers.push('stab');
    if (typeEffectiveness !== 1) appliedModifiers.push(`effectiveness:${typeEffectiveness}`);

    const screens = input.screens ?? {};
    const hasScreen = !input.criticalHit && ((isPhysical && screens.reflect) || (!isPhysical && screens.lightScreen) || screens.auroraVeil);
    const finalMod = hasScreen ? 0.5 : 1;
    if (hasScreen) appliedModifiers.push(screens.auroraVeil ? 'aurora-veil:0.5' : isPhysical ? 'reflect:0.5' : 'light-screen:0.5');

    // Chained order matching the real engine (roll -> STAB -> type effectiveness -> remaining modifiers),
    // each step rounded independently rather than combining every multiplier into one float first.
    damageRolls = Array.from({ length: 16 }, (_, index) => {
      const rolled = Math.floor((preRollBase * (85 + index)) / 100);
      const withStab = stabMultiplier === 1 ? rolled : rolled * stabMultiplier;
      const withType = Math.floor(pokeRound(withStab) * typeEffectiveness);
      return Math.max(0, pokeRound(Math.max(1, withType * finalMod)));
    });
  }

  const minDamage = Math.min(...damageRolls);
  const maxDamage = Math.max(...damageRolls);
  const incomplete = findings.some(item => item.blocking);
  const resultWithoutDigest = {
    componentId: `${DAMAGE_ENGINE_VERSION}:${input.attackerPokemonId}:${input.defenderPokemonId}:${input.moveId}`,
    valid: !incomplete,
    findings,
    evidence: [] as ExpertEvidence[],
    execution: { executed: true, executionReason: 'engine-executed' as const },
    minDamage,
    maxDamage,
    minPercent: (minDamage / input.defenderStats.hp) * 100,
    maxPercent: (maxDamage / input.defenderStats.hp) * 100,
    damageRolls,
    guaranteedOhko: !incomplete && minDamage >= input.defenderStats.hp,
    possibleOhko: !incomplete && maxDamage >= input.defenderStats.hp,
    guaranteedTwoHitKo: !incomplete && minDamage * 2 >= input.defenderStats.hp,
    possibleTwoHitKo: !incomplete && maxDamage * 2 >= input.defenderStats.hp,
    assumptions,
    appliedModifiers,
    unsupportedMechanics,
    formulaVersion: DAMAGE_FORMULA_VERSION,
    inputDigest: digest(input),
  };
  const resultDigest = digest(resultWithoutDigest);
  const evidence: ExpertEvidence[] = [{ evidenceId: `${resultWithoutDigest.componentId}:calculation`, kind: 'calculation', sourceId: 'equinox-damage-engine', sourceRevision: DAMAGE_ENGINE_VERSION, inputDigest: resultWithoutDigest.inputDigest, resultDigest, description: 'Deterministic local damage calculation with explicit modifiers and limitations.' }];
  return { ...resultWithoutDigest, evidence, resultDigest };
}
