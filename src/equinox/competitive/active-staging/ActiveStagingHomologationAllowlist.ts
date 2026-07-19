import type { ActiveStagingHomologationScenario } from './ActiveStagingHomologationTypes';

export const ACTIVE_STAGING_SET_ALLOWLIST = [
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

export type ActiveStagingHomologationSetId = typeof ACTIVE_STAGING_SET_ALLOWLIST[number];

export const ACTIVE_STAGING_HOMOLOGATION_SCENARIOS: ActiveStagingHomologationScenario[] = [
  {
    id: 'sinistcha-aggronmega',
    leadPokemon: ['Sinistcha', 'Aggron-Mega'],
    expectedPresentedSetIds: [
      'sinistcha-bulky-trick-room-setter-draft',
      'aggronmega-slow-physical-breaker-draft',
    ],
  },
  {
    id: 'incineroar-ursalunabloodmoon',
    leadPokemon: ['Incineroar', 'Ursaluna-Bloodmoon'],
    expectedPresentedSetIds: [
      'incineroar-bulky-slow-pivot-draft',
      'ursalunabloodmoon-slow-special-breaker-draft',
    ],
  },
  {
    id: 'sinistcha-incineroar',
    leadPokemon: ['Sinistcha', 'Incineroar'],
    expectedPresentedSetIds: [
      'sinistcha-bulky-trick-room-setter-draft',
      'incineroar-bulky-slow-pivot-draft',
    ],
  },
  {
    id: 'aggronmega-ursalunabloodmoon',
    leadPokemon: ['Aggron-Mega', 'Ursaluna-Bloodmoon'],
    expectedPresentedSetIds: [
      'aggronmega-slow-physical-breaker-draft',
      'ursalunabloodmoon-slow-special-breaker-draft',
    ],
  },
  {
    id: 'pelipper-suicune',
    leadPokemon: ['Pelipper', 'Suicune'],
    expectedPresentedSetIds: [
      'pelipper-rain-setter-draft',
      'suicune-bulky-special-wall-draft',
    ],
  },
  {
    id: 'pelipper-hydreigon',
    leadPokemon: ['Pelipper', 'Hydreigon'],
    expectedPresentedSetIds: [
      'pelipper-rain-setter-draft',
      'hydreigon-fast-special-attacker-draft',
    ],
  },
  {
    id: 'hydreigon-indeedeefemale',
    leadPokemon: ['Hydreigon', 'Indeedee-F'],
    expectedPresentedSetIds: [
      'hydreigon-fast-special-attacker-draft',
      'indeedeefemale-redirection-support-draft',
    ],
  },
  {
    id: 'sinistcha-redirection-aggronmega-bodypress',
    leadPokemon: ['Sinistcha', 'Aggron-Mega'],
    expectedPresentedSetIds: [
      'sinistcha-redirection-support-draft',
      'aggronmega-body-press-defensive-attacker-draft',
    ],
  },
  {
    id: 'togekiss-ursalunabloodmoon',
    leadPokemon: ['Togekiss', 'Ursaluna-Bloodmoon'],
    expectedPresentedSetIds: [
      'togekiss-bulky-redirection-support-draft',
      'ursalunabloodmoon-slow-special-breaker-draft',
    ],
  },
  {
    id: 'mukalola-sinistcha-trickroom',
    leadPokemon: ['Muk-Alola', 'Sinistcha'],
    expectedPresentedSetIds: [
      'mukalola-special-wall-draft',
      'sinistcha-bulky-trick-room-setter-draft',
    ],
  },
  {
    id: 'incineroar-taunt-ursalunabloodmoon',
    leadPokemon: ['Incineroar', 'Ursaluna-Bloodmoon'],
    expectedPresentedSetIds: [
      'incineroar-fast-taunt-pivot-draft',
      'ursalunabloodmoon-slow-special-breaker-draft',
    ],
  },
  {
    id: 'indeedeefemale-giratinaorigin',
    leadPokemon: ['Indeedee-F', 'Giratina-Origin'],
    expectedPresentedSetIds: [
      'indeedeefemale-redirection-support-draft',
      'giratinaorigin-slow-special-attacker-draft',
    ],
  },
];

export function assertActiveStagingAllowlistIntegrity(): void {
  const allowlist = new Set<string>(ACTIVE_STAGING_SET_ALLOWLIST);
  const scenarioSetIds = new Set<string>();

  if (allowlist.size !== ACTIVE_STAGING_SET_ALLOWLIST.length) {
    throw new Error('Active staging allowlist must contain unique set IDs.');
  }

  for (const scenario of ACTIVE_STAGING_HOMOLOGATION_SCENARIOS) {
    for (const setId of scenario.expectedPresentedSetIds) {
      if (!allowlist.has(setId)) {
        throw new Error(`${scenario.id} references non-allowlisted set ${setId}.`);
      }
      scenarioSetIds.add(setId);
    }
  }

  if (scenarioSetIds.size !== allowlist.size) {
    throw new Error(`Mandatory scenarios must cover every allowlisted set ID, received ${scenarioSetIds.size} of ${allowlist.size}.`);
  }
}
