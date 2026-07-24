declare const require: (moduleName: string) => any;
const { URL } = require('url') as { URL: new (input: string) => { protocol: string; hostname: string; href: string } };

export const OFFICIAL_CHAMPIONS_HOSTS = new Set([
  'champions-news.pokemon-home.com',
  'web-view.app.pokemonchampions.jp',
]);

export function assertOfficialWebUrl(input: string): string {
  const url = new URL(input);
  if (url.protocol !== 'https:' || !OFFICIAL_CHAMPIONS_HOSTS.has(url.hostname)) {
    throw new Error('OFFICIAL_ELIGIBLE_DOMAIN_NOT_ALLOWED');
  }
  return url.href;
}
