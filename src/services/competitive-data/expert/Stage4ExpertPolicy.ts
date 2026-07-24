import crypto from 'crypto';
import { ExpertDecision } from './CompetitiveDoublesExpertTypes';
import { Confidence, HumanReviewRequirement, Stage4Candidate, Stage4VerdictMetadata } from './Stage4ExpertTypes';

export const STAGE4_POLICY_VERSION = 'champions-mb-expert-validation-v1';
export const STAGE4_SAMPLING_POLICY_VERSION = 'champions-mb-human-sampling-v1';

export function classifyHumanReviewRequirement(verdict: ExpertDecision, confidence: Confidence): HumanReviewRequirement {
  if (verdict === 'rejected') return 'not-applicable';
  if (verdict === 'expert-review-required' || confidence === 'low') return 'required';
  return 'sampling-optional';
}

function hashScore(value: string): number {
  return crypto.createHash('sha256').update(value).digest().readUInt32BE(0);
}

interface SamplingCandidate { candidateId: string; archetype: string; mega: boolean; regional: boolean; trickRoom: boolean; tailwind: boolean; weather: boolean; terrain: boolean; verdict: ExpertDecision; confidence: Confidence; }

export function selectHumanSampling(candidates: SamplingCandidate[], seed: string): string[] {
  const selected = new Set<string>();
  for (const candidate of candidates) {
    if (candidate.verdict === 'expert-review-required' || candidate.confidence === 'low' || candidate.mega || candidate.regional || candidate.trickRoom || candidate.tailwind || candidate.weather || candidate.terrain) selected.add(candidate.candidateId);
  }
  const validated = candidates.filter(candidate => candidate.verdict === 'expert-validated');
  const target = Math.max(1, Math.ceil(validated.length * 0.1));
  const ranked = [...validated].sort((a, b) => hashScore(`${seed}:${a.candidateId}`) - hashScore(`${seed}:${b.candidateId}`));
  for (const candidate of ranked.slice(0, target)) selected.add(candidate.candidateId);
  return [...selected].sort();
}

export function deepFreezeCandidate<T>(candidate: T): Readonly<T> {
  if (candidate && typeof candidate === 'object' && !Object.isFrozen(candidate)) {
    Object.freeze(candidate);
    for (const value of Object.values(candidate as Record<string, unknown>)) deepFreezeCandidate(value);
  }
  return candidate as Readonly<T>;
}

export function assertPromotionGuard(candidate: Stage4Candidate, metadata: Stage4VerdictMetadata): void {
  if (candidate.sourceType !== 'generated' || candidate.status !== 'draft' || candidate.humanReviewed !== false || candidate.automaticPromotionAllowed !== false) throw new Error('EXPERT_PROMOTION_GUARD_VIOLATION');
  if (!metadata.policyVersion || !metadata.evidenceDigest || !metadata.validatedAt) throw new Error('EXPERT_VALIDATION_METADATA_INCOMPLETE');
}

export function getStage4Flags(env: Record<string, string | undefined>): { enabled: boolean; validationOnly: boolean; networkReads: boolean; databaseWrites: boolean; regulationId: string; enginesEnabled: boolean } {
  const strictTrue = (value: string | undefined): boolean => value === 'true';
  return { enabled: strictTrue(env.EQUINOX_ENABLE_CHAMPIONS_EXPERT_VALIDATION), validationOnly: strictTrue(env.EQUINOX_CHAMPIONS_EXPERT_VALIDATION_ONLY), networkReads: strictTrue(env.EQUINOX_CHAMPIONS_ALLOW_NETWORK_READS), databaseWrites: strictTrue(env.EQUINOX_ALLOW_DATABASE_WRITES), regulationId: env.EQUINOX_CHAMPIONS_REGULATION_ID ?? '', enginesEnabled: strictTrue(env.EQUINOX_ENABLE_DAMAGE_ENGINE) && strictTrue(env.EQUINOX_ENABLE_SPEED_ENGINE) && strictTrue(env.EQUINOX_ENABLE_TEAM_SCENARIO_ENGINE) && strictTrue(env.EQUINOX_ENABLE_COMPETITIVE_BENCHMARK_ENGINE) };
}

export function assertStage4Flags(env: Record<string, string | undefined>): void {
  const flags = getStage4Flags(env);
  if (!flags.enabled) throw new Error('CHAMPIONS_EXPERT_VALIDATION_DISABLED');
  if (!flags.validationOnly) throw new Error('CHAMPIONS_EXPERT_VALIDATION_MODE_REQUIRED');
  if (flags.networkReads) throw new Error('CHAMPIONS_EXPERT_NETWORK_MUST_BE_DISABLED');
  if (flags.databaseWrites) throw new Error('CHAMPIONS_DATABASE_WRITES_MUST_BE_DISABLED');
  if (flags.regulationId !== 'M-B') throw new Error('CHAMPIONS_REGULATION_ID_MISMATCH');
  if (!flags.enginesEnabled) throw new Error('CHAMPIONS_EXPERT_ENGINES_REQUIRED');
}
