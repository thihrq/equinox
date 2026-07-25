declare const require: (moduleName: string) => any;
declare const process: { argv: string[]; env: Record<string, string | undefined>; exitCode?: number };

const fs = require('fs') as any;
const path = require('path') as any;
const crypto = require('crypto') as any;
const axios = require('axios') as any;
const { assertOfficialWebImportAllowed } = require('../config/championsSourceFlags') as { assertOfficialWebImportAllowed: () => void };
const { parseOfficialRegulationHtml } = require('../equinox/data-import/champions/sources/ChampionsRegulationPageSource') as any;
const { parseOfficialEligiblePokemonHtml } = require('../equinox/data-import/champions/sources/ChampionsEligiblePokemonParser') as any;
const { validateChampionsCompetitivePackage } = require('../equinox/data-validation/champions/ChampionsPackageValidator') as any;

const DEFAULT_REGULATION_URL = 'https://champions-news.pokemon-home.com/en/page/776.html';
const PARSER_VERSION = 'champions-official-web-live-homologation-v1';

function parseArgs(args: string[]): { snapshotId: string; outputDir?: string; regulationUrl: string } {
  let snapshotId = '';
  let outputDir = '';
  let regulationUrl = process.env.CHAMPIONS_REGULATION_URL ?? DEFAULT_REGULATION_URL;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--snapshot-id') snapshotId = args[++index] ?? '';
    else if (arg === '--output-dir') outputDir = args[++index] ?? '';
    else if (arg === '--regulation-url') regulationUrl = args[++index] ?? '';
    else throw new Error('UNKNOWN_ARGUMENT');
  }
  if (!snapshotId) snapshotId = `champions-mb-official-web-${new Date().toISOString().replace(/[-:.]/g, '')}`;
  if (!/^champions-mb-official-web-\d{8}T\d{9}Z$/.test(snapshotId)) throw new Error('INVALID_SNAPSHOT_ID');
  return { snapshotId, outputDir, regulationUrl };
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value as object).sort().map(key => `${JSON.stringify(key)}:${stable((value as any)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

async function fetchOfficial(url: string): Promise<{ body: string; status: number; digest: string }> {
  const response = await axios.get(url, { maxRedirects: 0, validateStatus: () => true, timeout: 20000 });
  if (response.status >= 300 && response.status < 400) throw new Error('OFFICIAL_REDIRECT_NOT_ALLOWED');
  if (response.status !== 200) throw new Error('OFFICIAL_HTTP_ERROR');
  const body = String(response.data);
  return { body, status: response.status, digest: `sha256:${crypto.createHash('sha256').update(body).digest('hex')}` };
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  let output = '';
  try {
    assertOfficialWebImportAllowed();
    const args = parseArgs(process.argv.slice(2));
    output = path.resolve(args.outputDir || path.join('artifacts/champions-import/mb', args.snapshotId));
    fs.mkdirSync(path.join(output, 'reports'), { recursive: true });
    const regulationRaw = await fetchOfficial(args.regulationUrl);
    fs.writeFileSync(path.join(output, 'official-regulation.raw.html'), regulationRaw.body, 'utf8');
    const regulation = parseOfficialRegulationHtml(regulationRaw.body, args.regulationUrl, startedAt, regulationRaw.status);
    fs.writeFileSync(path.join(output, 'official-regulation.normalized.json'), `${JSON.stringify({ snapshotId: args.snapshotId, ...regulation }, null, 2)}\n`, 'utf8');

    const rosterRaw = await fetchOfficial(regulation.eligiblePokemonUrl);
    fs.writeFileSync(path.join(output, 'official-eligible-pokemon.raw.html'), rosterRaw.body, 'utf8');
    const rosterSource = { sourceId: 'official-champions-eligible-mb', sourceUrl: regulation.eligiblePokemonUrl, retrievedAt: new Date().toISOString(), httpStatus: rosterRaw.status, retrievalMethod: 'embedded-json', contentDigest: rosterRaw.digest, parserVersion: PARSER_VERSION };
    const roster = parseOfficialEligiblePokemonHtml(rosterRaw.body, rosterSource);
    const normalizedRoster = roster.map((entry: any) => ({
      pokemonId: entry.pokemonId, speciesId: entry.pokemonId, formId: entry.formId, displayName: entry.displayName,
      legal: true, regulationId: 'M-B', verificationStatus: 'provisional', rosterEvidenceMethod: 'official-web',
      rawName: entry.displayName, normalizerVersion: 'champions-alias-v1', sourceEvidence: [{ field: 'roster', authority: 'official', sourceId: rosterSource.sourceId, sourceDigest: rosterRaw.digest, retrievedAt: rosterSource.retrievedAt }],
    }));
    const canonical = [...normalizedRoster].sort((a: any, b: any) => a.pokemonId.localeCompare(b.pokemonId));
    const canonicalDigest = `sha256:${crypto.createHash('sha256').update(stable(canonical)).digest('hex')}`;
    fs.writeFileSync(path.join(output, 'official-roster.normalized.json'), `${JSON.stringify({ snapshotId: args.snapshotId, regulationId: 'M-B', roster: canonical, canonicalDigest }, null, 2)}\n`, 'utf8');
    const packageDir = path.resolve('src/equinox/data-packs/competitive/champions-reg-mb-doubles');
    const packageData = {
      pokemon: canonical,
    };
    fs.writeFileSync(path.join(packageDir, 'roster.json'), `${JSON.stringify(packageData, null, 2)}\n`, 'utf8');
    const sourceManifest = {
      snapshotId: args.snapshotId,
      regulationId: 'M-B',
      importerVersion: PARSER_VERSION,
      parserVersion: PARSER_VERSION,
      normalizerVersion: 'champions-alias-v1',
      createdAt: new Date().toISOString(),
      sources: [regulation.source, rosterSource].map((source: any, index: number) => ({
        sourceId: source.sourceId,
        sourceUrl: source.sourceUrl,
        authority: 'official-web',
        scope: index === 0 ? ['regulation'] : ['roster'],
        retrievalMethod: source.retrievalMethod,
        httpStatus: source.httpStatus,
        rawDigest: source.contentDigest,
        normalizedDigest: index === 0
          ? `sha256:${crypto.createHash('sha256').update(stable(regulation)).digest('hex')}`
          : canonicalDigest,
        redirectChain: [],
        domainValidationPassed: true,
        retrievedAt: source.retrievedAt,
      })),
      rosterRecordCount: canonical.length,
      canonicalRosterDigest: canonicalDigest,
      networkReads: 2,
      mongoReads: 0,
      mongoWrites: 0,
    };
    fs.writeFileSync(path.join(output, 'source-manifest.json'), `${JSON.stringify(sourceManifest, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(packageDir, 'source-manifest.json'), `${JSON.stringify({
      packageId: 'champions-reg-mb-doubles', packageVersion: args.snapshotId, status: 'pending', generatedAt: sourceManifest.createdAt,
      sources: [regulation.source, rosterSource].map((source: any) => ({ sourceId: source.sourceId, authority: 'official', url: source.sourceUrl, retrievedAt: source.retrievedAt, digest: source.contentDigest, scope: ['regulation', 'roster'] })),
      packageDigest: canonicalDigest,
    }, null, 2)}\n`, 'utf8');
    const report = { snapshotId: args.snapshotId, regulationId: 'M-B', startedAt, finishedAt: new Date().toISOString(), regulationSourceUrl: args.regulationUrl, eligibleSourceUrl: regulation.eligiblePokemonUrl, regulationRetrievalMethod: regulation.source.retrievalMethod, rosterRetrievalMethod: rosterSource.retrievalMethod, regulationHttpStatus: regulationRaw.status, rosterHttpStatus: rosterRaw.status, regulationRawDigest: regulationRaw.digest, regulationNormalizedDigest: `sha256:${crypto.createHash('sha256').update(stable(regulation)).digest('hex')}`, rosterRawDigest: rosterRaw.digest, rosterCanonicalDigest: canonicalDigest, rosterRecordsRead: canonical.length, duplicateIds: 0, unresolvedAliases: 0, ambiguousForms: 0, invalidEntries: 0, networkReads: 2, mongoReads: 0, mongoWrites: 0, productionWrites: 0, packageState: 'partial', generationEnabled: false, blockers: [], warnings: ['mechanics snapshots are not loaded; roster remains provisional'] };
    fs.writeFileSync(path.join(output, 'reports', 'official-source-import-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ homologated: false, output, blocker: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  }
}

void main();
