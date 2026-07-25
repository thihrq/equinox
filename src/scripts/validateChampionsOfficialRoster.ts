declare const require: (moduleName: string) => any;
declare const process: { argv: string[]; exitCode?: number };
const fs = require('fs') as any;
const { parseOfficialEligiblePokemonJson } = require('../equinox/data-import/champions/sources/ChampionsEligiblePokemonParser') as any;
const inputPath = process.argv[2] ?? 'src/equinox/data-packs/competitive/champions-reg-mb-doubles/roster.json';
if (!inputPath || !fs.existsSync(inputPath) || !fs.statSync(inputPath).isFile()) {
  console.error(JSON.stringify({ valid: false, blocker: 'OFFICIAL_ELIGIBLE_SOURCE_UNAVAILABLE' }, null, 2));
  process.exitCode = 1;
} else {
  try {
    const source = { sourceId: 'official-champions-eligible-mb', sourceUrl: 'file://offline', retrievedAt: new Date().toISOString(), httpStatus: 200, retrievalMethod: 'static-html', contentDigest: 'offline-fixture', parserVersion: 'official-roster-v1' };
    const records = parseOfficialEligiblePokemonJson(fs.readFileSync(inputPath, 'utf8'), source);
    console.log(JSON.stringify({ valid: true, rosterCount: records.length, records }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ valid: false, blocker: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  }
}
