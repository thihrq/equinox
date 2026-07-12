import { CompetitiveSetImporter } from '../equinox/data-import/CompetitiveSetImporter';
import { CompetitiveSetImportMode } from '../equinox/data-import/CompetitiveSetImportTypes';
import { buildAuditRuntimeReport, printAuditRuntimeReport, resetAuditRuntimeCounters } from '../equinox/data-audit/DataAuditRuntime';

resetAuditRuntimeCounters();
const args = parseArgs(process.argv.slice(2));
const file = args.file;
const regulationId = args.regulation;
const sourceId = args.source;
const mode = (args.publish ? 'publish' : args['replace-version'] ? 'replace-version' : args.rollback ? 'rollback' : 'dry-run') as CompetitiveSetImportMode;

if (typeof file !== 'string' || typeof regulationId !== 'string' || typeof sourceId !== 'string') {
  throw new Error('Usage: npm run sets:import -- --file ./data/sets.json --regulation champions_reg_m_b_doubles --source curated --dry-run');
}

const allowEmpty = Boolean(args['allow-empty']);
const report = new CompetitiveSetImporter().importFromFile({ file, regulationId, sourceId, mode, allowEmpty });
console.log(`[IMPORT MODE] ${mode}`);
console.log(`[SOURCE] ${file}`);
console.log(`[FILE EXISTS] ${report.loadResult.fileExists}`);
console.log(`[RAW RECORDS] ${report.loadResult.rawRecordCount}`);
console.log(`[REASON] ${report.loadResult.emptyReason ?? 'none'}`);
console.log(`[ALLOW EMPTY] ${allowEmpty}`);
console.log(`[WRITES] ${report.writtenCount}`);
console.log(JSON.stringify(report, null, 2));
printAuditRuntimeReport(buildAuditRuntimeReport([{
  type: 'file',
  path: file,
  label: 'import file',
  recordCount: report.readCount,
}]));

function parseArgs(values: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};
  for (let index = 0; index < values.length; index += 1) {
    const arg = values[index];
    if (!arg?.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}
