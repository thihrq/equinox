import { tryConsumeActiveV2CanaryRateLimit } from '../services/competitive-data/internal-canary-auth/ActiveV2InternalCanaryRateLimiter';
import { ACTIVE_V2_INTERNAL_CANARY_AUTH_POLICY_V1 } from '../services/competitive-data/internal-canary-auth/ActiveV2InternalCanaryAuthPolicy';

function makeConnection(countAfterIncrement: number): any {
  return {
    db: {
      collection: () => ({
        updateOne: async () => ({ matchedCount: 1, upsertedCount: 0 }),
        findOne: async () => ({ count: countAfterIncrement }),
      }),
    },
  };
}

async function runTests(): Promise<void> {
  const policy = ACTIVE_V2_INTERNAL_CANARY_AUTH_POLICY_V1;

  // --- Caso de Teste 1: contagem abaixo do limite é permitida ---
  const belowLimit = await tryConsumeActiveV2CanaryRateLimit(makeConnection(1), 'alice');
  if (!belowLimit) throw new Error('Test 1 failed: expected request well below the limit to be allowed');

  // --- Caso de Teste 2: contagem exatamente no limite ainda é permitida ---
  const atLimit = await tryConsumeActiveV2CanaryRateLimit(makeConnection(policy.rateLimitMaxRequestsPerSubject), 'alice');
  if (!atLimit) throw new Error('Test 2 failed: expected request at the exact limit to be allowed');

  // --- Caso de Teste 3: contagem acima do limite é rejeitada ---
  const overLimit = await tryConsumeActiveV2CanaryRateLimit(makeConnection(policy.rateLimitMaxRequestsPerSubject + 1), 'alice');
  if (overLimit) throw new Error('Test 3 failed: expected request over the limit to be rejected');

  console.log('[Equinox] Active V2 internal canary rate limiter validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
