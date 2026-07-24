// Wave 3 -- formal roster reconciliation. Reads the real, live roster/species/generation catalogs
// (never assumes previously-known counts) and produces a canonical, digest-integrity-checked
// record per official roster entry, classified into eligible/provisional/blocked/ineligible.
import crypto from 'crypto';
import { ChampionsCompetitivePackage } from '../../../../equinox/data-packs/champions/ChampionsPackageTypes';

export interface GenerationCatalogEntry {
  pokemonId: string; speciesId: string; showdownId: string; nationalDexNumber: number;
  speciesGeneration: number; formGeneration: number; introducedGeneration: number;
  isBaseSpecies: boolean; isRegionalForm: boolean; isMega: boolean; isAlternativeForm: boolean;
  rosterVerified: boolean; mechanicsVerified: boolean; verificationStatus: string;
  sourceEvidence: Array<{ sourceId: string; sourceRevision: string; resultDigest: string }>;
  entryDigest: string;
}

export type RecordEligibility = 'eligible' | 'provisional' | 'blocked' | 'ineligible';

export interface CanonicalRosterRecord {
  canonicalPokemonId: string; speciesId: string; formId: string | null; aliases: string[];
  generation: number | null; eligibility: RecordEligibility;
  provisionalStatus: boolean; blockedStatus: boolean;
  reasonCodes: string[]; sourceReferences: string[]; sourceDigests: string[]; recordDigest: string;
}

export interface RosterReconciliationInput {
  pkg: ChampionsCompetitivePackage;
  eligiblePokemonIds: string[]; provisionalPokemonIds: string[]; blockedPokemonIds: string[];
  generationEntries: GenerationCatalogEntry[];
}
export interface RosterReconciliationResult {
  records: CanonicalRosterRecord[];
  totals: { official: number; eligible: number; provisional: number; blocked: number; ineligible: number; duplicate: number; aliasResolved: number; unresolvedAliases: number; processable: number };
  duplicateCanonicalIds: string[];
  unresolvedAliasRecords: string[];
}

const digest = (value: unknown): string => `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;

export function reconcileRoster(input: RosterReconciliationInput, alreadyProcessedPokemonIds: string[]): RosterReconciliationResult {
  const { pkg, eligiblePokemonIds, provisionalPokemonIds, blockedPokemonIds, generationEntries } = input;
  const generationByPokemonId = new Map(generationEntries.map(e => [e.pokemonId, e]));
  const eligibleSet = new Set(eligiblePokemonIds);
  const provisionalSet = new Set(provisionalPokemonIds);
  const blockedSet = new Set(blockedPokemonIds);

  const seenCanonicalIds = new Set<string>();
  const duplicateCanonicalIds: string[] = [];
  const unresolvedAliasRecords: string[] = [];

  const records: CanonicalRosterRecord[] = pkg.roster.map(entry => {
    const canonicalPokemonId = entry.pokemonId;
    if (seenCanonicalIds.has(canonicalPokemonId)) duplicateCanonicalIds.push(canonicalPokemonId);
    seenCanonicalIds.add(canonicalPokemonId);

    const genEntry = generationByPokemonId.get(canonicalPokemonId);
    const aliases = [genEntry?.showdownId, entry.displayName].filter((a): a is string => Boolean(a) && a !== canonicalPokemonId);
    if (!genEntry?.showdownId) unresolvedAliasRecords.push(canonicalPokemonId);

    const eligibility: RecordEligibility = eligibleSet.has(canonicalPokemonId) ? 'eligible' : provisionalSet.has(canonicalPokemonId) ? 'provisional' : blockedSet.has(canonicalPokemonId) ? 'blocked' : 'ineligible';
    const reasonCodes: string[] = [];
    if (eligibility === 'provisional') reasonCodes.push('ROSTER_RECORD_PROVISIONAL');
    if (eligibility === 'blocked') reasonCodes.push('ROSTER_RECORD_BLOCKED');
    if (eligibility === 'ineligible') reasonCodes.push('ROSTER_RECORD_INELIGIBLE_UNCLASSIFIED');
    if (!genEntry) reasonCodes.push('ROSTER_RECORD_GENERATION_ENTRY_MISSING');
    if (alreadyProcessedPokemonIds.includes(canonicalPokemonId)) reasonCodes.push('ALREADY_PROCESSED_IN_PRIOR_WAVE');

    const sourceReferences = [...entry.sourceEvidence.map(e => e.sourceId), ...(genEntry?.sourceEvidence.map(e => e.sourceId) ?? [])];
    const sourceDigests = [...entry.sourceEvidence.map(e => e.sourceDigest), ...(genEntry?.sourceEvidence.map(e => e.resultDigest) ?? [])];

    const base = { canonicalPokemonId, speciesId: entry.speciesId, formId: genEntry?.isAlternativeForm || genEntry?.isRegionalForm || genEntry?.isMega ? canonicalPokemonId : null, aliases, generation: genEntry?.speciesGeneration ?? null, eligibility, provisionalStatus: eligibility === 'provisional', blockedStatus: eligibility === 'blocked', reasonCodes, sourceReferences: [...new Set(sourceReferences)], sourceDigests: [...new Set(sourceDigests)] };
    return { ...base, recordDigest: digest(base) };
  });

  const processable = records.filter(r => r.eligibility === 'eligible' && !r.reasonCodes.includes('ALREADY_PROCESSED_IN_PRIOR_WAVE')).length;

  return {
    records,
    totals: {
      official: pkg.roster.length,
      eligible: records.filter(r => r.eligibility === 'eligible').length,
      provisional: records.filter(r => r.eligibility === 'provisional').length,
      blocked: records.filter(r => r.eligibility === 'blocked').length,
      ineligible: records.filter(r => r.eligibility === 'ineligible').length,
      duplicate: duplicateCanonicalIds.length,
      aliasResolved: records.filter(r => r.aliases.length > 0).length,
      unresolvedAliases: unresolvedAliasRecords.length,
      processable,
    },
    duplicateCanonicalIds, unresolvedAliasRecords,
  };
}
