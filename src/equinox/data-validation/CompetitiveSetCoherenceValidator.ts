import { Dex } from '@pkmn/dex';
import { getCompetitiveRole } from '../competitive/CompetitiveRoleCatalog';
import { normalizeMoveId, normalizeNatureId, normalizeRoleId } from '../data-normalization/CompetitiveDataNormalizer';
import { completeSpread, CompetitiveSetValidationInput, DataValidationIssue, issue } from './CompetitiveValidationTypes';

export interface CompetitiveSetCoherenceResult {
  accepted: boolean;
  coherenceScore: number;
  issues: DataValidationIssue[];
}

export function validateCompetitiveSetCoherence(input: CompetitiveSetValidationInput): CompetitiveSetCoherenceResult {
  const issues: DataValidationIssue[] = [];
  let score = 100;
  const evs = completeSpread(input.evs, 0);
  const ivs = completeSpread(input.ivs, 31);
  const roleId = normalizeRoleId(input.primaryRole || input.secondaryRoles?.[0]);
  const role = roleId ? getCompetitiveRole(roleId) : undefined;
  const moveIds = (input.moves ?? []).map(normalizeMoveId);
  const natureId = normalizeNatureId(input.nature);

  if (!role) {
    issues.push(issue('UNKNOWN_ROLE', 'warning', 'primaryRole', 'Role is not registered in CompetitiveRoleCatalog.'));
    score -= 15;
  } else {
    for (const [stat, minimum] of Object.entries(role.minimumEvs ?? {})) {
      const value = evs[stat as keyof typeof evs];
      if (value < minimum) {
        issues.push(issue('ROLE_SPREAD_MISMATCH', 'error', `evs.${stat}`, `${role.id} expects at least ${minimum} ${stat} EVs.`));
        score -= 35;
      }
    }

    if (role.compatibleNatures.length && !role.compatibleNatures.includes(natureId)) {
      issues.push(issue('ROLE_NATURE_MISMATCH', 'warning', 'nature', `${input.nature} is unusual for ${role.id}.`));
      score -= 12;
    }

    if (role.ivPolicy?.spe === 'zero-preferred' && ivs.spe > 0) {
      issues.push(issue('TRICK_ROOM_SPEED_IV', 'warning', 'ivs.spe', 'This role usually prefers 0 Speed IV.'));
      score -= 8;
    }

    if (role.ivPolicy?.atk === 'zero-preferred' && ivs.atk > 0) {
      issues.push(issue('SPECIAL_ATTACKER_ATTACK_IV', 'warning', 'ivs.atk', 'Special sets usually prefer 0 Attack IV.'));
      score -= 5;
    }
  }

  const physicalMoves = (input.moves ?? []).filter(move => Dex.moves.get(move).category === 'Physical').length;
  const specialMoves = (input.moves ?? []).filter(move => Dex.moves.get(move).category === 'Special').length;
  if (/special/.test(roleId) && physicalMoves >= 3) {
    issues.push(issue('SPECIAL_ROLE_PHYSICAL_MOVES', 'error', 'moves', 'Special role has mostly physical attacks.'));
    score -= 30;
  }
  if (/physical/.test(roleId) && specialMoves >= 3) {
    issues.push(issue('PHYSICAL_ROLE_SPECIAL_MOVES', 'error', 'moves', 'Physical role has mostly special attacks.'));
    score -= 30;
  }
  if (moveIds.includes('bodypress') && evs.def < 100) {
    issues.push(issue('BODY_PRESS_DEFENSE_INVESTMENT', 'warning', 'evs.def', 'Body Press set should invest in Defense.'));
    score -= 15;
  }

  const coherenceScore = Math.max(0, Math.min(100, score));
  return {
    accepted: coherenceScore >= 70 && !issues.some(entry => entry.severity === 'error'),
    coherenceScore,
    issues,
  };
}
