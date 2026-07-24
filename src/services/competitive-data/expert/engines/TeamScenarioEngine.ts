import crypto from 'crypto';
import { ExpertEvidence, ExpertFinding } from '../CompetitiveDoublesExpertTypes';
import { ExpertScenarioAssessment, ScenarioFeatureSet, TeamScenarioInput, TeamScenarioResult } from './TeamScenarioTypes';

export const SCENARIO_ENGINE_VERSION = 'team-scenario-engine-v1';
export const SCENARIO_POLICY_VERSION = 'doubles-scenario-v1';

function digest(value: unknown): string {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function finding(code: string, message: string, blocking: boolean): ExpertFinding {
  return { code, message, severity: blocking ? 'error' : 'warning', blocking, evidenceIds: [] };
}

function hasFeature(features: ScenarioFeatureSet | undefined, key: keyof ScenarioFeatureSet): boolean {
  return Boolean(features?.[key]);
}

function hasSpeedControl(features: ScenarioFeatureSet | undefined, name: string): boolean {
  return Boolean(features?.speedControl?.some(item => item.trim().toLowerCase() === name.toLowerCase()));
}

function hasWeather(features: ScenarioFeatureSet | undefined, weather: string | undefined): boolean {
  return Boolean(weather && features?.weather?.some(item => item.trim().toLowerCase() === weather.toLowerCase()));
}

function assess(input: TeamScenarioInput, favorable: string[], unfavorable: string[], risks: string[]): ExpertScenarioAssessment {
  if ((input.unsupportedMechanics ?? []).length > 0) return 'insufficient-evidence';
  if (input.scenarioType === 'tailwind') {
    if (hasSpeedControl(input.teamFeatures, 'Tailwind') || input.tailwindTurns > 0) favorable.push('team provides Tailwind turns for the lead state');
    if (hasSpeedControl(input.opposingFeatures, 'Tailwind')) unfavorable.push('opposing side also has Tailwind speed control');
  }
  if (input.scenarioType === 'trick-room') {
    if (hasSpeedControl(input.teamFeatures, 'Trick Room') || input.trickRoomTurns > 0) favorable.push('team provides Trick Room turns for the lead state');
    if (hasSpeedControl(input.opposingFeatures, 'Trick Room')) unfavorable.push('opposing side also has Trick Room access');
  }
  if (input.scenarioType === 'weather-control') {
    if (hasWeather(input.teamFeatures, input.weather)) favorable.push(`team controls ${input.weather} weather`);
    if (hasWeather(input.opposingFeatures, input.weather)) unfavorable.push(`opposing side also controls ${input.weather} weather`);
    if (input.teamFeatures?.weather && input.opposingFeatures?.weather) {
      risks.push('weather state can change during the scenario');
      if (!hasWeather(input.opposingFeatures, input.weather)) unfavorable.push('opposing side brings a competing weather state');
    }
  }
  if (input.scenarioType === 'positioning' || input.scenarioType === 'opening') {
    if (hasFeature(input.teamFeatures, 'redirection')) favorable.push('redirection creates a protected positioning option');
    if (hasFeature(input.teamFeatures, 'fakeOut')) favorable.push('Fake Out creates a one-turn positioning window');
    if (hasFeature(input.teamFeatures, 'protect')) favorable.push('Protect preserves positioning resources');
    if (hasFeature(input.teamFeatures, 'priority')) favorable.push('priority creates an action-order option');
  }
  if (input.scenarioType === 'pivoting' && hasFeature(input.teamFeatures, 'pivoting')) favorable.push('team provides a pivoting route');
  if (input.scenarioType === 'defensive-switch' && hasFeature(input.teamFeatures, 'defensiveSwitch')) favorable.push('team provides a defensive switch route');
  if (input.scenarioType === 'offensive-pressure' && hasFeature(input.teamFeatures, 'spreadPressure')) favorable.push('team provides spread pressure');
  if (input.scenarioType === 'endgame' && (hasFeature(input.teamFeatures, 'priority') || hasFeature(input.teamFeatures, 'protect'))) favorable.push('team has an endgame action-order or preservation tool');
  if (favorable.length > 0 && unfavorable.length === 0) return 'supports-candidate';
  if (favorable.length > 0) return 'mixed';
  if (unfavorable.length > 0) return 'does-not-support-candidate';
  return 'mixed';
}

export function evaluateTeamScenario(input: TeamScenarioInput): TeamScenarioResult {
  const findings: ExpertFinding[] = [];
  const assumptions = input.assumptions ?? [];
  const limitations = input.limitations ?? [];
  if (assumptions.length === 0) findings.push(finding('SCENARIO_ASSUMPTIONS_MISSING', 'scenario assumptions are required', true));
  if (limitations.length === 0) findings.push(finding('SCENARIO_LIMITATIONS_MISSING', 'scenario limitations are required', true));
  const unsupportedMechanics = input.unsupportedMechanics ?? [];
  for (const mechanic of unsupportedMechanics) findings.push(finding('UNSUPPORTED_MECHANIC', `${mechanic} is not supported by ${SCENARIO_ENGINE_VERSION}`, true));
  const favorableFactors: string[] = [];
  const unfavorableFactors: string[] = [];
  const criticalRisks: string[] = [];
  const assessment = assess(input, favorableFactors, unfavorableFactors, criticalRisks);
  const valid = findings.every(item => !item.blocking);
  const result = valid ? assessment : 'insufficient-evidence';
  const candidateContribution = favorableFactors.length > 0 ? favorableFactors.slice() : ['no deterministic candidate contribution was established'];
  const partnerDependencies = input.teamFeatures?.redirection ? ['redirection partner must remain available'] : [];
  if (input.leadPokemonIds.length !== 2) findings.push(finding('LEAD_SIZE_INVALID', 'scenario lead must contain exactly two Pokemon', true));
  const resultWithoutDigest = {
    componentId: `${SCENARIO_ENGINE_VERSION}:${input.candidateId}:${input.scenarioType}`,
    valid: valid && input.leadPokemonIds.length === 2,
    findings,
    evidence: [] as ExpertEvidence[],
    execution: { executed: true, executionReason: 'engine-executed' as const },
    scenarioId: digest(input).slice(0, 24),
    candidateId: input.candidateId,
    scenarioType: input.scenarioType,
    favorableFactors,
    unfavorableFactors,
    candidateContribution,
    partnerDependencies,
    criticalRisks,
    assessment: result,
    result,
    assumptions,
    limitations,
    unsupportedMechanics,
    inputs: input,
    evidenceLevel: 'deterministic-expert-scenario' as const,
  };
  const resultDigest = digest(resultWithoutDigest);
  const evidence: ExpertEvidence[] = [{ evidenceId: `${resultWithoutDigest.componentId}:scenario`, kind: 'scenario', sourceId: 'equinox-team-scenario-engine', sourceRevision: SCENARIO_ENGINE_VERSION, inputDigest: digest(input), resultDigest, description: 'Discrete scenario assessment with explicit assumptions, limitations, dependencies, and risks.' }];
  return { ...resultWithoutDigest, evidence, resultDigest };
}
