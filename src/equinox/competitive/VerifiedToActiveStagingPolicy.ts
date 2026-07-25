import { VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST, VERIFIED_TO_ACTIVE_STAGING_SET_KEYS } from '../../config/verifiedToActiveStagingAllowlist';

export const ACTIVE_STAGING_TARGET_COLLECTION = 'pokemonsets_v2_staging';
export const ACTIVE_STAGING_PRODUCTION_COLLECTION = 'pokemonsets';
export const ACTIVE_STAGING_UNIQUE_SET_KEY_INDEX = 'uq_staging_one_active_per_set_key';
export const ACTIVE_STAGING_SOURCE = 'verified-to-active-staging-v1';

export interface ActiveStagingDocument {
  setId?: string;
  setKey?: string;
  status?: string;
  active?: boolean;
  sourceType?: string;
  verifiedRunId?: string;
  activeRunId?: string;
}

export interface ActiveStagingSummary {
  mode: 'filesystem' | 'shadow' | 'mongo' | 'dry-run' | 'execute';
  mongoRead: boolean;
  targetCollection: string;
  activeRunId?: string;
  recordsAllowlisted: number;
  recordsFound: number;
  recordsEligible: number;
  recordsAlreadyActive: number;
  recordsBlocked: number;
  allowlistedVerified: number;
  allowlistedActive: number;
  allowlistedStillVerified: number;
  blockedRecordsStillReviewed: number;
  blockedRecordsActive: number;
  generatedActive: number;
  activeConflicts: number;
  duplicateSetIds: number;
  activeRunIds: string[];
  sameActiveRunIdForAllowlist: boolean;
  productionWrites: number;
  recordsWritten: number;
}

export interface RollbackActiveStagingSummary {
  mode: 'filesystem' | 'shadow' | 'mongo' | 'dry-run' | 'execute';
  mongoRead: boolean;
  targetCollection: string;
  activeRunId?: string;
  recordsEligibleForRollback: number;
  recordsRolledBack: number;
  allowlistedActive: number;
  allowlistedVerified: number;
  blockedRecordsActive: number;
  generatedActive: number;
  productionWrites: number;
  recordsWritten: number;
}

export function assertActiveStagingTarget(targetCollection: string | undefined): string {
  if (targetCollection === ACTIVE_STAGING_PRODUCTION_COLLECTION) {
    throw new Error('Active staging promotion blocked: production collection pokemonsets is not allowed.');
  }

  if (targetCollection !== ACTIVE_STAGING_TARGET_COLLECTION) {
    throw new Error(`Active staging promotion requires EQUINOX_TARGET_COLLECTION=${ACTIVE_STAGING_TARGET_COLLECTION}.`);
  }

  return targetCollection;
}

export function getActivationExecuteFailures(requireExecute: boolean): string[] {
  const targetCollection = process.env.EQUINOX_TARGET_COLLECTION;
  return [
    targetCollection === ACTIVE_STAGING_PRODUCTION_COLLECTION ? 'production collection pokemonsets is not allowed' : null,
    targetCollection === ACTIVE_STAGING_TARGET_COLLECTION ? null : `EQUINOX_TARGET_COLLECTION=${ACTIVE_STAGING_TARGET_COLLECTION} is required`,
    process.env.EQUINOX_DATA_MODE === 'mongo' ? null : 'EQUINOX_DATA_MODE=mongo is required',
    process.env.EQUINOX_ALLOW_DATABASE_WRITES === 'true' ? null : 'EQUINOX_ALLOW_DATABASE_WRITES=true is required',
    process.env.EQUINOX_ENABLE_STAGING_ACTIVATION === 'true' ? null : 'EQUINOX_ENABLE_STAGING_ACTIVATION=true is required',
    requireExecute ? null : '--execute is required',
  ].filter((failure): failure is string => Boolean(failure));
}

export function assertActivationExecuteAuthorized(requireExecute: boolean): string {
  const failures = getActivationExecuteFailures(requireExecute);
  if (failures.length > 0) {
    console.log('recordsWritten: 0');
    console.log('productionWrites: 0');
    throw new Error(`Active staging promotion execute refused:\n- ${failures.join('\n- ')}`);
  }

  return assertActiveStagingTarget(process.env.EQUINOX_TARGET_COLLECTION);
}

export function isAllowlistedForActivation(setId: string): boolean {
  return VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST.includes(setId as never);
}

export function resolveActivationSetKey(document: ActiveStagingDocument): string {
  const setId = String(document.setId ?? '').trim();
  const mapped = VERIFIED_TO_ACTIVE_STAGING_SET_KEYS[setId as keyof typeof VERIFIED_TO_ACTIVE_STAGING_SET_KEYS];
  const setKey = String(document.setKey ?? mapped ?? '').trim();
  if (!setKey) throw new Error(`Active staging promotion requires setKey for ${setId || 'unknown setId'}.`);
  return setKey;
}

export function findDuplicateSetIds(documents: ActiveStagingDocument[]): number {
  const setIds = documents.map(document => String(document.setId ?? 'missing'));
  return setIds.length - new Set(setIds).size;
}

export function countActiveSetKeyConflicts(documents: ActiveStagingDocument[]): number {
  const activeSetKeys = new Map<string, number>();
  for (const document of documents.filter(item => item.status === 'active' && item.active === true)) {
    const setKey = resolveActivationSetKey(document);
    activeSetKeys.set(setKey, (activeSetKeys.get(setKey) ?? 0) + 1);
  }
  return [...activeSetKeys.values()].filter(count => count > 1).length;
}

export function buildActiveStagingSummary(
  documents: ActiveStagingDocument[],
  targetCollection: string,
  mode: ActiveStagingSummary['mode'],
  recordsWritten = 0,
  activeRunId?: string,
): ActiveStagingSummary {
  const allowlistedDocs = documents.filter(document => isAllowlistedForActivation(String(document.setId ?? '')));
  const blockedDocs = documents.filter(document => !isAllowlistedForActivation(String(document.setId ?? '')));
  const allowlistedActiveDocs = allowlistedDocs.filter(document => document.status === 'active' && document.active === true);
  const activeRunIds = [...new Set(allowlistedActiveDocs.map(document => String(document.activeRunId ?? 'missing')))].sort();

  return {
    mode,
    mongoRead: mode === 'mongo' || mode === 'dry-run' || mode === 'execute',
    targetCollection,
    activeRunId,
    recordsAllowlisted: VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST.length,
    recordsFound: allowlistedDocs.length,
    recordsEligible: allowlistedDocs.filter(document => (
      document.status === 'verified'
      && document.active !== true
      && document.sourceType === 'curated'
      && typeof document.verifiedRunId === 'string'
      && document.verifiedRunId.trim().length > 0
    )).length,
    recordsAlreadyActive: allowlistedActiveDocs.length,
    recordsBlocked: blockedDocs.length,
    allowlistedVerified: allowlistedDocs.filter(document => document.status === 'verified' && document.active !== true).length,
    allowlistedActive: allowlistedActiveDocs.length,
    allowlistedStillVerified: allowlistedDocs.filter(document => document.status === 'verified' && document.active !== true).length,
    blockedRecordsStillReviewed: blockedDocs.filter(document => document.status === 'reviewed' && document.active !== true).length,
    blockedRecordsActive: blockedDocs.filter(document => document.status === 'active' || document.active === true).length,
    generatedActive: documents.filter(document => document.sourceType === 'generated' && (document.status === 'active' || document.active === true)).length,
    activeConflicts: countActiveSetKeyConflicts(documents),
    duplicateSetIds: findDuplicateSetIds(documents),
    activeRunIds,
    sameActiveRunIdForAllowlist: allowlistedActiveDocs.length === VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST.length && activeRunIds.length === 1 && !activeRunIds.includes('missing'),
    productionWrites: 0,
    recordsWritten,
  };
}

export function assertReadyForActivation(summary: ActiveStagingSummary): void {
  const expectedCount = VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST.length;
  const failures: string[] = [];
  if (summary.recordsFound !== expectedCount) failures.push(`recordsFound must be ${expectedCount}, received ${summary.recordsFound}`);
  if (summary.recordsEligible !== expectedCount) failures.push(`recordsEligible must be ${expectedCount}, received ${summary.recordsEligible}`);
  if (summary.recordsAlreadyActive !== 0) failures.push(`recordsAlreadyActive must be 0, received ${summary.recordsAlreadyActive}`);
  if (summary.allowlistedVerified !== expectedCount) failures.push(`allowlistedVerified must be ${expectedCount}, received ${summary.allowlistedVerified}`);
  if (summary.blockedRecordsStillReviewed !== summary.recordsBlocked) {
    failures.push(`blockedRecordsStillReviewed must equal recordsBlocked (${summary.recordsBlocked}), received ${summary.blockedRecordsStillReviewed}`);
  }
  if (summary.blockedRecordsActive !== 0) failures.push(`blockedRecordsActive must be 0, received ${summary.blockedRecordsActive}`);
  if (summary.generatedActive !== 0) failures.push(`generatedActive must be 0, received ${summary.generatedActive}`);
  if (summary.activeConflicts !== 0) failures.push(`activeConflicts must be 0, received ${summary.activeConflicts}`);
  if (summary.duplicateSetIds !== 0) failures.push(`duplicateSetIds must be 0, received ${summary.duplicateSetIds}`);
  if (summary.productionWrites !== 0) failures.push(`productionWrites must be 0, received ${summary.productionWrites}`);

  if (failures.length > 0) {
    throw new Error(`Active staging promotion precheck failed:\n- ${failures.join('\n- ')}`);
  }
}

export function assertActiveFinalState(summary: ActiveStagingSummary): void {
  const expectedCount = VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST.length;
  const failures: string[] = [];
  if (summary.recordsFound !== expectedCount) failures.push(`recordsFound must be ${expectedCount}, received ${summary.recordsFound}`);
  if (summary.allowlistedActive !== expectedCount) failures.push(`allowlistedActive must be ${expectedCount}, received ${summary.allowlistedActive}`);
  if (summary.allowlistedStillVerified !== 0) failures.push(`allowlistedStillVerified must be 0, received ${summary.allowlistedStillVerified}`);
  if (summary.blockedRecordsStillReviewed !== summary.recordsBlocked) {
    failures.push(`blockedRecordsStillReviewed must equal recordsBlocked (${summary.recordsBlocked}), received ${summary.blockedRecordsStillReviewed}`);
  }
  if (summary.blockedRecordsActive !== 0) failures.push(`blockedRecordsActive must be 0, received ${summary.blockedRecordsActive}`);
  if (summary.generatedActive !== 0) failures.push(`generatedActive must be 0, received ${summary.generatedActive}`);
  if (summary.activeConflicts !== 0) failures.push(`activeConflicts must be 0, received ${summary.activeConflicts}`);
  if (summary.duplicateSetIds !== 0) failures.push(`duplicateSetIds must be 0, received ${summary.duplicateSetIds}`);
  if (!summary.sameActiveRunIdForAllowlist) failures.push('sameActiveRunIdForAllowlist must be true');
  if (summary.productionWrites !== 0) failures.push(`productionWrites must be 0, received ${summary.productionWrites}`);

  if (failures.length > 0) {
    throw new Error(`Active staging final-state check failed:\n- ${failures.join('\n- ')}`);
  }
}

export function printActiveStagingSummary(summary: ActiveStagingSummary | RollbackActiveStagingSummary): void {
  console.log(JSON.stringify(summary, null, 2));
  for (const [key, value] of Object.entries(summary)) {
    if (value === undefined || Array.isArray(value) || typeof value === 'object') continue;
    console.log(`${key}: ${String(value)}`);
  }
}
