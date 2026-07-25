import { loadChampionsCompetitivePackage } from '../equinox/data-packs/champions/loadChampionsCompetitivePackage';
import { validateChampionsCompetitivePackage } from '../equinox/data-validation/champions/ChampionsPackageValidator';

declare const process: { exitCode?: number };

const result = validateChampionsCompetitivePackage(loadChampionsCompetitivePackage());
console.log(JSON.stringify(result, null, 2));

if (result.status === 'blocked') process.exitCode = 1;
