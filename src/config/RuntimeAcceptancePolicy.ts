export interface RuntimeAcceptancePolicyConfig {
  policyId: string;
  policyVersion: string;
  regulationId: string;
  formatId: string;
  validatedPackageId: string;
  validatedPackageDigest: string;
  requiredModes: string[];
  functionalCriteria: {
    base3Preserved: boolean;
    recommended3Count: number;
    fullTeamCount: number;
  };
  competitiveCriteria: {
    speciesClause: boolean;
    itemClause: boolean;
    megaLimit: number;
  };
  promotionCriteria: {
    maxP0: number;
    maxP1: number;
    maxP2: number;
    minLegalityRate: number;
    maxLatencyP95Ms: number;
  };
  haltCriteria: {
    packageDigestMismatch: boolean;
    illegalTeamServed: boolean;
    syntheticFallbackReactivated: boolean;
    unauthorizedMongoWrites: boolean;
  };
}

export class RuntimeAcceptancePolicy {
  private static readonly instance: RuntimeAcceptancePolicyConfig = {
    policyId: 'champions-wave5-acceptance-policy',
    policyVersion: 'wave5-v1',
    regulationId: 'M-B',
    formatId: 'champions-reg-mb-doubles',
    validatedPackageId: 'champions-wave3-validated-package',
    validatedPackageDigest: 'sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665',
    requiredModes: ['disabled', 'validate-only', 'shadow', 'serve'],
    functionalCriteria: {
      base3Preserved: true,
      recommended3Count: 3,
      fullTeamCount: 6,
    },
    competitiveCriteria: {
      speciesClause: true,
      itemClause: true,
      megaLimit: 1,
    },
    promotionCriteria: {
      maxP0: 0,
      maxP1: 0,
      maxP2: 0,
      minLegalityRate: 1.0,
      maxLatencyP95Ms: 50,
    },
    haltCriteria: {
      packageDigestMismatch: true,
      illegalTeamServed: true,
      syntheticFallbackReactivated: true,
      unauthorizedMongoWrites: true,
    },
  };

  public static getPolicy(): RuntimeAcceptancePolicyConfig {
    return { ...RuntimeAcceptancePolicy.instance };
  }

  public static assertConsistency(): boolean {
    const policy = RuntimeAcceptancePolicy.getPolicy();
    if (!policy.policyId || !policy.policyVersion) return false;
    if (policy.validatedPackageDigest !== 'sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665') return false;
    if (policy.functionalCriteria.fullTeamCount !== 6) return false;
    if (policy.competitiveCriteria.megaLimit !== 1) return false;
    return true;
  }
}
