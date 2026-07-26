import { PokemonType, TeamDefensiveProfile } from './TeamDefensiveProfile';

export type SpreadMoveCategory = 'PHYSICAL' | 'SPECIAL' | 'VARIABLE';

export interface SpreadMoveDefinition {
  name: string;
  attackType: PokemonType;
  category: SpreadMoveCategory;
  targetMode: 'ALL_ADJACENT' | 'BOTH_OPPONENTS';
  blockedByWideGuard: boolean;
}

export interface SpreadMoveExposure {
  attackType: PokemonType;

  relevantMoves: readonly string[];
  vulnerableTargets: number;
  severeVulnerableTargets: number;
  resistantTargets: number;
  immuneTargets: number;

  wideGuardAvailable: boolean;
  wideGuardEffective: boolean;

  mitigationScore: number;
  exposureScore: number;
  critical: boolean;
}

export const SPREAD_MOVE_REGISTRY: readonly SpreadMoveDefinition[] = [
  { name: 'Blizzard', attackType: 'Ice', category: 'SPECIAL', targetMode: 'BOTH_OPPONENTS', blockedByWideGuard: true },
  { name: 'Icy Wind', attackType: 'Ice', category: 'SPECIAL', targetMode: 'BOTH_OPPONENTS', blockedByWideGuard: true },
  { name: 'Rock Slide', attackType: 'Rock', category: 'PHYSICAL', targetMode: 'BOTH_OPPONENTS', blockedByWideGuard: true },
  { name: 'Earthquake', attackType: 'Ground', category: 'PHYSICAL', targetMode: 'ALL_ADJACENT', blockedByWideGuard: true },
  { name: 'Bulldoze', attackType: 'Ground', category: 'PHYSICAL', targetMode: 'ALL_ADJACENT', blockedByWideGuard: true },
  { name: 'Heat Wave', attackType: 'Fire', category: 'SPECIAL', targetMode: 'BOTH_OPPONENTS', blockedByWideGuard: true },
  { name: 'Muddy Water', attackType: 'Water', category: 'SPECIAL', targetMode: 'BOTH_OPPONENTS', blockedByWideGuard: true },
  { name: 'Surf', attackType: 'Water', category: 'SPECIAL', targetMode: 'ALL_ADJACENT', blockedByWideGuard: true },
  { name: 'Dazzling Gleam', attackType: 'Fairy', category: 'SPECIAL', targetMode: 'BOTH_OPPONENTS', blockedByWideGuard: true },
  { name: 'Discharge', attackType: 'Electric', category: 'SPECIAL', targetMode: 'ALL_ADJACENT', blockedByWideGuard: true },
  { name: 'Expanding Force', attackType: 'Psychic', category: 'SPECIAL', targetMode: 'BOTH_OPPONENTS', blockedByWideGuard: true },
  { name: 'Snarl', attackType: 'Dark', category: 'SPECIAL', targetMode: 'BOTH_OPPONENTS', blockedByWideGuard: true },
  { name: 'Electroweb', attackType: 'Electric', category: 'SPECIAL', targetMode: 'BOTH_OPPONENTS', blockedByWideGuard: true },
  { name: 'Make It Rain', attackType: 'Steel', category: 'SPECIAL', targetMode: 'BOTH_OPPONENTS', blockedByWideGuard: true },
  { name: 'Bleakwind Storm', attackType: 'Flying', category: 'SPECIAL', targetMode: 'BOTH_OPPONENTS', blockedByWideGuard: true },
  { name: 'Wildbolt Storm', attackType: 'Electric', category: 'SPECIAL', targetMode: 'BOTH_OPPONENTS', blockedByWideGuard: true },
  { name: 'Sandsear Storm', attackType: 'Ground', category: 'SPECIAL', targetMode: 'BOTH_OPPONENTS', blockedByWideGuard: true },
] as const;

export function evaluateSpreadMoveExposure(
  team: readonly any[],
  defensiveProfile: TeamDefensiveProfile,
): readonly SpreadMoveExposure[] {
  const hasWideGuard = team.some(p =>
    (p.moves ?? []).some((m: string) => String(m).toLowerCase().replace(/[\s-_]/g, '') === 'wideguard'),
  );

  const exposures: SpreadMoveExposure[] = [];
  const movesByType = new Map<PokemonType, SpreadMoveDefinition[]>();

  for (const moveDef of SPREAD_MOVE_REGISTRY) {
    const list = movesByType.get(moveDef.attackType) || [];
    list.push(moveDef);
    movesByType.set(moveDef.attackType, list);
  }

  for (const [attackType, moveDefs] of movesByType.entries()) {
    const typeProfile = defensiveProfile.byType[attackType];
    if (!typeProfile) continue;

    const vulnerableTargets = typeProfile.weakTargets;
    const severeVulnerableTargets = typeProfile.severeWeakTargets;
    const resistantTargets = typeProfile.resistantTargets;
    const immuneTargets = typeProfile.immuneTargets;

    const wideGuardEffective = hasWideGuard && moveDefs.some(m => m.blockedByWideGuard);
    const mitigationScore = wideGuardEffective ? 25 : 0;

    let exposureScore = (vulnerableTargets * 20 + severeVulnerableTargets * 15) - (resistantTargets * 15 + immuneTargets * 20);
    exposureScore = Math.max(0, exposureScore - mitigationScore);

    const critical = vulnerableTargets >= 3 && resistantTargets === 0 && immuneTargets === 0 && !wideGuardEffective;

    exposures.push({
      attackType,
      relevantMoves: moveDefs.map(m => m.name),
      vulnerableTargets,
      severeVulnerableTargets,
      resistantTargets,
      immuneTargets,
      wideGuardAvailable: hasWideGuard,
      wideGuardEffective,
      mitigationScore,
      exposureScore,
      critical,
    });
  }

  return exposures;
}
