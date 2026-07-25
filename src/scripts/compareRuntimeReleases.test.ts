import fs from 'fs';
import path from 'path';
import {
  compareRuntimeObservations,
  RuntimeReleaseComparisonCase,
  RuntimeReleaseObservation,
} from './compareRuntimeReleases';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

function runTests(): void {
  console.log('[Equinox] Iniciando testes do comparador de invariantes da release...');

  const fixturePath = path.resolve(__dirname, '../../tests/fixtures/runtime-release-comparison-cases.json');
  assert(fs.existsSync(fixturePath), 'Fixture file must exist');

  const cases: RuntimeReleaseComparisonCase[] = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  assert(cases.length === 11, 'Must load 11 test cases from fixture');

  const baseObservationTemplate = (userPokemon: readonly [string, string, string], format: string): RuntimeReleaseObservation => ({
    statusCode: 200,
    finalTeam: [...userPokemon, 'Pokemon4', 'Pokemon5', 'Pokemon6'],
    requestedFormat: format,
    resolvedFormat: format,
    syntheticFallbackActivated: false,
    legality: { speciesClause: true, itemClause: true, megaLimit: true },
    latencyMs: 40,
  });

  // Test 1: Complete valid match (0 blocking, 0 semantic divergence)
  const validBaseline = cases.map(c => baseObservationTemplate(c.userPokemon, c.format));
  const validCandidate = cases.map(c => baseObservationTemplate(c.userPokemon, c.format));

  const report1 = compareRuntimeObservations(cases, validBaseline, validCandidate);
  assert(report1.blockingDivergences === 0, 'Test 1: Valid run must have 0 blocking divergences');
  assert(report1.semanticDivergences === 0, 'Test 1: Identical teams must have 0 semantic divergences');

  // Test 2: Incomplete team (blocking divergence)
  const incompleteCandidate = cases.map(c => ({
    ...baseObservationTemplate(c.userPokemon, c.format),
    finalTeam: [c.userPokemon[0], c.userPokemon[1]], // only 2 mons
  }));
  const report2 = compareRuntimeObservations(cases, validBaseline, incompleteCandidate);
  assert(report2.invalidTeams === 11, 'Test 2: Must detect 11 invalid teams');
  assert(report2.blockingDivergences >= 11, 'Test 2: Must have at least 11 blocking divergences');

  // Test 3: Missing user pokemon (blocking divergence)
  const missingUserCandidate = cases.map(c => ({
    ...baseObservationTemplate(c.userPokemon, c.format),
    finalTeam: ['Other1', 'Other2', 'Other3', 'Other4', 'Other5', 'Other6'],
  }));
  const report3 = compareRuntimeObservations(cases, validBaseline, missingUserCandidate);
  assert(report3.missingUserPokemon === 11, 'Test 3: Must detect missing user pokemon');
  assert(report3.blockingDivergences === 11, 'Test 3: Must block on missing user pokemon');

  // Test 4: Format mismatch (blocking divergence)
  const formatMismatchCandidate = cases.map(c => ({
    ...baseObservationTemplate(c.userPokemon, c.format),
    resolvedFormat: 'invalid_format_override',
  }));
  const report4 = compareRuntimeObservations(cases, validBaseline, formatMismatchCandidate);
  assert(report4.formatMismatches === 11, 'Test 4: Must detect format mismatches');
  assert(report4.blockingDivergences === 11, 'Test 4: Must block on format mismatch');

  // Test 5: Legality failure (blocking divergence)
  const illegalCandidate = cases.map(c => ({
    ...baseObservationTemplate(c.userPokemon, c.format),
    legality: { speciesClause: false, itemClause: true, megaLimit: true },
  }));
  const report5 = compareRuntimeObservations(cases, validBaseline, illegalCandidate);
  assert(report5.legalityFailures === 11, 'Test 5: Must detect legality failures');
  assert(report5.blockingDivergences === 11, 'Test 5: Must block on legality failure');

  // Test 6: Synthetic fallback activation (blocking divergence)
  const fallbackCandidate = cases.map(c => ({
    ...baseObservationTemplate(c.userPokemon, c.format),
    syntheticFallbackActivated: true,
  }));
  const report6 = compareRuntimeObservations(cases, validBaseline, fallbackCandidate);
  assert(report6.syntheticFallbackActivations === 11, 'Test 6: Must detect synthetic fallback activation');
  assert(report6.blockingDivergences === 11, 'Test 6: Must block on synthetic fallback');

  // Test 7: HTTP 5xx error (blocking divergence)
  const httpErrorCandidate = cases.map(c => ({
    ...baseObservationTemplate(c.userPokemon, c.format),
    statusCode: 500,
  }));
  const report7 = compareRuntimeObservations(cases, validBaseline, httpErrorCandidate);
  assert(report7.transportFailures === 11, 'Test 7: Must detect HTTP 5xx transport failures');
  assert(report7.blockingDivergences === 11, 'Test 7: Must block on HTTP 5xx');

  // Test 8: Acceptable semantic divergence (different valid team -> non-blocking divergence)
  const semanticDiffCandidate = cases.map(c => ({
    ...baseObservationTemplate(c.userPokemon, c.format),
    finalTeam: [...c.userPokemon, 'AltMon4', 'AltMon5', 'AltMon6'],
  }));
  const report8 = compareRuntimeObservations(cases, validBaseline, semanticDiffCandidate);
  assert(report8.blockingDivergences === 0, 'Test 8: Valid alternative team must NOT block');
  assert(report8.semanticDivergences === 11, 'Test 8: Must report 11 semantic divergences');

  console.log('[Equinox] Todos os testes do comparador de invariantes passaram com sucesso.');
}

runTests();
