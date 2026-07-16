export interface ActiveV2RuntimeControlPolicy {
  version: string;
  collectionName: string;
  changelogPath: string;
}

export const ACTIVE_V2_RUNTIME_CONTROL_POLICY_V1: ActiveV2RuntimeControlPolicy = {
  version: 'active-v2-runtime-control-v1',
  collectionName: 'active-v2-runtime-control',
  changelogPath: 'docs/data-audit/active-v2-runtime-flag-changelog.md',
} as const;
