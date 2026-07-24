declare const require: (moduleName: string) => any;
declare const process: { env: Record<string, string | undefined>; exitCode?: number };

const fs = require('fs') as any;
const path = require('path') as any;
const axios = require('axios') as any;
const { assertOfficialWebImportAllowed } = require('../config/championsSourceFlags') as { assertOfficialWebImportAllowed: () => void };
const { parseOfficialRegulationHtml } = require('../equinox/data-import/champions/sources/ChampionsRegulationPageSource') as { parseOfficialRegulationHtml: (html: string, url: string, retrievedAt: string, status?: number) => unknown };

const url = process.env.CHAMPIONS_REGULATION_URL ?? 'https://champions-news.pokemon-home.com/en/page/776.html';
async function main(): Promise<void> {
  try {
    assertOfficialWebImportAllowed();
    const retrievedAt = new Date().toISOString();
    const response = await axios.get(url, { maxRedirects: 0, validateStatus: () => true, timeout: 15000 });
    const snapshot = parseOfficialRegulationHtml(response.data, url, retrievedAt, response.status) as any;
    const snapshotId = process.env.CHAMPIONS_MB_SNAPSHOT_ID ?? `champions-mb-web-${retrievedAt.replace(/[-:.]/g, '')}`;
    const output = path.resolve('artifacts/champions-import/mb', snapshotId);
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'official-regulation.raw.html'), response.data, 'utf8');
    fs.writeFileSync(path.join(output, 'official-regulation.normalized.json'), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(snapshot, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ imported: false, blocker: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  }
}

void main();
