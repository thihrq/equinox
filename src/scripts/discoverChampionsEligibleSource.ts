declare const require: (moduleName: string) => any;
declare const process: { env: Record<string, string | undefined>; exitCode?: number };

const axios = require('axios') as any;
const { assertOfficialWebImportAllowed } = require('../config/championsSourceFlags') as { assertOfficialWebImportAllowed: () => void };
const { discoverOfficialEligiblePokemonUrl } = require('../equinox/data-import/champions/sources/ChampionsEligiblePokemonDiscovery') as { discoverOfficialEligiblePokemonUrl: (html: string, url: string) => string };

const url = process.env.CHAMPIONS_REGULATION_URL ?? 'https://champions-news.pokemon-home.com/en/page/776.html';
async function main(): Promise<void> {
  try {
    assertOfficialWebImportAllowed();
    const response = await axios.get(url, { maxRedirects: 0, validateStatus: () => true, timeout: 15000 });
    if (response.status !== 200) throw new Error('OFFICIAL_REGULATION_HTTP_ERROR');
    console.log(JSON.stringify({ sourceUrl: url, eligiblePokemonUrl: discoverOfficialEligiblePokemonUrl(response.data, url) }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ discovered: false, blocker: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  }
}
void main();
