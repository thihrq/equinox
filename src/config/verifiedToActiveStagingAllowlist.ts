export const VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST = [
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

export type VerifiedToActiveStagingSetId = typeof VERIFIED_TO_ACTIVE_STAGING_ALLOWLIST[number];

export const VERIFIED_TO_ACTIVE_STAGING_SET_KEYS: Record<VerifiedToActiveStagingSetId, string> = {
  'sinistcha-bulky-trick-room-setter-draft': 'sinistcha-bulky-trick-room-setter',
  'aggronmega-slow-physical-breaker-draft': 'aggronmega-slow-physical-breaker',
  'incineroar-bulky-slow-pivot-draft': 'incineroar-bulky-slow-pivot',
  'ursalunabloodmoon-slow-special-breaker-draft': 'ursalunabloodmoon-slow-special-breaker',
  'suicune-bulky-special-wall-draft': 'suicune-bulky-special-wall',
  'pelipper-rain-setter-draft': 'pelipper-rain-setter',
  'hydreigon-fast-special-attacker-draft': 'hydreigon-fast-special-attacker',
  'indeedeefemale-redirection-support-draft': 'indeedeefemale-redirection-support',
  'sinistcha-redirection-support-draft': 'sinistcha-redirection-support',
  'aggronmega-body-press-defensive-attacker-draft': 'aggronmega-body-press-defensive-attacker',
  'incineroar-fast-taunt-pivot-draft': 'incineroar-fast-taunt-pivot',
  'togekiss-bulky-redirection-support-draft': 'togekiss-bulky-redirection-support',
  'mukalola-special-wall-draft': 'mukalola-special-wall',
  'giratinaorigin-slow-special-attacker-draft': 'giratinaorigin-slow-special-attacker',
};
