import crypto from 'crypto';
import { ExpertEvidence, ExpertFinding } from '../CompetitiveDoublesExpertTypes';
import { SpeedTierInput, SpeedTierResult } from './SpeedTierTypes';

export const SPEED_ENGINE_VERSION = 'speed-tier-engine-v1';
export const SPEED_FORMULA_VERSION = 'speed-formula-v1';

function digest(value: unknown): string {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function finding(code: string, message: string, blocking: boolean): ExpertFinding {
  return { code, message, severity: blocking ? 'error' : 'warning', blocking, evidenceIds: [] };
}

function normalize(value: string): string { return value.trim().toLowerCase(); }

// Showdown/@pkmn id form (lowercase, alphanumeric only) -- the canonical, unambiguous identifier
// used throughout the reference-conformance area, so 'Choice Scarf', 'choice scarf', and
// 'choicescarf' are all recognized as the same item regardless of display formatting.
function toComparableId(value: string): string { return value.trim().toLowerCase().replace(/[^a-z0-9]/g, ''); }

function natureMultiplier(natureId: string): number {
  const nature = normalize(natureId);
  if (['timid', 'jolly', 'hasty', 'naive'].includes(nature)) return 1.1;
  if (['brave', 'quiet', 'relaxed', 'sassy'].includes(nature)) return 0.9;
  return 1;
}

function stageMultiplier(stage: number): number {
  const bounded = Math.max(-6, Math.min(6, stage));
  return bounded >= 0 ? (2 + bounded) / 2 : 2 / (2 - bounded);
}

function abilityMultiplier(input: SpeedTierInput, findings: ExpertFinding[], applied: string[]): number {
  if (!input.abilityId) return 1;
  const ability = toComparableId(input.abilityId);
  const weather = toComparableId(input.weather ?? '');
  // Accepts both legacy display-style weather words ('rain', 'sun') and real @pkmn/sim
  // condition ids ('raindance', 'sunnyday') -- callers should not have to know which form
  // the engine prefers, and the reference-conformance adapters use the id form exclusively.
  const weatherAbility: Readonly<Record<string, string[]>> = {
    swiftswim: ['rain', 'raindance', 'heavyrain', 'primordialsea'],
    chlorophyll: ['sun', 'sunnyday', 'harshsunlight', 'desolateland'],
    sandrush: ['sand', 'sandstorm'],
    slushrush: ['snow', 'hail'],
  };
  if (!(ability in weatherAbility)) {
    findings.push(finding('UNSUPPORTED_MECHANIC', `ability:${input.abilityId} is not supported by ${SPEED_ENGINE_VERSION}`, true));
    return 1;
  }
  if (weatherAbility[ability].includes(weather)) { applied.push(`ability:${input.abilityId}:2x`); return 2; }
  return 1;
}

export function compareActionOrder(first: { speed: number; priority: number }, second: { speed: number; priority: number }, trickRoom: boolean): 'first' | 'second' | 'tie' {
  if (first.priority !== second.priority) return first.priority > second.priority ? 'first' : 'second';
  if (first.speed === second.speed) return 'tie';
  if (trickRoom) return first.speed < second.speed ? 'first' : 'second';
  return first.speed > second.speed ? 'first' : 'second';
}

export function calculateSpeedTier(input: SpeedTierInput): SpeedTierResult {
  const findings: ExpertFinding[] = [];
  const appliedModifiers: string[] = [];
  const assumptions = ['speed is calculated from supplied base Speed, IV, EV, level, and nature', 'priority is compared separately from Speed'];
  const rawSpeed = Math.floor((Math.floor((2 * input.baseSpeed + input.speedIv + Math.floor(input.speedEv / 4)) * input.level / 100) + 5) * natureMultiplier(input.natureId));
  const stageAdjustedSpeed = Math.floor(rawSpeed * stageMultiplier(input.statStage));
  const itemMultiplier = toComparableId(input.itemId ?? '') === 'choicescarf' ? 1.5 : 1;
  if (itemMultiplier !== 1) appliedModifiers.push('choice-scarf:1.5');
  const abilityMultiplierValue = abilityMultiplier(input, findings, appliedModifiers);
  const tailwindMultiplier = input.tailwind ? 2 : 1;
  if (input.tailwind) appliedModifiers.push('tailwind:2');
  const paralysisMultiplier = input.paralyzed ? 0.5 : 1;
  if (input.paralyzed) appliedModifiers.push('paralysis:0.5');
  const modifiedSpeed = Math.floor(stageAdjustedSpeed * itemMultiplier * abilityMultiplierValue * tailwindMultiplier * paralysisMultiplier);
  const priorityBracket = input.movePriority ?? 0;
  const fasterThan: string[] = [];
  const slowerThan: string[] = [];
  const speedTies: string[] = [];
  for (const comparison of input.comparisons ?? []) {
    const order = compareActionOrder({ speed: modifiedSpeed, priority: priorityBracket }, { speed: comparison.speed, priority: comparison.priorityBracket ?? 0 }, input.trickRoom);
    if (order === 'first') fasterThan.push(comparison.pokemonId);
    if (order === 'second') slowerThan.push(comparison.pokemonId);
    if (order === 'tie') speedTies.push(comparison.pokemonId);
  }
  const incomplete = findings.some(item => item.blocking);
  const resultWithoutDigest = {
    componentId: `${SPEED_ENGINE_VERSION}:${input.pokemonId}`,
    valid: !incomplete,
    findings,
    evidence: [] as ExpertEvidence[],
    execution: { executed: true, executionReason: 'engine-executed' as const },
    rawSpeed,
    calculatedSpeed: stageAdjustedSpeed,
    modifiedSpeed,
    priorityBracket,
    trickRoomOrderValue: input.trickRoom ? -modifiedSpeed : modifiedSpeed,
    fasterThan,
    slowerThan,
    speedTies,
    assumptions,
    appliedModifiers,
    unsupportedMechanics: findings.filter(item => item.code === 'UNSUPPORTED_MECHANIC').map(item => item.message),
    formulaVersion: SPEED_FORMULA_VERSION,
    inputDigest: digest(input),
  };
  const resultDigest = digest(resultWithoutDigest);
  const evidence: ExpertEvidence[] = [{ evidenceId: `${resultWithoutDigest.componentId}:calculation`, kind: 'calculation', sourceId: 'equinox-speed-tier-engine', sourceRevision: SPEED_ENGINE_VERSION, inputDigest: resultWithoutDigest.inputDigest, resultDigest, description: 'Deterministic Speed stat and action-order calculation with separate priority handling.' }];
  return { ...resultWithoutDigest, evidence, resultDigest };
}
