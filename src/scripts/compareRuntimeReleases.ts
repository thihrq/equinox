export interface RuntimeReleaseComparisonCase {
  id: string;
  format: string;
  teamIdentity: string;
  userPokemon: readonly [string, string, string];
}

export interface RuntimeReleaseObservation {
  statusCode: number;
  finalTeam: readonly string[];
  requestedFormat: string;
  resolvedFormat: string;
  syntheticFallbackActivated: boolean;
  legality: {
    speciesClause: boolean;
    itemClause: boolean;
    megaLimit: boolean;
  };
  latencyMs: number;
}

export interface RuntimeReleaseComparisonReport {
  totalCases: number;
  transportFailures: number;
  invalidTeams: number;
  missingUserPokemon: number;
  formatMismatches: number;
  legalityFailures: number;
  syntheticFallbackActivations: number;
  candidateLatencyP95Ms: number;
  baselineLatencyP95Ms: number;
  semanticDivergences: number;
  blockingDivergences: number;
}

function calculateP95(latencies: number[]): number {
  if (latencies.length === 0) return 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  const index = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

export function compareRuntimeObservations(
  cases: readonly RuntimeReleaseComparisonCase[],
  baselineObs: readonly RuntimeReleaseObservation[],
  candidateObs: readonly RuntimeReleaseObservation[],
): RuntimeReleaseComparisonReport {
  let transportFailures = 0;
  let invalidTeams = 0;
  let missingUserPokemon = 0;
  let formatMismatches = 0;
  let legalityFailures = 0;
  let syntheticFallbackActivations = 0;
  let semanticDivergences = 0;

  const baselineLatencies: number[] = [];
  const candidateLatencies: number[] = [];

  for (let i = 0; i < cases.length; i++) {
    const testCase = cases[i];
    const base = baselineObs[i];
    const cand = candidateObs[i];

    if (base) baselineLatencies.push(base.latencyMs);
    if (cand) candidateLatencies.push(cand.latencyMs);

    // 1. Transport failures (HTTP 5xx)
    if ((cand && cand.statusCode >= 500) || (base && base.statusCode >= 500)) {
      transportFailures++;
    }

    if (!cand) continue;

    // 2. Team size invariant (team size == 6)
    if (cand.finalTeam.length !== 6) {
      invalidTeams++;
    }

    // 3. User Pokemon preserved invariant (3 user pokemon preserved in team)
    const userPokemonMatches = testCase.userPokemon.filter(p => cand.finalTeam.includes(p));
    if (userPokemonMatches.length !== 3) {
      missingUserPokemon++;
    }

    // 4. Format match invariant
    if (cand.resolvedFormat !== testCase.format || cand.requestedFormat !== testCase.format) {
      formatMismatches++;
    }

    // 5. Legality invariants (Species Clause, Item Clause, Mega Limit)
    if (!cand.legality.speciesClause || !cand.legality.itemClause || !cand.legality.megaLimit) {
      legalityFailures++;
    }

    // 6. Synthetic fallback activation invariant
    if (cand.syntheticFallbackActivated) {
      syntheticFallbackActivations++;
    }

    // 7. Acceptable semantic divergence (valid 6-pokemon team differing from baseline)
    if (base && cand.finalTeam.length === 6 && base.finalTeam.length === 6) {
      const teamsEqual = cand.finalTeam.every((mon, idx) => mon === base.finalTeam[idx]);
      if (!teamsEqual) {
        semanticDivergences++;
      }
    }
  }

  const blockingDivergences =
    transportFailures +
    invalidTeams +
    missingUserPokemon +
    formatMismatches +
    legalityFailures +
    syntheticFallbackActivations;

  return {
    totalCases: cases.length,
    transportFailures,
    invalidTeams,
    missingUserPokemon,
    formatMismatches,
    legalityFailures,
    syntheticFallbackActivations,
    candidateLatencyP95Ms: calculateP95(candidateLatencies),
    baselineLatencyP95Ms: calculateP95(baselineLatencies),
    semanticDivergences,
    blockingDivergences,
  };
}
