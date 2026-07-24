import fs from 'fs';
import path from 'path';

// Real, offline, grep-based import audit -- no execution of the audited files, no network, no Mongo.
// Gate: speedReferenceProductionImportCount = 0, runtimePkmnSimImportCount = 0.

const ADAPTER_FILE = 'src/services/competitive-data/reference-conformance/adapters/PokemonShowdownSpeedReferenceAdapter.ts';

const FORBIDDEN_PRODUCTION_IMPORTS = [
  'SpeedTierEngine', 'SpeedTierTypes', 'CandidateScore', 'CombinationSearch', 'CombinationSearchEngine',
  'TeamController', 'RecommendationAdapter', 'TeamService', 'LeadStrategyRecommendationService',
  'CandidateSelector', 'DiversityCandidateSelector', 'VgcTeamBuilding',
];

const RUNTIME_ROOTS = ['src/controllers', 'src/services', 'src/equinox', 'src/routes', 'src/scripts', 'src/config', 'src/utils'].filter(dir => fs.existsSync(dir));
const REFERENCE_CONFORMANCE_DIR = path.normalize('src/services/competitive-data/reference-conformance');

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function fail(message: string, code: number): never { console.error(message); process.exitCode = code; throw new Error(message); }
function writeAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function walk(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) && !entry.name.endsWith('.test.ts')) out.push(full);
  }
}

function extractImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const importRegex = /import\s+(?:type\s+)?(?:[\w*\s{},]+\s+from\s+)?['"]([^'"]+)['"]/g;
  let match = importRegex.exec(source);
  while (match) {
    specifiers.push(match[1]);
    match = importRegex.exec(source);
  }
  return specifiers;
}

function main(): void {
  const allowed = new Set(['--run-id', '--output-dir']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  const outputDir = arg('--output-dir') ?? `artifacts/competitive-production-readiness/${runId ?? 'missing-run-id'}/mechanics-reference`;
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  if (!fs.existsSync(ADAPTER_FILE)) fail(`Adapter file missing: ${ADAPTER_FILE}`, 4);

  const adapterSource = fs.readFileSync(ADAPTER_FILE, 'utf8');
  const adapterImports = extractImportSpecifiers(adapterSource);
  const forbiddenInAdapter = adapterImports.filter(specifier =>
    FORBIDDEN_PRODUCTION_IMPORTS.some(name => specifier.includes(name)));
  const allowedPrefixes = ['@pkmn/sim', '../contracts/'];
  const disallowedInAdapter = adapterImports.filter(specifier => !allowedPrefixes.some(prefix => specifier.startsWith(prefix)) && !specifier.startsWith('node:') && !['fs', 'path', 'crypto'].includes(specifier));

  const runtimeFiles: string[] = [];
  for (const root of RUNTIME_ROOTS) walk(root, runtimeFiles);
  const runtimePkmnSimImports: { file: string; specifier: string }[] = [];
  for (const file of runtimeFiles) {
    const normalized = path.normalize(file);
    if (normalized.startsWith(REFERENCE_CONFORMANCE_DIR)) continue; // the reference module itself is allowed to import @pkmn/sim
    const source = fs.readFileSync(file, 'utf8');
    for (const specifier of extractImportSpecifiers(source)) {
      if (specifier === '@pkmn/sim' || specifier === '@smogon/calc') runtimePkmnSimImports.push({ file: normalized, specifier });
    }
  }

  const result = {
    runId,
    adapterFile: ADAPTER_FILE,
    adapterImports,
    speedReferenceProductionImportCount: forbiddenInAdapter.length,
    forbiddenImportsFound: forbiddenInAdapter,
    disallowedImportsFound: disallowedInAdapter,
    runtimeFilesScanned: runtimeFiles.length,
    runtimePkmnSimImportCount: runtimePkmnSimImports.length,
    runtimePkmnSimImports,
    status: forbiddenInAdapter.length === 0 && disallowedInAdapter.length === 0 && runtimePkmnSimImports.length === 0 ? 'pass' : 'fail',
    reasonCode: forbiddenInAdapter.length > 0 || disallowedInAdapter.length > 0 || runtimePkmnSimImports.length > 0 ? 'REFERENCE_DEPENDENCY_RUNTIME_LEAK' : null,
    mongoReads: 0, mongoWrites: 0, productionWrites: 0,
  };
  writeAtomic(path.resolve(outputDir, 'speed-runtime-isolation-audit.json'), result);
  console.log(JSON.stringify(result));
  if (result.status !== 'pass') process.exitCode = 14;
}

try {
  main();
} catch (error) {
  if (process.exitCode === undefined) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 19;
  }
}
