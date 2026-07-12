import { normalizeMoveId } from '../data-normalization/CompetitiveDataNormalizer';
import { CompetitiveSetValidationInput, StatSpread } from '../data-validation/CompetitiveValidationTypes';

export interface SetSelectionComparison {
  pokemonId: string;
  role: string;
  legacySetId?: string;
  v2SetId?: string;
  legacyScore: ShadowComparisonScore;
  v2Score: ShadowComparisonScore;
  legacyCoherence: number;
  v2Coherence: number;
  differences: {
    item: boolean;
    ability: boolean;
    nature: boolean;
    evs: boolean;
    ivs: boolean;
    moves: boolean;
  };
  preferred: 'legacy' | 'v2' | 'manual-review';
  reasons: string[];
}

export interface ShadowComparisonScore {
  metadataQuality: number;
  legality: number;
  coherence: number;
  roleFit: number;
  competitiveFit: number;
}

export function compareLegacyAndV2Sets(input: {
  legacySets: CompetitiveSetValidationInput[];
  v2Sets: CompetitiveSetValidationInput[];
}): SetSelectionComparison[] {
  return input.v2Sets.map(v2 => {
    const legacy = input.legacySets.find(candidate =>
      candidate.pokemonName === v2.pokemonName || candidate.pokemonId === v2.pokemonId,
    );
    const role = v2.primaryRole ?? legacy?.primaryRole ?? (legacy as { role?: string } | undefined)?.role ?? 'unknown';
    const legacyScore = scoreSetForShadow(legacy, role, 'legacy');
    const v2Score = scoreSetForShadow(v2, role, 'v2');
    const legacyCoherence = legacyScore.coherence;
    const v2Coherence = v2Score.coherence;
    const preferred = choosePreferred(legacyScore, v2Score, Boolean(legacy));
    return {
      pokemonId: v2.pokemonId ?? v2.pokemonName ?? 'unknown',
      role,
      legacySetId: legacy?.setId,
      v2SetId: v2.setId,
      legacyScore,
      v2Score,
      legacyCoherence,
      v2Coherence,
      differences: {
        item: Boolean(legacy && legacy.item !== v2.item),
        ability: Boolean(legacy && legacy.ability !== v2.ability),
        nature: Boolean(legacy && legacy.nature !== v2.nature),
        evs: Boolean(legacy && !sameSpread(legacy.evs, v2.evs)),
        ivs: Boolean(legacy && !sameSpread(legacy.ivs, v2.ivs)),
        moves: Boolean(legacy && !sameMoves(legacy.moves, v2.moves)),
      },
      preferred,
      reasons: explainPreference(preferred, legacyScore, v2Score, Boolean(legacy)),
    };
  });
}

function scoreSetForShadow(
  set: CompetitiveSetValidationInput | undefined,
  requiredRole: string,
  source: 'legacy' | 'v2',
): ShadowComparisonScore {
  if (!set) {
    return { metadataQuality: 0, legality: 0, coherence: 0, roleFit: 0, competitiveFit: 0 };
  }

  const hasMetadata = [
    set.regulationId,
    set.battleStyle,
    set.sourceId,
    set.sourceUpdatedAt,
    set.confidence,
    set.status,
    set.dataVersion,
  ].filter(value => value !== undefined && value !== '').length;
  const metadataQuality = Math.min(100, Math.round((hasMetadata / 7) * 100));
  const legality = set.legal === false || set.status === 'quarantined' ? 0 : 100;
  const coherence = Number(set.coherenceScore ?? (source === 'v2' ? 80 : 50));
  const roleFit = set.primaryRole === requiredRole || set.secondaryRoles?.includes(requiredRole) ? 100 : 40;
  const spreadFit = scoreSpreadFit(set, requiredRole);
  const moveFit = scoreMoveFit(set, requiredRole);
  const competitiveFit = Math.round(coherence * 0.4 + roleFit * 0.25 + spreadFit * 0.2 + moveFit * 0.15);

  return { metadataQuality, legality, coherence, roleFit, competitiveFit };
}

function choosePreferred(
  legacy: ShadowComparisonScore,
  v2: ShadowComparisonScore,
  hasLegacy: boolean,
): SetSelectionComparison['preferred'] {
  if (!hasLegacy) return 'v2';
  if (v2.legality < 100 || legacy.legality < 100) return 'manual-review';
  const v2GovernanceLead = v2.metadataQuality - legacy.metadataQuality;
  const v2CompetitiveLead = v2.competitiveFit - legacy.competitiveFit;
  if (v2CompetitiveLead >= 8 && v2.coherence >= 70 && v2.roleFit >= 80) return 'v2';
  if (v2GovernanceLead >= 40 && v2CompetitiveLead < 8) return 'manual-review';
  if (legacy.competitiveFit - v2.competitiveFit >= 8) return 'legacy';
  return 'manual-review';
}

function explainPreference(
  preferred: SetSelectionComparison['preferred'],
  legacy: ShadowComparisonScore,
  v2: ShadowComparisonScore,
  hasLegacy: boolean,
): string[] {
  if (!hasLegacy) {
    return ['V2 preferred because no comparable legacy set was found.'];
  }
  if (preferred === 'v2') {
    return [
      'V2 preferred because regulation metadata is exact.',
      'V2 preferred because role fit and competitive fit are stronger than the legacy set.',
      'V2 legality and coherence passed the shadow gate.',
    ];
  }
  if (preferred === 'legacy') {
    return [
      'Legacy preferred because its competitive fit is stronger than V2.',
      'V2 metadata alone is not enough to override a stronger competitive set.',
    ];
  }
  return [
    'Manual review required because governance metadata and competitive quality do not produce a clear winner.',
    `Legacy competitiveFit=${legacy.competitiveFit}; V2 competitiveFit=${v2.competitiveFit}.`,
    `Legacy metadataQuality=${legacy.metadataQuality}; V2 metadataQuality=${v2.metadataQuality}.`,
  ];
}

function scoreSpreadFit(set: CompetitiveSetValidationInput, role: string): number {
  const evs = set.evs ?? {};
  const hp = Number(evs.hp ?? 0);
  const atk = Number(evs.atk ?? 0);
  const def = Number(evs.def ?? 0);
  const spa = Number(evs.spa ?? 0);
  const spd = Number(evs.spd ?? 0);
  const spe = Number(evs.spe ?? 0);
  if (/trick-room|slow/.test(role)) return spe <= 4 && hp >= 120 ? 100 : 55;
  if (/physical-wall|body-press/.test(role)) return def >= 180 && hp >= 180 ? 100 : 50;
  if (/special-wall/.test(role)) return spd >= 180 && hp >= 180 ? 100 : 50;
  if (/redirection|pivot|support/.test(role)) return hp >= 180 && def + spd >= 120 ? 100 : 60;
  if (/physical/.test(role)) return atk >= 180 ? 100 : 65;
  if (/special/.test(role)) return spa >= 180 ? 100 : 65;
  return 75;
}

function scoreMoveFit(set: CompetitiveSetValidationInput, role: string): number {
  const moves = (set.moves ?? []).map(normalizeMoveId);
  if (/trick-room/.test(role)) return moves.includes('trickroom') ? 100 : 45;
  if (/redirection/.test(role)) return moves.includes('followme') || moves.includes('ragepowder') ? 100 : 45;
  if (/fake-out/.test(role)) return moves.includes('fakeout') ? 100 : 45;
  if (/body-press|physical-wall/.test(role)) return moves.includes('bodypress') ? 100 : 60;
  return moves.length === 4 ? 80 : 40;
}

function sameSpread(a?: StatSpread, b?: StatSpread): boolean {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}

function sameMoves(a?: string[], b?: string[]): boolean {
  return JSON.stringify((a ?? []).map(normalizeMoveId).sort()) === JSON.stringify((b ?? []).map(normalizeMoveId).sort());
}
