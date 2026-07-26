import { PokemonType, ALL_POKEMON_TYPES, calculatePokemonDefensiveMultiplier } from './TeamDefensiveProfile';

export type PartialDefensiveReason =
  | 'REPEATED_WEAKNESS_BUILDING'
  | 'NO_CURRENT_DEFENSIVE_ANSWER'
  | 'NO_REMAINING_SLOT_TO_FIX'
  | 'NO_AVAILABLE_CANDIDATE_ANSWER'
  | 'UNRECOVERABLE_DEFENSIVE_EXPOSURE';

export interface PartialDefensiveExposure {
  attackType: PokemonType;

  weakTargets: number;
  severeWeakTargets: number;
  defensiveAnswers: number;

  remainingSlots: number;
  availableAnswerCandidates: number;

  recoverable: boolean;
  penalty: number;
  prune: boolean;

  reasons: readonly PartialDefensiveReason[];
}

export interface PartialTeamDefensiveResult {
  valid: boolean;
  totalPenalty: number;
  pruned: boolean;

  highestRiskType?: PokemonType;
  exposures: readonly PartialDefensiveExposure[];
}

export function calculatePartialExposurePenalty(
  weakTargets: number,
  defensiveAnswers: number,
): number {
  const unanswered = Math.max(0, weakTargets - defensiveAnswers);
  if (unanswered <= 2) return 0;
  if (unanswered === 3) return 8;
  if (unanswered === 4) return 20;
  return 40;
}

export function evaluatePartialTeamDefensiveQuality(
  team: readonly any[],
  remainingSlots: number,
  remainingCandidates: readonly any[],
): PartialTeamDefensiveResult {
  const exposures: PartialDefensiveExposure[] = [];
  let totalPenalty = 0;
  let hasPrune = false;
  let highestRiskScore = -1;
  let highestRiskType: PokemonType | undefined = undefined;

  for (const attackType of ALL_POKEMON_TYPES) {
    let weakTargets = 0;
    let severeWeakTargets = 0;
    let resistantTargets = 0;
    let immuneTargets = 0;

    for (const member of team) {
      const types: PokemonType[] = member.types || ['Normal'];
      const mult = calculatePokemonDefensiveMultiplier(attackType, types);
      if (mult >= 3.9) {
        severeWeakTargets += 1;
        weakTargets += 1;
      } else if (mult > 1.1) {
        weakTargets += 1;
      } else if (mult === 0.0) {
        immuneTargets += 1;
      } else if (mult < 0.9) {
        resistantTargets += 1;
      }
    }

    const defensiveAnswers = resistantTargets + immuneTargets;

    // Contagem de candidatos restantes no pool que oferecem resposta ao tipo
    let availableAnswerCandidates = 0;
    for (const cand of remainingCandidates) {
      const candTypes: PokemonType[] = cand.types || ['Normal'];
      const candMult = calculatePokemonDefensiveMultiplier(attackType, candTypes);
      if (candMult <= 0.5) {
        availableAnswerCandidates += 1;
      }
    }

    const canStillAddAnswer = remainingSlots > 0 && availableAnswerCandidates > 0;
    const unanswered = Math.max(0, weakTargets - defensiveAnswers);
    const penalty = calculatePartialExposurePenalty(weakTargets, defensiveAnswers);

    const prune = (weakTargets >= 4 && defensiveAnswers === 0 && !canStillAddAnswer) || (unanswered >= 5 && remainingSlots === 0);

    const reasons: PartialDefensiveReason[] = [];
    if (unanswered >= 3) reasons.push('REPEATED_WEAKNESS_BUILDING');
    if (weakTargets >= 3 && defensiveAnswers === 0) reasons.push('NO_CURRENT_DEFENSIVE_ANSWER');
    if (remainingSlots === 0) reasons.push('NO_REMAINING_SLOT_TO_FIX');
    if (availableAnswerCandidates === 0) reasons.push('NO_AVAILABLE_CANDIDATE_ANSWER');
    if (prune) reasons.push('UNRECOVERABLE_DEFENSIVE_EXPOSURE');

    if (prune) hasPrune = true;
    totalPenalty += penalty;

    if (penalty > highestRiskScore) {
      highestRiskScore = penalty;
      highestRiskType = attackType;
    }

    exposures.push({
      attackType,
      weakTargets,
      severeWeakTargets,
      defensiveAnswers,
      remainingSlots,
      availableAnswerCandidates,
      recoverable: !prune,
      penalty,
      prune,
      reasons,
    });
  }

  return {
    valid: !hasPrune,
    totalPenalty,
    pruned: hasPrune,
    highestRiskType,
    exposures,
  };
}
