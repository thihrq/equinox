// Wave 3 -- pure data, no side effects. Shared by buildChampionsWave3RosterReconciliation.ts
// (the CLI) and any other Wave 3 script that needs to know which species were already processed
// in prior waves. Kept separate from the CLI script so importing this list never triggers that
// script's top-level main() invocation.
export const SENTINEL_POKEMON_IDS = ['0003-000', '0006-000', '0009-000', '0015-000', '0018-000', '0024-000', '0025-000', '0026-000', '0036-000', '0038-000'];
export const PILOT_POKEMON_IDS = ['0308-000', '0637-000', '0670-005', '0115-000', '0154-000', '0389-000', '0724-000', '0823-000', '0908-000', '0045-000', '0059-000', '0065-000', '0068-000', '0071-000', '0080-000', '0094-000', '0121-000', '0127-000', '0128-000', '0130-000'];
export const ALREADY_PROCESSED_POKEMON_IDS = [...SENTINEL_POKEMON_IDS, ...PILOT_POKEMON_IDS];
