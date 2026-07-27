import { IncompleteSearchRecoveryPlanner } from './IncompleteSearchRecoveryPlanner';
import { CandidateCapabilityIndex } from './CandidateCapabilityIndex';
import { createLeadBuildRequestContext } from './LeadBuildRequestContext';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

export function runIncompleteSearchRecoveryPlannerTest() {
  const planner = new IncompleteSearchRecoveryPlanner();
  const context = createLeadBuildRequestContext('req-test-1');
  const index = new CandidateCapabilityIndex([]);

  const plan = planner.plan({
    requestContext: context,
    compositionPlan: {
      archetypeId: 'sun_offense',
      name: 'Sun Offense',
      validationVersion: '1.0.0',
      requiredCapabilities: ['sun_abuser', 'ice_resistance'],
      preferredCapabilities: [],
      slots: [],
    },
    partialStates: [],
    initialCandidateBatch: [],
    capabilityIndex: index,
    rejectedCandidateKeys: new Set(),
    evaluatedTeamKeys: new Set(),
  });

  assert(plan.targetCapabilitiesToFetch.length >= 2, 'Deve identificar as capacidades alvo a buscar no recovery.');
  assert(plan.targetCapabilitiesToFetch.includes('sun_abuser'), 'Deve incluir sun_abuser nas capacidades alvo.');

  console.log('✅ IncompleteSearchRecoveryPlanner.test PASS');
}

if (require.main === module) {
  runIncompleteSearchRecoveryPlannerTest();
}
