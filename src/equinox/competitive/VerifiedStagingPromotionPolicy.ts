import crypto from 'crypto';
import { CompetitiveSetValidationInput } from '../data-validation/CompetitiveValidationTypes';
import { VerifiedReadinessEvaluation } from './VerifiedReadinessPolicy';

export const VERIFIED_STAGING_TARGET_COLLECTION = 'pokemonsets_v2_staging';
export const PRODUCTION_SET_COLLECTION = 'pokemonsets';

export const VERIFIED_STAGING_PROMOTION_ALLOWLIST = [
  'sinistcha-bulky-trick-room-setter-draft',
  'aggronmega-slow-physical-breaker-draft',
  'incineroar-bulky-slow-pivot-draft',
  'ursalunabloodmoon-slow-special-breaker-draft',
  'suicune-bulky-special-wall-draft',
  'pelipper-rain-setter-draft',
  'hydreigon-fast-special-attacker-draft',
  'indeedeefemale-redirection-support-draft',
  'sinistcha-redirection-support-draft',
  'aggronmega-body-press-defensive-attacker-draft',
  'incineroar-fast-taunt-pivot-draft',
  'togekiss-bulky-redirection-support-draft',
  'mukalola-special-wall-draft',
  'giratinaorigin-slow-special-attacker-draft',
] as const;

export type VerifiedStagingPromotionSetId = typeof VERIFIED_STAGING_PROMOTION_ALLOWLIST[number];

export interface VerifiedPromotionValidationResult {
  eligibleSetIds: string[];
  blockedSetIds: string[];
  recordsEligible: number;
  recordsBlocked: number;
  recordsAlreadyVerified: number;
  recordsPromotedToVerified: number;
  recordsWritten: number;
  recordsActive: number;
  generatedPromoted: number;
  productionWrites: number;
}

export interface CompetitivePayloadHashRecord {
  setId: string;
  competitivePayloadHashBefore: string;
  competitivePayloadHashAfter: string;
  competitivePayloadChanged: boolean;
}

export function assertVerifiedStagingTarget(targetCollection: string | undefined): string {
  if (targetCollection === PRODUCTION_SET_COLLECTION) {
    throw new Error('Verified staging promotion blocked: production collection pokemonsets is not allowed.');
  }

  if (targetCollection !== VERIFIED_STAGING_TARGET_COLLECTION) {
    throw new Error(`Verified staging promotion requires EQUINOX_TARGET_COLLECTION=${VERIFIED_STAGING_TARGET_COLLECTION}.`);
  }

  return targetCollection;
}

export function buildCompetitivePayloadHash(record: CompetitiveSetValidationInput): string {
  const payload = {
    moves: record.moves ?? [],
    item: record.item ?? null,
    ability: record.ability ?? null,
    nature: record.nature ?? null,
    evs: record.evs ?? {},
    ivs: record.ivs ?? {},
    roles: {
      primaryRole: record.primaryRole ?? null,
      secondaryRoles: record.secondaryRoles ?? [],
      role: (record as { role?: string }).role ?? null,
    },
    sourceType: record.sourceType ?? null,
    sourceUpdatedAt: record.sourceUpdatedAt ?? null,
    confidence: record.confidence ?? null,
    coherenceScore: record.coherenceScore ?? null,
  };

  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function validateVerifiedPromotionEligibility(
  evaluation: VerifiedReadinessEvaluation,
  records: CompetitiveSetValidationInput[],
): VerifiedPromotionValidationResult {
  const allowlist = new Set<string>(VERIFIED_STAGING_PROMOTION_ALLOWLIST);
  const eligibleSetIds = evaluation.promotionReady.map(record => record.setId).sort();
  const expectedSetIds = [...VERIFIED_STAGING_PROMOTION_ALLOWLIST].sort();
  const blockedSetIds = evaluation.blocked.map(record => record.setId).sort();

  const failures: string[] = [];
  if (eligibleSetIds.length !== expectedSetIds.length) failures.push(`eligibleCount must be ${expectedSetIds.length}, received ${eligibleSetIds.length}`);
  if (expectedSetIds.length !== VERIFIED_STAGING_PROMOTION_ALLOWLIST.length) failures.push(`allowlistCount must be ${VERIFIED_STAGING_PROMOTION_ALLOWLIST.length}, received ${expectedSetIds.length}`);
  if (eligibleSetIds.join('|') !== expectedSetIds.join('|')) {
    failures.push(`eligibleIds must equal allowlistIds. eligible=${eligibleSetIds.join(',')} allowlist=${expectedSetIds.join(',')}`);
  }

  for (const record of records) {
    const setId = String(record.setId ?? 'unknown');
    const isEligible = allowlist.has(setId);
    if (isEligible && record.sourceType !== 'curated') failures.push(`${setId} must be curated.`);
    if (isEligible && record.status !== 'reviewed' && record.status !== 'verified') failures.push(`${setId} must be reviewed or already verified.`);
    if (isEligible && record.active !== false) failures.push(`${setId} must have active === false.`);
    if (record.sourceType === 'generated' && evaluation.promotionReady.some(item => item.setId === setId)) {
      failures.push(`${setId} is generated and must not be eligible.`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Verified staging promotion eligibility failed:\n- ${failures.join('\n- ')}`);
  }

  return {
    eligibleSetIds,
    blockedSetIds,
    recordsEligible: eligibleSetIds.length,
    recordsBlocked: blockedSetIds.length,
    recordsAlreadyVerified: 0,
    recordsPromotedToVerified: 0,
    recordsWritten: 0,
    recordsActive: 0,
    generatedPromoted: 0,
    productionWrites: 0,
  };
}
