import fs from 'fs';
import path from 'path';
import { inspectCompetitivePipelineRuntimeBoundary } from './competitivePipelineRuntimeBoundary';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

function runTests(): void {
  const repositoryRoot = path.resolve(__dirname, '../../');
  const tempFixtureDir = path.join(repositoryRoot, 'src/config/__fixtures_boundary_test__');

  if (!fs.existsSync(tempFixtureDir)) {
    fs.mkdirSync(tempFixtureDir, { recursive: true });
  }

  try {
    // Test 1: current production graph isolation
    const res1 = inspectCompetitivePipelineRuntimeBoundary({
      repositoryRoot,
      runtimeEntrypoints: ['src/server.ts', 'src/apiRoutes.ts', 'src/controllers/TeamController.ts'],
      lifecycleFiles: ['package.json', 'frontend/package.json'],
    });
    assert(res1.valid === true, 'Test 1: Current production graph must be valid without violations');
    assert(res1.violations.length === 0, 'Test 1: Violations array must be empty');
    assert(res1.inspectedModuleCount > 0, 'Test 1: Must inspect >0 modules');

    // Test 2: direct static import violation
    const fixture2 = path.join(tempFixtureDir, 'directImportFixture.ts');
    fs.writeFileSync(fixture2, "import '../../scripts/runChampionsWave1QA';", 'utf8');
    const res2 = inspectCompetitivePipelineRuntimeBoundary({
      repositoryRoot,
      runtimeEntrypoints: ['src/config/__fixtures_boundary_test__/directImportFixture.ts'],
      lifecycleFiles: [],
    });
    assert(res2.valid === false, 'Test 2: Direct static import must fail boundary check');
    assert(res2.violations.length > 0, 'Test 2: Must report violation');
    assert(res2.violations[0].importKind === 'static-import', 'Test 2: Must be static-import kind');

    // Test 3: transitive import violation
    const intermediatePath = path.join(tempFixtureDir, 'intermediateService.ts');
    const entryPath = path.join(tempFixtureDir, 'transitiveEntry.ts');
    fs.writeFileSync(intermediatePath, "import '../../scripts/runChampionsWave2QA';", 'utf8');
    fs.writeFileSync(entryPath, "import './intermediateService';", 'utf8');
    const res3 = inspectCompetitivePipelineRuntimeBoundary({
      repositoryRoot,
      runtimeEntrypoints: ['src/config/__fixtures_boundary_test__/transitiveEntry.ts'],
      lifecycleFiles: [],
    });
    assert(res3.valid === false, 'Test 3: Transitive import must fail boundary check');
    assert(res3.violations.length > 0, 'Test 3: Must report transitive violation');

    // Test 4: require violation
    const fixture4 = path.join(tempFixtureDir, 'requireFixture.ts');
    fs.writeFileSync(fixture4, "const qa = require('../../scripts/runChampionsWave3QA');", 'utf8');
    const res4 = inspectCompetitivePipelineRuntimeBoundary({
      repositoryRoot,
      runtimeEntrypoints: ['src/config/__fixtures_boundary_test__/requireFixture.ts'],
      lifecycleFiles: [],
    });
    assert(res4.valid === false, 'Test 4: Require import must fail boundary check');
    assert(res4.violations[0].importKind === 'require', 'Test 4: Must be require kind');

    // Test 5: dynamic import violation
    const fixture5 = path.join(tempFixtureDir, 'dynamicImportFixture.ts');
    fs.writeFileSync(fixture5, "async function load() { await import('../../scripts/runChampionsWave1QA'); }", 'utf8');
    const res5 = inspectCompetitivePipelineRuntimeBoundary({
      repositoryRoot,
      runtimeEntrypoints: ['src/config/__fixtures_boundary_test__/dynamicImportFixture.ts'],
      lifecycleFiles: [],
    });
    assert(res5.valid === false, 'Test 5: Dynamic import must fail boundary check');
    assert(res5.violations[0].importKind === 'dynamic-import', 'Test 5: Must be dynamic-import kind');

    // Test 6: npm lifecycle script violation
    const fakePkgPath = path.join(tempFixtureDir, 'fake-package.json');
    fs.writeFileSync(
      fakePkgPath,
      JSON.stringify({
        scripts: {
          start: 'node dist/server.js',
          postbuild: 'ts-node src/scripts/runChampionsWave1QA.ts',
        },
      }),
      'utf8',
    );
    const res6 = inspectCompetitivePipelineRuntimeBoundary({
      repositoryRoot,
      runtimeEntrypoints: [],
      lifecycleFiles: ['src/config/__fixtures_boundary_test__/fake-package.json'],
    });
    assert(res6.valid === false, 'Test 6: Lifecycle script must fail boundary check');
    assert(res6.violations[0].importKind === 'npm-lifecycle', 'Test 6: Must be npm-lifecycle kind');

    // Test 7: CLI offline script available
    const cliPath = path.join(repositoryRoot, 'src/scripts/runChampionsWave1QA.ts');
    assert(fs.existsSync(cliPath), 'Test 7: Offline CLI script must still exist on disk');

    // Test 8: No false positive on legitimate module with similar prefix
    const fixture8a = path.join(tempFixtureDir, 'legitimateModule.ts');
    const fixture8b = path.join(tempFixtureDir, 'safeEntry.ts');
    fs.writeFileSync(fixture8a, "export const safeValue = 'benchmark_helper_safe';", 'utf8');
    fs.writeFileSync(fixture8b, "import { safeValue } from './legitimateModule';", 'utf8');
    const res8 = inspectCompetitivePipelineRuntimeBoundary({
      repositoryRoot,
      runtimeEntrypoints: ['src/config/__fixtures_boundary_test__/safeEntry.ts'],
      lifecycleFiles: [],
    });
    assert(res8.valid === true, 'Test 8: Legitimate module must pass without false positive');

    // Test 9: Windows and POSIX path separator handling
    const resWin = inspectCompetitivePipelineRuntimeBoundary({
      repositoryRoot,
      runtimeEntrypoints: ['src\\server.ts'],
      lifecycleFiles: [],
    });
    assert(resWin.valid === true, 'Test 9: Windows backslashes must resolve cleanly');
    assert(resWin.inspectedModuleCount === res1.inspectedModuleCount, 'Test 9: Inspected count must match POSIX path count');

    console.log('[Equinox] competitivePipelineRuntimeBoundary.test.ts passed all 9 test cases.');
  } finally {
    if (fs.existsSync(tempFixtureDir)) {
      fs.rmSync(tempFixtureDir, { recursive: true, force: true });
    }
  }
}

runTests();
