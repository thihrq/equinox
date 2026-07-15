import type { ActiveV2ShadowPathResult } from './ActiveV2ShadowTypes';

function normalizeList(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function normalizeShadowPathResult(result: ActiveV2ShadowPathResult): ActiveV2ShadowPathResult {
  return {
    ...result,
    setsConsumed: normalizeList(result.setsConsumed),
    movesUsed: normalizeList(result.movesUsed),
    itemsUsed: normalizeList(result.itemsUsed),
    abilitiesUsed: normalizeList(result.abilitiesUsed),
    roles: normalizeList(result.roles),
    leadStrategies: normalizeList(result.leadStrategies),
    errors: normalizeList(result.errors),
  };
}
