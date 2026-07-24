import { selectCandidateEvidenceTargets } from '../services/competitive-data/expert/evidence-generation/CandidateEvidenceTargetSelector';

const targets = selectCandidateEvidenceTargets({ setId: 'candidate-1', pokemonId: '0006-000', candidateDigest: 'sha256:candidate' }, [
  { scenarioId: 'b', setId: 'candidate-1', result: 'adverse', outcome: 'does-not-support-candidate', opposingPokemonIds: ['0009-000'], partnerPokemonIds: [] },
  { scenarioId: 'a', setId: 'candidate-1', result: 'favorable', outcome: 'supports-candidate', opposingPokemonIds: ['0003-000'], partnerPokemonIds: [] },
  { scenarioId: 'x', setId: 'other', result: 'favorable', outcome: 'supports-candidate', opposingPokemonIds: ['0025-000'], partnerPokemonIds: [] },
], 'seed');
if (targets.length !== 2 || !targets.some(target => target.relationship === 'adverse') || !targets.some(target => target.relationship === 'favorable')) throw new Error('CANDIDATE_EVIDENCE_TARGET_SELECTION_FAILED');
if (JSON.stringify(targets) !== JSON.stringify(selectCandidateEvidenceTargets({ setId: 'candidate-1', pokemonId: '0006-000', candidateDigest: 'sha256:candidate' }, [
  { scenarioId: 'b', setId: 'candidate-1', result: 'adverse', outcome: 'does-not-support-candidate', opposingPokemonIds: ['0009-000'], partnerPokemonIds: [] },
  { scenarioId: 'a', setId: 'candidate-1', result: 'favorable', outcome: 'supports-candidate', opposingPokemonIds: ['0003-000'], partnerPokemonIds: [] },
], 'seed'))) throw new Error('CANDIDATE_EVIDENCE_TARGETS_NOT_REPRODUCIBLE');
console.log('candidate evidence target selector tests passed');
