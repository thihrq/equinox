import {
  ChampionsCompetitivePackage,
  ChampionsPackageValidationResult,
  ChampionsValidationFinding,
  FieldEvidence,
} from '../../data-packs/champions/ChampionsPackageTypes';
import { normalizeChampionsId } from '../../data-normalization/champions/ChampionsAliasNormalizer';

const GENERATION_STATUSES = new Set(['official-verified', 'primary-source-verified', 'in-game-verified', 'cross-source-verified']);

function finding(scope: string, code: string, message: string, blocking: boolean): ChampionsValidationFinding {
  return { scope, code, message, blocking };
}

function hasEvidence(evidence: FieldEvidence[]): boolean {
  return evidence.length > 0 && evidence.every(item => Boolean(item.sourceId && item.sourceDigest && item.retrievedAt));
}

export function validateChampionsCompetitivePackage(
  data: ChampionsCompetitivePackage,
): ChampionsPackageValidationResult {
  const findings: ChampionsValidationFinding[] = [];
  const rosterRecordsRead = data.roster.length;
  const moveRecordsRead = data.moves.length;
  const abilityRecordsRead = data.abilities.length;
  const itemRecordsRead = data.items.length;
  const learnsetRecordsRead = data.learnsets.length;
  const allSnapshotCountsAreZero = [rosterRecordsRead, moveRecordsRead, abilityRecordsRead, itemRecordsRead, learnsetRecordsRead].every(count => count === 0);
  const rosterIds = data.roster.map(entry => normalizeChampionsId(entry.pokemonId));
  const rosterIdSet = new Set(rosterIds);
  const speciesIds = new Set(data.species.map(item => normalizeChampionsId(item.pokemonId)));
  const moveIds = new Set(data.moves.map(item => normalizeChampionsId(item.moveId)));
  const abilityIds = new Set(data.abilities.map(item => normalizeChampionsId(item.abilityId)));
  const itemIds = new Set(data.items.map(item => normalizeChampionsId(item.itemId)));
  const learnsets = new Map(data.learnsets.map(item => [normalizeChampionsId(item.pokemonId), item]));

  if (data.regulation.formatId !== 'champions_reg_m_b_doubles' || data.regulation.regulationId !== 'M-B') {
    findings.push(finding('regulation', 'REGULATION_MISMATCH', 'regulation must describe champions_reg_m_b_doubles M-B', true));
  }
  if (data.regulation.itemClause !== true || data.regulation.maxMegaEvolutionsPerBattle !== 1) {
    findings.push(finding('regulation', 'GLOBAL_RULES_INCOMPLETE', 'M-B item and Mega rules are incomplete', true));
  }
  if (!allSnapshotCountsAreZero && (!data.sourceManifest.packageDigest || data.sourceManifest.packageDigest.startsWith('pending-'))) {
    findings.push(finding('sources', 'PACKAGE_DIGEST_MISSING', 'package digest is not finalized', true));
  }
  if (!allSnapshotCountsAreZero && data.sourceManifest.sources.length === 0) {
    findings.push(finding('sources', 'SOURCES_EMPTY', 'at least one source is required', true));
  }
  if (data.roster.length === 0) findings.push(finding('roster', 'ROSTER_EMPTY', 'roster is empty', false));
  if (data.moves.length === 0) findings.push(finding('moves', 'MOVES_EMPTY', 'moves catalog is empty', true));
  if (data.abilities.length === 0) findings.push(finding('abilities', 'ABILITIES_EMPTY', 'abilities catalog is empty', true));
  if (data.items.length === 0) findings.push(finding('items', 'ITEMS_EMPTY', 'items catalog is empty', true));

  rosterIds.forEach((id, index) => {
    if (rosterIds.indexOf(id) !== index) findings.push(finding(`roster.${id}`, 'DUPLICATE_ROSTER_ID', 'duplicate normalized roster id', true));
    const entry = data.roster[index];
    if (!entry.speciesId) findings.push(finding(`roster.${id}`, 'SPECIES_ID_MISSING', 'speciesId is required', true));
    if (entry.regulationId !== 'M-B') findings.push(finding(`roster.${id}`, 'REGULATION_ID_MISMATCH', 'roster regulationId must be M-B', true));
    if (entry.legal && !hasEvidence(entry.sourceEvidence)) findings.push(finding(`roster.${id}`, 'ROSTER_EVIDENCE_MISSING', 'legal roster entry has no complete evidence', true));
  });

  const eligiblePokemonIds: string[] = [];
  const provisionalPokemonIds: string[] = [];
  const blockedPokemonIds: string[] = [];

  for (const entry of data.roster) {
    const id = normalizeChampionsId(entry.pokemonId);
    const learnset = learnsets.get(id);
    const mechanicalStatus = GENERATION_STATUSES.has(entry.verificationStatus) && Boolean(learnset && GENERATION_STATUSES.has(learnset.verificationStatus));
    const missingReferences = learnset
      ? [...learnset.legalMoveIds.filter(move => !moveIds.has(normalizeChampionsId(move))), ...learnset.legalAbilityIds.filter(ability => !abilityIds.has(normalizeChampionsId(ability))), ...(learnset.legalItemIds ?? []).filter(item => !itemIds.has(normalizeChampionsId(item)))]
      : ['learnset'];
    const hasMechanicalData = speciesIds.has(normalizeChampionsId(entry.speciesId)) && mechanicalStatus && missingReferences.length === 0;

    if (!entry.legal || !hasMechanicalData) {
      const provisional = entry.verificationStatus === 'provisional' || entry.verificationStatus === 'unknown' || !learnset;
      (provisional ? provisionalPokemonIds : blockedPokemonIds).push(id);
      if (missingReferences.length > 0) findings.push(finding(`roster.${id}`, 'MECHANICS_REFERENCE_MISSING', `missing mechanics references: ${missingReferences.join(', ')}`, !provisional));
      continue;
    }

    eligiblePokemonIds.push(id);
  }

  if (allSnapshotCountsAreZero) {
    findings.length = 0;
    findings.push(
      finding('roster', 'ROSTER_SNAPSHOT_MISSING', 'roster snapshot is missing', true),
      finding('moves', 'MOVE_CATALOG_MISSING', 'move catalog is missing', true),
      finding('abilities', 'ABILITY_CATALOG_MISSING', 'ability catalog is missing', true),
      finding('items', 'ITEM_CATALOG_MISSING', 'item catalog is missing', true),
      finding('learnsets', 'LEARNSET_SNAPSHOT_MISSING', 'learnset snapshot is missing', true),
    );
  }

  const blockers = findings.filter(item => item.blocking);
  const snapshotCompletenessCodes = new Set([
    'ROSTER_SNAPSHOT_MISSING',
    'MOVE_CATALOG_MISSING',
    'ABILITY_CATALOG_MISSING',
    'ITEM_CATALOG_MISSING',
    'LEARNSET_SNAPSHOT_MISSING',
    'ROSTER_EMPTY',
    'MOVES_EMPTY',
    'ABILITIES_EMPTY',
    'ITEMS_EMPTY',
  ]);
  const hardBlockers = blockers.filter(item => !snapshotCompletenessCodes.has(item.code));
  const hasCompleteSnapshots = [rosterRecordsRead, moveRecordsRead, abilityRecordsRead, itemRecordsRead, learnsetRecordsRead]
    .every(count => count > 0);
  const fullyVerified = hasCompleteSnapshots
    && provisionalPokemonIds.length === 0
    && blockedPokemonIds.length === 0
    && data.sourceManifest.status !== 'blocked';
  const packageState = allSnapshotCountsAreZero
    ? 'empty' as const
    : hardBlockers.length > 0
      ? 'invalid' as const
      : fullyVerified
        ? 'ready' as const
        : eligiblePokemonIds.length > 0
        ? 'partial' as const
        : 'partial' as const;
  const packageValid = packageState === 'ready' || (packageState === 'partial' && hardBlockers.length === 0);
  const generationEligible = packageValid && eligiblePokemonIds.length > 0;

  return {
    packageState,
    rosterRecordsRead,
    moveRecordsRead,
    abilityRecordsRead,
    itemRecordsRead,
    learnsetRecordsRead,
    packageValid,
    generationEligible,
    status: blockers.length > 0 ? 'blocked' : generationEligible ? 'ready' : 'pending',
    errors: blockers.map(item => item.message),
    warnings: findings.filter(item => !item.blocking).map(item => item.message),
    eligiblePokemonIds: [...new Set(eligiblePokemonIds)],
    provisionalPokemonIds: [...new Set(provisionalPokemonIds)],
    blockedPokemonIds: [...new Set(blockedPokemonIds)],
    blockers,
    findings,
  };
}
