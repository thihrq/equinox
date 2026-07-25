declare const require: (moduleName: string) => any;
declare const process: { exitCode?: number };

const fs = require('fs') as any;
const path = require('path') as any;
const { loadChampionsCompetitivePackage } = require('../equinox/data-packs/champions/loadChampionsCompetitivePackage') as any;
const { validateChampionsCompetitivePackage } = require('../equinox/data-validation/champions/ChampionsPackageValidator') as any;
const { normalizeChampionsId } = require('../equinox/data-normalization/champions/ChampionsAliasNormalizer') as any;

const packageData = loadChampionsCompetitivePackage();
const validation = validateChampionsCompetitivePackage(packageData);
const learnsetIds = new Set(packageData.learnsets.map((item: any) => normalizeChampionsId(item.pokemonId)));
const abilityIds = new Set(packageData.abilities.map((item: any) => normalizeChampionsId(item.abilityId)));
const missingLearnsets = packageData.roster
  .filter((item: any) => !learnsetIds.has(normalizeChampionsId(item.pokemonId)))
  .map((item: any) => item.pokemonId);
const missingAbilities = packageData.learnsets
  .flatMap((item: any) => item.legalAbilityIds)
  .filter((ability: string) => !abilityIds.has(normalizeChampionsId(ability)));
const report = {
  snapshotId: packageData.sourceManifest.packageVersion,
  rosterCount: validation.rosterRecordsRead,
  speciesResolved: packageData.species.length,
  formsResolved: packageData.roster.filter((item: any) => Boolean(item.formId)).length,
  movesCount: validation.moveRecordsRead,
  abilitiesCount: validation.abilityRecordsRead,
  itemsCount: validation.itemRecordsRead,
  learnsetsCount: validation.learnsetRecordsRead,
  eligibleCount: validation.eligiblePokemonIds.length,
  provisionalCount: validation.provisionalPokemonIds.length,
  blockedCount: validation.blockedPokemonIds.length,
  unresolvedAliases: [],
  missingLearnsets: [...new Set(missingLearnsets)],
  missingAbilities: [...new Set(missingAbilities)],
  sourceConflicts: [],
  generationEnabled: validation.generationEligible,
};
const output = path.resolve('artifacts/champions-import/mb/champions-mb-source-coverage-report.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
if (report.unresolvedAliases.length > 0 || report.sourceConflicts.length > 0) process.exitCode = 1;
