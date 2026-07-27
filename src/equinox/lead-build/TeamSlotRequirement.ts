export interface CapabilityRequirement {
  capabilityId: string;
  required: boolean;
}

export interface AlternativeCapabilityGroup {
  groupId: string;
  capabilities: readonly string[];
}

export interface CapabilityConflict {
  capabilityA: string;
  capabilityB: string;
}

export interface TeamSlotRequirement {
  slotId: string;
  role: string;
  requiredCapabilities: readonly CapabilityRequirement[];
  preferredCapabilities: readonly CapabilityRequirement[];
  alternativeGroups?: readonly AlternativeCapabilityGroup[];
  forbiddenConflicts?: readonly CapabilityConflict[];
  priority: number;
}
