import fs from 'fs';
import path from 'path';

export interface CompetitivePipelineRuntimeBoundaryInput {
  repositoryRoot: string;
  runtimeEntrypoints: readonly string[];
  lifecycleFiles: readonly string[];
}

export interface CompetitivePipelineRuntimeBoundaryViolation {
  sourcePath: string;
  importedPath: string;
  importKind: 'static-import' | 'require' | 'dynamic-import' | 'npm-lifecycle';
  matchedRule: string;
}

export interface CompetitivePipelineRuntimeBoundaryResult {
  valid: boolean;
  inspectedEntrypoints: readonly string[];
  inspectedModuleCount: number;
  violations: readonly CompetitivePipelineRuntimeBoundaryViolation[];
}

const OFFLINE_MODULE_PATTERNS = [
  /runChampionsWave[123]QA/,
  /src\/services\/competitive-data\/curation\//,
  /src\/services\/competitive-data\/expert\//,
  /src\/services\/competitive-data\/wave2\//,
  /src\/services\/competitive-data\/wave3\//,
  /src\/scripts\/runChampions/,
  /src\/scripts\/validateChampions/,
  /src\/scripts\/buildChampions/,
  /src\/scripts\/auditChampions/,
  /src\/scripts\/homologateChampions/,
  /src\/scripts\/crosscheckChampions/,
];

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

function isOfflineModule(relativePath: string): boolean {
  const norm = normalizePath(relativePath);
  return OFFLINE_MODULE_PATTERNS.some(pattern => pattern.test(norm));
}

function resolveImportPath(sourceFile: string, importPath: string, rootDir: string): string | null {
  if (!importPath.startsWith('.')) return null;

  const sourceDir = path.dirname(path.resolve(rootDir, sourceFile));
  const absoluteTarget = path.resolve(sourceDir, importPath);

  const extensions = ['', '.ts', '.tsx', '.js', '/index.ts', '/index.js'];
  for (const ext of extensions) {
    const candidate = absoluteTarget + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return normalizePath(path.relative(rootDir, candidate));
    }
  }

  return null;
}

export function inspectCompetitivePipelineRuntimeBoundary(
  input: CompetitivePipelineRuntimeBoundaryInput,
): CompetitivePipelineRuntimeBoundaryResult {
  const rootDir = path.resolve(input.repositoryRoot);
  const violations: CompetitivePipelineRuntimeBoundaryViolation[] = [];
  const visitedModules = new Set<string>();
  const queue: string[] = [...input.runtimeEntrypoints];

  // 1. Audit static and dynamic imports transitively
  while (queue.length > 0) {
    const currentRelativePath = normalizePath(queue.shift()!);
    if (visitedModules.has(currentRelativePath)) continue;
    visitedModules.add(currentRelativePath);

    const fullPath = path.resolve(rootDir, currentRelativePath);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');

    // Static imports (both 'from "..."' and side-effect 'import "..."')
    const importSpecifiers: string[] = [];

    // Named / default imports: import ... from '...' or export ... from '...'
    const fromRegex = /(?:import|export)\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = fromRegex.exec(content)) !== null) {
      importSpecifiers.push(match[1]);
    }

    // Side-effect imports: import '...'
    const sideEffectRegex = /import\s+['"]([^'"]+)['"]/g;
    while ((match = sideEffectRegex.exec(content)) !== null) {
      importSpecifiers.push(match[1]);
    }

    for (const specifier of importSpecifiers) {
      const resolved = resolveImportPath(currentRelativePath, specifier, rootDir);

      if (resolved) {
        if (isOfflineModule(resolved)) {
          violations.push({
            sourcePath: currentRelativePath,
            importedPath: resolved,
            importKind: 'static-import',
            matchedRule: 'COMPETITIVE_PIPELINE_RUNTIME_BOUNDARY_VIOLATION',
          });
        } else if (!visitedModules.has(resolved)) {
          queue.push(resolved);
        }
      }
    }

    // Require imports
    const requireRegex = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      const specifier = match[1];
      const resolved = resolveImportPath(currentRelativePath, specifier, rootDir);

      if (resolved) {
        if (isOfflineModule(resolved)) {
          violations.push({
            sourcePath: currentRelativePath,
            importedPath: resolved,
            importKind: 'require',
            matchedRule: 'COMPETITIVE_PIPELINE_RUNTIME_BOUNDARY_VIOLATION',
          });
        } else if (!visitedModules.has(resolved)) {
          queue.push(resolved);
        }
      }
    }

    // Dynamic imports
    const dynamicImportRegex = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      const specifier = match[1];
      const resolved = resolveImportPath(currentRelativePath, specifier, rootDir);

      if (resolved) {
        if (isOfflineModule(resolved)) {
          violations.push({
            sourcePath: currentRelativePath,
            importedPath: resolved,
            importKind: 'dynamic-import',
            matchedRule: 'COMPETITIVE_PIPELINE_RUNTIME_BOUNDARY_VIOLATION',
          });
        } else if (!visitedModules.has(resolved)) {
          queue.push(resolved);
        }
      }
    }
  }

  // 2. Audit npm lifecycle scripts in package.json files
  for (const lifecycleFile of input.lifecycleFiles) {
    const fullPkgPath = path.resolve(rootDir, lifecycleFile);
    if (!fs.existsSync(fullPkgPath)) continue;

    try {
      const pkg = JSON.parse(fs.readFileSync(fullPkgPath, 'utf8'));
      const scripts = pkg.scripts || {};
      const productionLifecycleKeys = ['start', 'prestart', 'poststart', 'build', 'postbuild', 'prepare', 'postinstall'];

      for (const key of productionLifecycleKeys) {
        const cmd = scripts[key];
        if (cmd && isOfflineModule(cmd)) {
          violations.push({
            sourcePath: lifecycleFile,
            importedPath: cmd,
            importKind: 'npm-lifecycle',
            matchedRule: 'COMPETITIVE_PIPELINE_RUNTIME_BOUNDARY_VIOLATION',
          });
        }
      }
    } catch (_err) {
      // Ignore JSON parse errors in non-standard files
    }
  }

  return {
    valid: violations.length === 0,
    inspectedEntrypoints: input.runtimeEntrypoints,
    inspectedModuleCount: visitedModules.size,
    violations,
  };
}
