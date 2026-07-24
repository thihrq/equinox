import { createContractsOnlyExpertContext } from '../services/competitive-data/expert/CompetitiveDoublesExpertContext';
import { EMPTY_EXPERT_REGISTRY } from '../services/competitive-data/expert/CompetitiveDoublesExpertRegistry';
import { validateExpertVerdictContract } from '../services/competitive-data/expert/CompetitiveDoublesExpertResultValidator';
import { COMPETITIVE_DOUBLES_EXPERT_POLICY_VERSION } from '../services/competitive-data/expert/CompetitiveDoublesExpertPolicy';
import { ExpertCandidateRef, ExpertVerdict } from '../services/competitive-data/expert/CompetitiveDoublesExpertTypes';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const candidate: ExpertCandidateRef = {
  candidateId: 'fixture-candidate',
  candidateDigest: 'sha256:fixture',
  pokemonId: '0006-000',
  speciesId: 'charizard',
  status: 'generated',
  reviewStatus: 'draft',
};
const context = createContractsOnlyExpertContext(candidate, 'sha256:package');
const verdict: ExpertVerdict = {
  candidate,
  decision: 'expert-review-required',
  score: 0,
  findings: [],
  evidence: [],
  automaticPromotionAllowed: false,
  humanReviewRequired: true,
  policyVersion: COMPETITIVE_DOUBLES_EXPERT_POLICY_VERSION,
};

assert(context.execution.executed === false, 'contracts context must not execute engines');
assert(context.regulationId === 'M-B', 'contract regulation must be M-B');
assert(EMPTY_EXPERT_REGISTRY.validators.length === 0 && EMPTY_EXPERT_REGISTRY.specialists.length === 0, 'registry must be empty in Stage 1');
assert(validateExpertVerdictContract(verdict).length === 0, 'valid verdict contract was rejected');
console.log(JSON.stringify({ valid: true, engineExecuted: false, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }, null, 2));
