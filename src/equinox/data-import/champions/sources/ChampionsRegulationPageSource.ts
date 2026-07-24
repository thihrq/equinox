declare const require: (moduleName: string) => any;
const crypto = require('crypto') as any;
const { assertOfficialWebUrl } = require('./ChampionsOfficialWebPolicy') as { assertOfficialWebUrl: (input: string) => string };
import { OfficialRegulationSnapshot } from './ChampionsOfficialWebSourceTypes';

const PARSER_VERSION = 'champions-official-regulation-v1';

export function parseOfficialRegulationHtml(html: string, sourceUrl: string, retrievedAt: string, httpStatus = 200): OfficialRegulationSnapshot {
  if (httpStatus !== 200) throw new Error('OFFICIAL_REGULATION_HTTP_ERROR');
  if (!html.trim() || /<title>\s*(error|not found|404)/i.test(html)) throw new Error('OFFICIAL_REGULATION_EMPTY');
  const regulationId = /Regulation\s+Set\s+M-B/i.test(html) ? 'M-B' : null;
  if (!regulationId) throw new Error('OFFICIAL_REGULATION_ID_MISMATCH');
  const eligibleHref = html.match(/href=["']([^"']*(?:eligible|pokemon)[^"']*)["']/i)?.[1];
  if (!eligibleHref) throw new Error('OFFICIAL_ELIGIBLE_URL_MISSING');
  const eligiblePokemonUrl = new URL(eligibleHref, sourceUrl).href;
  assertOfficialWebUrl(eligiblePokemonUrl);
  const period = html.match(/([A-Z][a-z]+\s+\d{1,2},\s+\d{4}).*?([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/s);
  const itemClause = /Duplicate\s+held\s+items\s+are\s+not\s+allowed/i.test(html);
  const maxMegaMatch = html.match(/Mega Evolution only one time|only\s+(\d+)\s+time per battle/i);
  return {
    regulationId,
    validFrom: period?.[1] ?? '',
    validUntil: period?.[2] ?? '',
    eligiblePokemonUrl,
    itemClause,
    maxMegaEvolutionsPerBattle: maxMegaMatch?.[1] ? Number(maxMegaMatch[1]) : 1,
    source: {
      sourceId: 'official-champions-regulation-mb',
      sourceUrl: assertOfficialWebUrl(sourceUrl),
      retrievedAt,
      httpStatus,
      retrievalMethod: 'static-html',
      contentDigest: `sha256:${crypto.createHash('sha256').update(html).digest('hex')}`,
      parserVersion: PARSER_VERSION,
    },
  };
}
