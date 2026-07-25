import crypto from 'crypto';
import { CandidateEvidenceTarget } from './CandidateEvidenceTypes';

export interface CandidateTargetSource { scenarioId: string; setId: string; result: 'favorable' | 'neutral' | 'adverse'; outcome: string; opposingPokemonIds: string[]; partnerPokemonIds: string[]; }
export interface CandidateTargetCandidate { setId: string; pokemonId: string; candidateDigest: string; }

function digest(value: unknown): string { return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`; }

export function selectCandidateEvidenceTargets(candidate: CandidateTargetCandidate, scenarios: CandidateTargetSource[], seed: string, targetDigests: Readonly<Record<string, string>> = {}): CandidateEvidenceTarget[] {
  const selected = new Map<string, CandidateEvidenceTarget>();
  const own = scenarios.filter(scenario => scenario.setId === candidate.setId).sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));
  for (const scenario of own) {
    const relationship = scenario.result === 'favorable' ? 'favorable' : scenario.result === 'adverse' ? 'adverse' : 'neutral';
    for (const pokemonId of scenario.opposingPokemonIds) {
      const key = `${pokemonId}:${relationship}`;
      if (selected.has(key)) continue;
      selected.set(key, { targetId: digest({ seed, candidate: candidate.setId, scenario: scenario.scenarioId, pokemonId, relationship }), pokemonId, targetSetDigest: targetDigests[pokemonId] ?? '', sourceType: 'existing-matchup-scenario', sourceReference: scenario.scenarioId, selectionReasonCodes: [`scenario-result:${relationship}`, 'deterministic-scenario-order', targetDigests[pokemonId] ? 'target-digest-resolved' : 'target-digest-missing'], legalityValidated: Boolean(targetDigests[pokemonId]), relationship });
    }
  }
  return [...selected.values()].sort((a, b) => a.targetId.localeCompare(b.targetId));
}
