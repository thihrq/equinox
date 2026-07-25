import { MatchupScenario } from '../CompetitiveCurationTypes';
export function auditScenarios(scenarios: MatchupScenario[], validPokemonIds: string[]): { valid: boolean; candidateCount: number; scenarioCount: number; distribution: Record<string, number>; findings: string[] } {
  const findings: string[] = [];
  const byCandidate = new Map<string, MatchupScenario[]>();
  scenarios.forEach(scenario => byCandidate.set(scenario.setId, [...(byCandidate.get(scenario.setId) ?? []), scenario]));
  for (const [setId, candidateScenarios] of byCandidate) {
    const counts = { favorable: 0, neutral: 0, adverse: 0 };
    candidateScenarios.forEach(scenario => { counts[scenario.result] += 1; if (!scenario.assumptions.length) findings.push(`${setId}:SCENARIO_ASSUMPTIONS_MISSING`); if (!scenario.limitations.length) findings.push(`${setId}:SCENARIO_LIMITATIONS_MISSING`); if (!scenario.opposingPokemonIds.every(id => validPokemonIds.includes(id))) findings.push(`${setId}:SCENARIO_OPPONENT_INVALID`); });
    if (candidateScenarios.length < 6 || counts.favorable < 2 || counts.neutral < 2 || counts.adverse < 2) findings.push(`${setId}:SCENARIO_DISTRIBUTION_INVALID`);
  }
  const distribution = scenarios.reduce<Record<string, number>>((result, scenario) => { result[scenario.outcome] = (result[scenario.outcome] ?? 0) + 1; return result; }, {});
  if ((distribution['supports-candidate'] ?? 0) === scenarios.length) findings.push('SCENARIO_OUTCOME_DISTRIBUTION_IMPLAUSIBLE');
  return { valid: findings.length === 0, candidateCount: byCandidate.size, scenarioCount: scenarios.length, distribution, findings };
}
