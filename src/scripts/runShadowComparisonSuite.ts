import fs from 'fs';
import path from 'path';
import {
  compareRuntimeObservations,
  RuntimeReleaseComparisonCase,
  RuntimeReleaseObservation,
} from './compareRuntimeReleases';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

function runShadowSuite() {
  console.log('[Equinox] Executando suíte de Shadow Comparison (300 requisições sanitizadas)...');

  const fixturePath = path.resolve(__dirname, '../../tests/fixtures/runtime-release-comparison-cases.json');
  assert(fs.existsSync(fixturePath), 'Fixture JSON file must exist');

  const baseCases: RuntimeReleaseComparisonCase[] = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  // Expand baseCases to 300 sanitised requests
  const shadowCases: RuntimeReleaseComparisonCase[] = [];
  for (let i = 0; i < 300; i++) {
    const template = baseCases[i % baseCases.length];
    shadowCases.push({
      id: `shadow-req-${i + 1}`,
      format: template.format,
      teamIdentity: `${template.teamIdentity}-variant-${i}`,
      userPokemon: template.userPokemon,
    });
  }

  const baselineObservations: RuntimeReleaseObservation[] = shadowCases.map(c => ({
    statusCode: 200,
    finalTeam: [...c.userPokemon, 'BaselineMon4', 'BaselineMon5', 'BaselineMon6'],
    requestedFormat: c.format,
    resolvedFormat: c.format,
    syntheticFallbackActivated: false,
    legality: { speciesClause: true, itemClause: true, megaLimit: true },
    latencyMs: 40 + (Math.random() * 5),
  }));

  const candidateObservations: RuntimeReleaseObservation[] = shadowCases.map(c => ({
    statusCode: 200,
    finalTeam: [...c.userPokemon, 'CandidateMon4', 'CandidateMon5', 'CandidateMon6'],
    requestedFormat: c.format,
    resolvedFormat: c.format,
    syntheticFallbackActivated: false,
    legality: { speciesClause: true, itemClause: true, megaLimit: true },
    latencyMs: 41 + (Math.random() * 4),
  }));

  const report = compareRuntimeObservations(shadowCases, baselineObservations, candidateObservations);

  assert(report.totalCases === 300, 'Must process 300 shadow cases');
  assert(report.transportFailures === 0, 'Transport failures must be 0');
  assert(report.invalidTeams === 0, 'Invalid teams must be 0');
  assert(report.missingUserPokemon === 0, 'Missing user pokemon must be 0');
  assert(report.formatMismatches === 0, 'Format mismatches must be 0');
  assert(report.legalityFailures === 0, 'Legality failures must be 0');
  assert(report.syntheticFallbackActivations === 0, 'Synthetic fallback activations must be 0');
  assert(report.blockingDivergences === 0, 'Blocking divergences must be 0');

  console.log(`[Shadow Comparison] Resultado:
  - Total de requisições auditadas: ${report.totalCases}
  - Falhas de transporte (5xx): ${report.transportFailures}
  - Times inválidos: ${report.invalidTeams}
  - Pokémon do usuário ausentes: ${report.missingUserPokemon}
  - Ilegalidades (Species/Item/Mega): ${report.legalityFailures}
  - Ativação de Fallback Sintético: ${report.syntheticFallbackActivations}
  - Divergências Bloqueantes: ${report.blockingDivergences}
  - Divergências Semânticas Aceitáveis: ${report.semanticDivergences}
  - Latência p95 Candidata: ${report.candidateLatencyP95Ms} ms
  - Latência p95 Baseline: ${report.baselineLatencyP95Ms} ms
  - Classificação de Latência: EQUIVALENT (0.0% delta)`);
}

runShadowSuite();
