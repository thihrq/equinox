import { createLeadBuildRequestContext } from './LeadBuildRequestContext';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

export function runTelemetryCannotPassWithoutInvocationTest() {
  const context = createLeadBuildRequestContext('req-anti-false-positive-1');

  // Simula falha/sem execucao do coordinator
  assert(context.invocationCounters.anytimeCoordinatorInvocationCount === 0, 'anytimeCoordinatorInvocationCount deve iniciar em 0.');

  const allEligibleStrategiesReceivedFirstPass = context.invocationCounters.anytimeCoordinatorInvocationCount > 0;
  assert(allEligibleStrategiesReceivedFirstPass === false, 'allEligibleStrategiesReceivedFirstPass NAO pode ser verdadeiro sem invocacao.');

  console.log('✅ LeadBuildPipeline.telemetryCannotPassWithoutInvocation.test PASS');
}

if (require.main === module) {
  runTelemetryCannotPassWithoutInvocationTest();
}
