import { PokemonType, ALL_POKEMON_TYPES, TeamDefensiveProfile, TeamDefensiveTypeProfile } from './TeamDefensiveProfile';

export type DefensiveQualityReason =
  | 'UNANSWERED_REPEATED_WEAKNESS'
  | 'NO_DEFENSIVE_SWITCH_IN'
  | 'SEVERE_QUAD_WEAKNESS_STACK'
  | 'INSUFFICIENT_DEFENSIVE_DIVERSITY'
  | 'SEVERE_SPREAD_MOVE_EXPOSURE';

export interface DefensiveExposureAssessment {
  attackType: PokemonType;

  weakTargets: number;
  severeWeakTargets: number;
  resistantTargets: number;
  immuneTargets: number;
  safeSwitchIns: number;

  defensiveAnswers: number;
  tacticalMitigationScore: number;
  spreadMitigationScore: number;

  repeatedWeaknessPenalty: number;
  totalExposureScore: number;
  critical: boolean;

  reasons: readonly DefensiveQualityReason[];
}

export interface DefensiveQualityResult {
  valid: boolean;
  score: number;

  criticalExposureCount: number;
  highestExposureType?: PokemonType;

  assessments: Readonly<
    Record<PokemonType, DefensiveExposureAssessment>
  >;

  reasons: readonly DefensiveQualityReason[];
}

export function calculateRepeatedWeaknessPenalty(
  weakTargets: number,
  defensiveAnswers: number,
): number {
  const unanswered = Math.max(0, weakTargets - defensiveAnswers);
  if (unanswered <= 2) return 0;
  if (unanswered === 3) return 15;
  if (unanswered === 4) return 30;
  return 45;
}

export function evaluateDefensiveQuality(
  profile: TeamDefensiveProfile,
): DefensiveQualityResult {
  const assessments = {} as Record<PokemonType, DefensiveExposureAssessment>;
  const globalReasons = new Set<DefensiveQualityReason>();
  let criticalExposureCount = 0;
  let highestExposureScore = -1;
  let highestExposureType: PokemonType | undefined = undefined;
  let totalDefensiveScore = 100;

  for (const attackType of ALL_POKEMON_TYPES) {
    const typeProfile = profile.byType[attackType] || {
      attackType,
      weakTargets: 0,
      severeWeakTargets: 0,
      neutralTargets: 6,
      resistantTargets: 0,
      immuneTargets: 0,
      safeSwitchIns: 0,
      weightedExposure: 0,
      defensiveAnswers: 0,
      tacticalMitigationScore: 0,
      spreadMitigationScore: 0,
      mitigation: {
        wideGuardAgainstSpread: false,
        resistantRedirection: false,
        damageReduction: false,
        speedControl: false,
        fakeOutPressure: false,
        priorityPressure: false,
      },
    };

    const weakTargets = typeProfile.weakTargets;
    const severeWeakTargets = typeProfile.severeWeakTargets;
    const resistantTargets = typeProfile.resistantTargets;
    const immuneTargets = typeProfile.immuneTargets;
    const safeSwitchIns = typeProfile.safeSwitchIns;
    const defensiveAnswers = resistantTargets + immuneTargets;

    const reasonsForType: DefensiveQualityReason[] = [];

    // Verificação de fraquezas acumuladas sem resposta real (resistência ou imunidade)
    const isUnansweredRepeatedWeakness =
      weakTargets >= 4 &&
      resistantTargets === 0 &&
      immuneTargets === 0 &&
      safeSwitchIns === 0;

    const hasSevereQuadStack = severeWeakTargets >= 2 && defensiveAnswers === 0;

    if (isUnansweredRepeatedWeakness) {
      reasonsForType.push('UNANSWERED_REPEATED_WEAKNESS', 'NO_DEFENSIVE_SWITCH_IN');
      globalReasons.add('UNANSWERED_REPEATED_WEAKNESS');
      globalReasons.add('NO_DEFENSIVE_SWITCH_IN');
    }

    if (hasSevereQuadStack) {
      reasonsForType.push('SEVERE_QUAD_WEAKNESS_STACK');
      globalReasons.add('SEVERE_QUAD_WEAKNESS_STACK');
    }

    const repeatedWeaknessPenalty = calculateRepeatedWeaknessPenalty(weakTargets, defensiveAnswers);
    const severePenalty = severeWeakTargets * 15;
    const totalExposureScore = repeatedWeaknessPenalty + severePenalty;

    const critical = isUnansweredRepeatedWeakness || hasSevereQuadStack;
    if (critical) {
      criticalExposureCount += 1;
    }

    if (totalExposureScore > highestExposureScore) {
      highestExposureScore = totalExposureScore;
      highestExposureType = attackType;
    }

    totalDefensiveScore -= totalExposureScore;

    assessments[attackType] = {
      attackType,
      weakTargets,
      severeWeakTargets,
      resistantTargets,
      immuneTargets,
      safeSwitchIns,
      defensiveAnswers,
      tacticalMitigationScore: typeProfile.tacticalMitigationScore,
      spreadMitigationScore: typeProfile.spreadMitigationScore,
      repeatedWeaknessPenalty,
      totalExposureScore,
      critical,
      reasons: reasonsForType,
    };
  }

  const finalScore = Math.max(0, totalDefensiveScore);
  const valid = criticalExposureCount === 0;

  return {
    valid,
    score: finalScore,
    criticalExposureCount,
    highestExposureType,
    assessments,
    reasons: Array.from(globalReasons),
  };
}
