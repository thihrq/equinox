import { FullTeamEvaluation } from '../CompetitiveCurationTypes';
import { THRESHOLDS } from './ChampionsAdversarialAuditPolicy';
export function auditFullTeams(evaluations: FullTeamEvaluation[]): { valid: boolean; candidateCount: number; validStructureCountByCandidate: Record<string, number>; identitiesByCandidate: Record<string, string[]>; findings: string[] } {
  const findings: string[] = [];
  const byCandidate = new Map<string, FullTeamEvaluation[]>();
  evaluations.forEach(evaluation => byCandidate.set(evaluation.setId, [...(byCandidate.get(evaluation.setId) ?? []), evaluation]));
  const validStructureCountByCandidate: Record<string, number> = {};
  const identitiesByCandidate: Record<string, string[]> = {};
  for (const [setId, rows] of byCandidate) {
    const uniqueTeams = new Set(rows.filter(row => row.legal && row.teamIds.length === 6 && row.basePokemonIds.length === 3 && row.recommendedPokemonIds.length === 3).map(row => row.teamIds.join('|')));
    validStructureCountByCandidate[setId] = uniqueTeams.size;
    identitiesByCandidate[setId] = [...new Set(rows.map(row => row.identity))];
    if (uniqueTeams.size < THRESHOLDS.minimumFullTeamStructures) findings.push(`${setId}:FULL_TEAM_MINIMUM_STRUCTURES_NOT_MET`);
    if (identitiesByCandidate[setId].length < 3) findings.push(`${setId}:FULL_TEAM_IDENTITY_COVERAGE_INSUFFICIENT`);
  }
  return { valid: findings.length === 0, candidateCount: byCandidate.size, validStructureCountByCandidate, identitiesByCandidate, findings };
}
