import { loadChampionsCompetitivePackage } from '../equinox/data-packs/champions/loadChampionsCompetitivePackage';
import { validateChampionsCompetitivePackage } from '../equinox/data-validation/champions/ChampionsPackageValidator';

declare const process: { exitCode?: number };

const result = validateChampionsCompetitivePackage(loadChampionsCompetitivePackage());
console.log(JSON.stringify({
  packageState: result.packageState,
  rosterRecordsRead: result.rosterRecordsRead,
  moveRecordsRead: result.moveRecordsRead,
  abilityRecordsRead: result.abilityRecordsRead,
  itemRecordsRead: result.itemRecordsRead,
  learnsetRecordsRead: result.learnsetRecordsRead,
  eligibleForGeneration: result.eligiblePokemonIds,
  provisional: result.provisionalPokemonIds,
  blocked: result.blockedPokemonIds,
  blockers: result.blockers.map(blocker => blocker.code),
  generationEnabled: result.generationEligible,
}, null, 2));

if (result.status === 'blocked') process.exitCode = 1;
