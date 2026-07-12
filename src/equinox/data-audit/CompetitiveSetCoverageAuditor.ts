export interface CompetitiveRosterEntry {
  pokemonId: string;
  forms: string[];
}

export interface CompetitiveCoverageSet {
  pokemonId: string;
  formId: string;
  regulationId: string;
  battleStyle: 'singles' | 'doubles';
  legal: boolean;
  status: string;
  confidence: number;
  coherenceScore: number;
  primaryRole?: string;
}

export interface CompetitiveSetCoverageReport {
  eligiblePokemon: number;
  coveredPokemon: number;
  coveragePercent: number;
  missingPokemon: string[];
  onlyFallbackPokemon: string[];
  lowConfidencePokemon: string[];
  singleSetPokemon: string[];
}

export function auditCompetitiveSetCoverage(input: {
  eligibleRoster: CompetitiveRosterEntry[];
  sets: CompetitiveCoverageSet[];
  regulationId: string;
  battleStyle: 'singles' | 'doubles';
}): CompetitiveSetCoverageReport {
  const missingPokemon: string[] = [];
  const onlyFallbackPokemon: string[] = [];
  const lowConfidencePokemon: string[] = [];
  const singleSetPokemon: string[] = [];
  let coveredPokemon = 0;

  for (const rosterEntry of input.eligibleRoster) {
    const matching = input.sets.filter(set =>
      set.pokemonId === rosterEntry.pokemonId &&
      rosterEntry.forms.includes(set.formId) &&
      set.regulationId === input.regulationId &&
      set.battleStyle === input.battleStyle &&
      set.legal &&
      set.status === 'active',
    );

    if (!matching.length) {
      missingPokemon.push(rosterEntry.pokemonId);
      continue;
    }

    coveredPokemon += 1;
    if (matching.every(set => set.confidence < 55)) onlyFallbackPokemon.push(rosterEntry.pokemonId);
    if (Math.max(...matching.map(set => set.confidence)) < 70) lowConfidencePokemon.push(rosterEntry.pokemonId);
    if (new Set(matching.map(set => set.primaryRole ?? 'unknown')).size <= 1) singleSetPokemon.push(rosterEntry.pokemonId);
  }

  const eligiblePokemon = input.eligibleRoster.length;
  return {
    eligiblePokemon,
    coveredPokemon,
    coveragePercent: eligiblePokemon ? Math.round((coveredPokemon / eligiblePokemon) * 100) : 0,
    missingPokemon,
    onlyFallbackPokemon,
    lowConfidencePokemon,
    singleSetPokemon,
  };
}
