import { classifyHumanReviewRequirement, selectHumanSampling, assertPromotionGuard, deepFreezeCandidate } from '../services/competitive-data/expert/Stage4ExpertPolicy';
import { auditExpertEvidence } from '../services/competitive-data/expert/Stage4EvidenceAudit';
import { Stage4Candidate, Stage4EvidenceInput } from '../services/competitive-data/expert/Stage4ExpertTypes';

function assert(condition: boolean, message: string): void { if (!condition) throw new Error(message); }

assert(classifyHumanReviewRequirement('expert-validated', 'high') === 'sampling-optional', 'high confidence policy failed');
assert(classifyHumanReviewRequirement('expert-validated', 'low') === 'required', 'low confidence policy failed');
assert(classifyHumanReviewRequirement('expert-review-required', 'medium') === 'required', 'review-required policy failed');
assert(classifyHumanReviewRequirement('rejected', 'high') === 'not-applicable', 'rejected policy failed');

const candidates: Array<{ candidateId: string; archetype: string; mega: boolean; regional: boolean; trickRoom: boolean; tailwind: boolean; weather: boolean; terrain: boolean; verdict: 'expert-validated' | 'expert-review-required' | 'rejected'; confidence: 'high' | 'medium' | 'low' }> = Array.from({ length: 20 }, (_, index) => ({ candidateId: `candidate-${index + 1}`, archetype: index % 2 ? 'offense' : 'support', mega: index === 0, regional: index === 1, trickRoom: index === 2, tailwind: index === 3, weather: index === 4, terrain: index === 5, verdict: 'expert-validated', confidence: 'high' }));
const selected = selectHumanSampling(candidates, 'stage4-seed-v1');
assert(selected.length >= 2, 'sampling should include deterministic coverage');
assert(selectHumanSampling(candidates, 'stage4-seed-v1').join(',') === selected.join(','), 'sampling must be deterministic');

const candidate: Stage4Candidate = { candidateId: 'candidate-1', candidateDigest: 'sha256:candidate', sourceType: 'generated', status: 'draft', humanReviewed: false, automaticPromotionAllowed: false };
const frozen = deepFreezeCandidate(candidate);
assert(Object.isFrozen(frozen), 'candidate must be frozen');
assertPromotionGuard(candidate, { verdict: 'expert-validated', confidence: 'high', evidenceDigest: 'sha256:evidence', policyVersion: 'stage4-v1', validatedAt: '2026-07-20T00:00:00.000Z' });

const completeEvidence: Stage4EvidenceInput = { packageDigest: 'sha256:package', mechanicsDigest: 'sha256:mechanics', rosterDigest: 'sha256:roster', candidateDigest: candidate.candidateDigest, generationEvidence: true, damageEvidence: true, speedEvidence: true, scenarioEvidenceCount: 6, fullTeamEvidenceCount: 5, benchmarkEvidence: true, specialistVersions: ['v1'], policyVersions: ['stage4-v1'], assumptions: ['known'], limitations: ['known'], unsupportedMechanics: [], blockers: [], warnings: [], confidence: 'high' };
assert(auditExpertEvidence(completeEvidence).valid, 'complete evidence should audit successfully');
assert(!auditExpertEvidence({ ...completeEvidence, damageEvidence: false }).valid, 'missing damage evidence should block validation');

console.log('[Equinox] Stage 4 expert validation contract tests passed.');
