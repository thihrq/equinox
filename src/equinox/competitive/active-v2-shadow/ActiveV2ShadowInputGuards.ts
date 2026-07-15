import type { ActiveV2ShadowPathResult } from './ActiveV2ShadowTypes';

function sameArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function assertSameScenarioInputs(
  baseline: ActiveV2ShadowPathResult,
  activeV2: ActiveV2ShadowPathResult,
): void {
  if (!sameArray([...baseline.inputPokemon], [...activeV2.inputPokemon])) {
    throw new Error('sameScenarioInput gate failed');
  }
  if (baseline.format !== activeV2.format) throw new Error('sameFormat gate failed');
  if (baseline.teamIdentity !== activeV2.teamIdentity) throw new Error('sameTeamIdentity gate failed');
  if (baseline.allowLegendaries !== activeV2.allowLegendaries) throw new Error('sameAllowLegendaries gate failed');
  if (baseline.seedState !== activeV2.seedState) throw new Error('sameSeed gate failed');
}

export function sameSeedState(
  baseline: ActiveV2ShadowPathResult,
  activeV2: ActiveV2ShadowPathResult,
): true | 'not-applicable' {
  return baseline.seedState === 'not-applicable' && activeV2.seedState === 'not-applicable' ? 'not-applicable' : true;
}
