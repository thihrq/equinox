export const VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST = [
  'sinistcha-bulky-trick-room-setter-draft',
  'aggronmega-slow-physical-breaker-draft',
  'incineroar-bulky-slow-pivot-draft',
  'ursalunabloodmoon-slow-special-breaker-draft',
] as const;

export type VerifiedToActiveStagingSetId = typeof VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST[number];

export const VERIFIED_TO_ACTIVE_STAGING_SET_KEYS: Record<VerifiedToActiveStagingSetId, string> = {
  'sinistcha-bulky-trick-room-setter-draft': 'sinistcha-bulky-trick-room-setter',
  'aggronmega-slow-physical-breaker-draft': 'aggronmega-slow-physical-breaker',
  'incineroar-bulky-slow-pivot-draft': 'incineroar-bulky-slow-pivot',
  'ursalunabloodmoon-slow-special-breaker-draft': 'ursalunabloodmoon-slow-special-breaker',
};
