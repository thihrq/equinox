import { PokemonType } from './TeamDefensiveProfile';
import { DefensiveCapability, StrategicCapability, CandidateCapabilityProfile } from './CandidateCapabilityClassifier';

export type CapabilitySeverity = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface CapabilityRequirement {
  id: string;
  capability: DefensiveCapability | StrategicCapability;
  attackType?: PokemonType;
  severity: CapabilitySeverity;
  requiredMinimum: number;
  desiredMinimum: number;
  acceptedAlternatives: readonly (DefensiveCapability | StrategicCapability)[];
  reasonCodes: readonly string[];
}

export interface CandidatePoolCoverageContract {
  targetSize: number;
  minimumOffensiveQuota: number; // e.g. 0.5 (50%)
  minimumPivotQuota: number;
  minimumUtilityQuota: number;

  requirements: readonly CapabilityRequirement[];
}

export interface CapabilityFulfillment {
  requirementId: string;
  requiredMinimum: number;
  desiredMinimum: number;
  availableDistinctAnswers: number;
  selectedDistinctAnswers: number;
  fulfilled: boolean;
  desiredFulfilled: boolean;
  selectedCandidateIds: readonly string[];
  diversityKeys: readonly string[];
}

export interface CandidatePoolCoverageResult {
  valid: boolean;

  targetSizeReached: boolean;
  functionalCoverageSatisfied: boolean;
  offensiveQuotaSatisfied: boolean;

  fulfillments: readonly CapabilityFulfillment[];

  unmetRequiredCapabilities: readonly string[];
  unmetDesiredCapabilities: readonly string[];

  sourceLimitations: readonly string[];
}

export function evaluateCandidatePoolCoverage(
  contract: CandidatePoolCoverageContract,
  candidateProfiles: readonly CandidateCapabilityProfile[],
  selectedCandidateIds: readonly string[],
): CandidatePoolCoverageResult {
  const fulfillments: CapabilityFulfillment[] = [];
  const unmetRequired: string[] = [];
  const unmetDesired: string[] = [];
  const sourceLimitations: string[] = [];

  for (const req of contract.requirements) {
    const matchingSelected = new Set<string>();
    const matchingDiversityKeys = new Set<string>();
    const availableDiversityKeys = new Set<string>();

    for (const profile of candidateProfiles) {
      const isSelected = selectedCandidateIds.includes(profile.candidateId);
      const allCaps = [...profile.defensiveCapabilities, ...profile.strategicCapabilities];

      const matches = allCaps.some(cap => {
        if (cap.capability === req.capability || req.acceptedAlternatives.includes(cap.capability)) {
          if (req.attackType) {
            return cap.attackType === req.attackType;
          }
          return true;
        }
        return false;
      });

      if (matches) {
        for (const dKey of profile.diversityKeys) {
          if (dKey.includes(req.capability) || req.acceptedAlternatives.some(alt => dKey.includes(alt))) {
            if (!req.attackType || dKey.includes(req.attackType)) {
              availableDiversityKeys.add(dKey);
              if (isSelected) {
                matchingSelected.add(profile.candidateId);
                matchingDiversityKeys.add(dKey);
              }
            }
          }
        }
      }
    }

    const availableCount = availableDiversityKeys.size;
    const selectedCount = matchingDiversityKeys.size;
    const fulfilled = selectedCount >= req.requiredMinimum;
    const desiredFulfilled = selectedCount >= req.desiredMinimum;

    if (!fulfilled) {
      unmetRequired.push(req.id);
    }
    if (!desiredFulfilled) {
      unmetDesired.push(req.id);
    }

    if (availableCount < req.desiredMinimum) {
      sourceLimitations.push(`INSUFFICIENT_SOURCE_ANSWERS:${req.id}`);
    }

    fulfillments.push({
      requirementId: req.id,
      requiredMinimum: req.requiredMinimum,
      desiredMinimum: req.desiredMinimum,
      availableDistinctAnswers: availableCount,
      selectedDistinctAnswers: selectedCount,
      fulfilled,
      desiredFulfilled,
      selectedCandidateIds: Array.from(matchingSelected),
      diversityKeys: Array.from(matchingDiversityKeys),
    });
  }

  // Quota ofensiva
  const offensiveCount = candidateProfiles.filter(p =>
    selectedCandidateIds.includes(p.candidateId) &&
    p.strategicCapabilities.some(c => c.capability === 'OFFENSIVE_SYNERGY' || p.diversityKeys.some(k => k.includes('OFFENSIVE')))
  ).length;

  const totalSelected = selectedCandidateIds.length;
  const offensiveRatio = totalSelected > 0 ? offensiveCount / totalSelected : 1;
  const offensiveQuotaSatisfied = offensiveRatio >= (contract.minimumOffensiveQuota ?? 0.5);

  const targetSizeReached = totalSelected >= contract.targetSize;
  const functionalCoverageSatisfied = unmetRequired.length === 0;
  const valid = functionalCoverageSatisfied && offensiveQuotaSatisfied;

  return {
    valid,
    targetSizeReached,
    functionalCoverageSatisfied,
    offensiveQuotaSatisfied,
    fulfillments,
    unmetRequiredCapabilities: unmetRequired,
    unmetDesiredCapabilities: unmetDesired,
    sourceLimitations,
  };
}
