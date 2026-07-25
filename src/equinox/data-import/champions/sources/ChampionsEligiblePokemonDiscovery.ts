declare const require: (moduleName: string) => any;
const { assertOfficialWebUrl } = require('./ChampionsOfficialWebPolicy') as { assertOfficialWebUrl: (input: string) => string };

export function discoverOfficialEligiblePokemonUrl(html: string, sourceUrl: string): string {
  const href = html.match(/href=["']([^"']*(?:eligible|pokemon)[^"']*)["']/i)?.[1];
  if (!href) throw new Error('OFFICIAL_ELIGIBLE_URL_MISSING');
  const resolved = new URL(href, sourceUrl).href;
  try { return assertOfficialWebUrl(resolved); } catch { throw new Error('OFFICIAL_ELIGIBLE_URL_NOT_ALLOWED'); }
}
