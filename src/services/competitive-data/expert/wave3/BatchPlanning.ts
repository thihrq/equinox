// Wave 3 -- deterministic batch planning. Splits the real, remaining eligible roster (eligible
// minus Wave 1 sentinel minus Wave 2 pilot) into fixed-size, ordered batches with stable IDs and
// real input digests, plus a small canary selection covering the mission's required tag classes.
import crypto from 'crypto';
import { ChampionsCompetitivePackage } from '../../../../equinox/data-packs/champions/ChampionsPackageTypes';
import { buildSpeciesMoveContext, classifyStrata, maxCalculatedSpeed } from '../wave2/PokemonProfileClassifier';
import { BatchStatus } from './FullRosterExpansionPolicy';

const digest = (value: unknown): string => `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;

export interface BatchPlanEntry {
  batchId: string; index: number; pokemonIds: string[]; expectedCandidateCountMax: number;
  inputDigest: string; policyDigest: string; status: BatchStatus; attemptCount: number;
}
export interface PlanBatchesInput { remainingPokemonIds: string[]; speciesPerBatch: number; policyVersion: string; seedBase: string; }

export function planBatches(input: PlanBatchesInput): BatchPlanEntry[] {
  const { remainingPokemonIds, speciesPerBatch, policyVersion, seedBase } = input;
  const sorted = [...remainingPokemonIds].sort(); // deterministic order, not insertion-order-dependent
  const batches: BatchPlanEntry[] = [];
  for (let i = 0; i < sorted.length; i += speciesPerBatch) {
    const pokemonIds = sorted.slice(i, i + speciesPerBatch);
    const index = batches.length;
    const inputDigest = digest({ seedBase, policyVersion, index, pokemonIds });
    batches.push({
      batchId: `wave3-batch-${String(index).padStart(3, '0')}`, index, pokemonIds,
      expectedCandidateCountMax: pokemonIds.length * 2,
      inputDigest, policyDigest: digest({ policyVersion }), status: 'planned', attemptCount: 0,
    });
  }
  return batches;
}

const CANARY_TAG_TARGETS = ['fast', 'slow', 'physical-attacker', 'special-attacker', 'support', 'weather', 'trick-room', 'alternate-form'] as const;

export function selectCanaryBatch(pkg: ChampionsCompetitivePackage, remainingPokemonIds: string[], speedPercentiles: { p25: number; p75: number }, targetCount: number): { pokemonIds: string[]; representedTags: string[] } {
  const speciesById = new Map(pkg.species.map(s => [s.pokemonId, s]));
  const tagged = remainingPokemonIds
    .filter(id => speciesById.has(id))
    .map(id => {
      const species = speciesById.get(id)!;
      const ctx = buildSpeciesMoveContext(species, pkg);
      const strata = classifyStrata(species, ctx, speedPercentiles);
      const tags: string[] = [];
      if (strata.fastSpeed) tags.push('fast');
      if (strata.slowSpeed || strata.verySlowSpeed) tags.push('slow');
      if (strata.physicalAttacker) tags.push('physical-attacker');
      if (strata.specialAttacker) tags.push('special-attacker');
      if (strata.redirectionCapable || strata.fakeOutCapable || strata.tailwindCapable) tags.push('support');
      if (strata.weatherSetter) tags.push('weather');
      if (strata.trickRoomCapable) tags.push('trick-room');
      if (id.includes('-') && id.split('-')[1] !== '000') tags.push('alternate-form');
      return { id, tags };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const selected: string[] = [];
  const represented = new Set<string>();
  while (selected.length < targetCount && selected.length < tagged.length) {
    const next = tagged.filter(item => !selected.includes(item.id)).sort((a, b) => {
      const aGain = a.tags.filter(t => CANARY_TAG_TARGETS.includes(t as typeof CANARY_TAG_TARGETS[number]) && !represented.has(t)).length;
      const bGain = b.tags.filter(t => CANARY_TAG_TARGETS.includes(t as typeof CANARY_TAG_TARGETS[number]) && !represented.has(t)).length;
      return bGain - aGain || a.id.localeCompare(b.id);
    })[0];
    if (!next) break;
    selected.push(next.id);
    next.tags.forEach(t => represented.add(t));
  }
  return { pokemonIds: selected, representedTags: [...represented].sort() };
}

export function projectFullRerunDuration(measuredMsPerCandidate: number, totalSpeciesRemaining: number, maxCandidatesPerPokemon: number): { estimatedCandidates: number; estimatedTotalMs: number; estimatedTotalSeconds: number } {
  const estimatedCandidates = totalSpeciesRemaining * maxCandidatesPerPokemon;
  const estimatedTotalMs = estimatedCandidates * measuredMsPerCandidate;
  return { estimatedCandidates, estimatedTotalMs, estimatedTotalSeconds: Math.ceil(estimatedTotalMs / 1000) };
}
