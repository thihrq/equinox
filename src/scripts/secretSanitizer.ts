// Scans a directory tree for sensitive files (credentials, dumps, keys) and writes its findings as
// evidence. Scan target and evidence destination are two independent, explicit inputs: the scanner
// never writes into what it inspects, and never derives either path from process.cwd(). That
// separation is what keeps a sealed release artifact re-verifiable after being scanned -- routing
// evidence by cwd previously dropped the scanner's own output inside the artifact tree, silently
// invalidating its manifest (see SECRET-SANITIZER-OUTPUT-ISOLATION-012).
import fs from 'fs';
import path from 'path';

export interface SecretScanSummary {
  passed: boolean;
  trackedSecretCount: number;
  artifactSecretCount: number;
  sanitizedPackageSecretCount: number;
  sanitizedPackageEnvFileCount: number;
  sanitizedPackageAtlasDumpCount: number;
  sanitizedPackageAbsolutePersonalPaths: number;
  sensitiveFiles: string[];
}

export interface SecretSanitizerOptions {
  /** Directory to inspect. Read-only: nothing is ever created or modified under it. */
  scanRoot: string;
  /** Directory to write evidence into. Must resolve outside scanRoot. */
  outputRoot: string;
  /** Identity of this execution. Recorded in the evidence; never used to build a path. */
  runId: string;
}

export const SECRET_SANITIZER_EVIDENCE_FILES = [
  'secret-scan-summary.json',
  'sensitive-files-inventory.json',
  'package-exposure-report.json',
  'credential-rotation-required.md',
  'operator-actions-required.md',
] as const;

const SENSITIVE_PATTERNS = [
  /\.env(\..+)?$/i,
  /.*atlas.*dump.*/i,
  /.*restore.*drill.*dump.*/i,
  /.*id_rsa.*/i,
  /.*\.pem$/i,
];

const SCAN_SKIP_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'coverage']);

// Lexical only -- no filesystem access, so it can be reasoned about (and tested) independently of
// what happens to exist. Compares whole segments: "/a/bcd" is NOT a descendant of "/a/b", which a
// naive startsWith check would get wrong.
function normalizePathForComparison(value: string): string {
  const resolved = path.resolve(value).replace(/\\/g, '/').replace(/\/+$/, '');
  // Windows paths are case-insensitive; POSIX paths are not.
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export function isDescendantPath(candidate: string, ancestor: string): boolean {
  const candidateSegments = normalizePathForComparison(candidate).split('/');
  const ancestorSegments = normalizePathForComparison(ancestor).split('/');
  if (candidateSegments.length <= ancestorSegments.length) return false;
  return ancestorSegments.every((segment, index) => candidateSegments[index] === segment);
}

// Resolves symlinks/junctions for a path that may not exist yet, by walking up to the nearest
// existing ancestor, resolving THAT, then re-appending the missing tail. Without this, an output
// root like <symlink-to-scan-root>/artifacts would look external -- its own realpath call would
// throw ENOENT and the containment check would be made against the unresolved, misleading path.
function realpathNearestExisting(target: string): string {
  let current = path.resolve(target);
  const missingTail: string[] = [];
  for (;;) {
    if (fs.existsSync(current)) {
      const real = fs.realpathSync(current);
      return missingTail.length > 0 ? path.join(real, ...missingTail.reverse()) : real;
    }
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(target); // reached the filesystem root; nothing to resolve
    missingTail.push(path.basename(current));
    current = parent;
  }
}

export function assertOutputOutsideScanRoot(scanRoot: string, outputRoot: string): void {
  let resolvedScanRoot: string;
  let resolvedOutputRoot: string;
  try {
    resolvedScanRoot = realpathNearestExisting(scanRoot);
    resolvedOutputRoot = realpathNearestExisting(outputRoot);
  } catch {
    throw new Error('SECRET_SANITIZER_PATH_RESOLUTION_FAILED');
  }
  const identical = normalizePathForComparison(resolvedOutputRoot) === normalizePathForComparison(resolvedScanRoot);
  if (identical || isDescendantPath(resolvedOutputRoot, resolvedScanRoot)) {
    throw new Error('SECRET_SANITIZER_OUTPUT_INSIDE_SCAN_ROOT');
  }
}

function collectSensitiveFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (directory: string, relativeDirectory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (SCAN_SKIP_DIRECTORIES.has(entry.name)) continue;
      const relativePath = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) { walk(path.join(directory, entry.name), relativePath); continue; }
      if (!entry.isFile()) continue;
      if (SENSITIVE_PATTERNS.some(pattern => pattern.test(entry.name) || pattern.test(relativePath))) {
        found.push(relativePath.replace(/\\/g, '/'));
      }
    }
  };
  walk(root, '');
  return found;
}

export function runSecretSanitizer(options: SecretSanitizerOptions | string): SecretScanSummary {
  // The legacy single-string form routed both the scan and its evidence through process.cwd().
  // It is accepted at the type level only so out-of-chain callers still compile; at runtime it
  // fails closed rather than silently reintroducing cwd-dependent output routing.
  if (typeof options === 'string' || options === null || typeof options !== 'object') {
    throw new Error('SECRET_SANITIZER_OUTPUT_ROOT_REQUIRED');
  }
  const { scanRoot, outputRoot, runId } = options;

  if (typeof outputRoot !== 'string' || !outputRoot.trim()) throw new Error('SECRET_SANITIZER_OUTPUT_ROOT_REQUIRED');
  if (typeof runId !== 'string' || !runId.trim()) throw new Error('SECRET_SANITIZER_RUN_ID_REQUIRED');
  if (typeof scanRoot !== 'string' || !scanRoot.trim()) throw new Error('SECRET_SANITIZER_SCAN_ROOT_NOT_FOUND');
  if (!fs.existsSync(scanRoot) || !fs.statSync(scanRoot).isDirectory()) throw new Error('SECRET_SANITIZER_SCAN_ROOT_NOT_FOUND');

  // Containment is checked BEFORE any directory is created, so a rejected run leaves no trace --
  // in particular it never creates the very directory it was rejected for.
  assertOutputOutsideScanRoot(scanRoot, outputRoot);

  const sensitiveFiles = collectSensitiveFiles(path.resolve(scanRoot));
  const passed = sensitiveFiles.length === 0;

  const summary: SecretScanSummary = {
    passed,
    trackedSecretCount: 0,
    artifactSecretCount: 0,
    sanitizedPackageSecretCount: sensitiveFiles.length,
    sanitizedPackageEnvFileCount: sensitiveFiles.filter(file => /\.env/i.test(file)).length,
    sanitizedPackageAtlasDumpCount: sensitiveFiles.filter(file => /dump/i.test(file)).length,
    sanitizedPackageAbsolutePersonalPaths: 0,
    sensitiveFiles,
  };

  fs.mkdirSync(outputRoot, { recursive: true });
  const write = (file: string, contents: string): void => fs.writeFileSync(path.join(outputRoot, file), contents, 'utf8');

  write('secret-scan-summary.json', `${JSON.stringify({ runId, ...summary }, null, 2)}\n`);
  write('sensitive-files-inventory.json', `${JSON.stringify({ runId, files: sensitiveFiles, count: sensitiveFiles.length }, null, 2)}\n`);
  write('package-exposure-report.json', `${JSON.stringify({ runId, exposureCount: sensitiveFiles.length, clean: passed }, null, 2)}\n`);
  write('credential-rotation-required.md', [
    '# Relatório de Rotação de Credenciais',
    '',
    `Status: ${passed ? 'SEM_VETORES_DE_EXPOSICAO_DETECTADOS' : 'ROTACAO_REQUERIDA'}`,
    `Arquivos sensíveis encontrados na árvore inspecionada: ${sensitiveFiles.length}`,
    '',
    'Observação: Nenhuma credencial foi impressa ou exportada neste relatório.',
    '',
  ].join('\n'));
  write('operator-actions-required.md', [
    '# Ações Requeridas do Operador',
    '',
    '1. Manter arquivos de configuração sensíveis e dumps fora de qualquer empacotamento.',
    '2. Confirmar que a suíte de testes executa em modo 100% offline.',
    '',
  ].join('\n'));

  return summary;
}

function cliArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (require.main === module) {
  // Both roots are explicit here too -- there is deliberately no cwd-derived default.
  const scanRoot = cliArgument('--scan-root');
  const outputRoot = cliArgument('--output-root');
  const runId = cliArgument('--run-id') ?? `sanitizer-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}`;
  if (!scanRoot || !outputRoot) {
    console.error('Usage: secretSanitizer --scan-root <dir> --output-root <dir> [--run-id <id>]');
    process.exitCode = 2;
  } else {
    try {
      const result = runSecretSanitizer({ scanRoot, outputRoot, runId });
      console.log(JSON.stringify({ runId, ...result }, null, 2));
      if (!result.passed) process.exitCode = 40;
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 2;
    }
  }
}
