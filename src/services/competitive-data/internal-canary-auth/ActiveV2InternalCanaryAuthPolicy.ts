export interface ActiveV2InternalCanaryAuthPolicy {
  version: string;
  timestampWindowMs: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequestsPerSubject: number;
  nonceCollectionName: string;
  rateLimitCollectionName: string;
  headerNames: {
    subject: string;
    timestamp: string;
    nonce: string;
    signature: string;
  };
}

export const ACTIVE_V2_INTERNAL_CANARY_AUTH_POLICY_V1: ActiveV2InternalCanaryAuthPolicy = {
  version: 'active-v2-internal-canary-auth-v1',
  // Janela de tolerância de relógio para o timestamp assinado.
  timestampWindowMs: 5 * 60 * 1000,
  rateLimitWindowMs: 60 * 1000,
  rateLimitMaxRequestsPerSubject: 30,
  nonceCollectionName: 'active-v2-canary-nonce-store',
  rateLimitCollectionName: 'active-v2-canary-rate-limit',
  headerNames: {
    subject: 'x-equinox-canary-subject',
    timestamp: 'x-equinox-canary-timestamp',
    nonce: 'x-equinox-canary-nonce',
    signature: 'x-equinox-canary-signature',
  },
} as const;
