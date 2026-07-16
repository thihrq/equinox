import { classifyScenarioVerdict } from '../services/competitive-data/acceptance/ActiveV2AcceptanceClassifier';
import type { ActiveV2ShadowScenarioResult } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowTypes';

const baseScenarioMock: ActiveV2ShadowScenarioResult = {
  scenarioId: 'test-scenario',
  passed: true,
  baselineResult: {
    path: 'current',
    sourceMode: 'controlled-baseline',
    enginePath: 'current',
    sourceKind: 'controlled-snapshot',
    inputPokemon: ['Sinistcha', 'Aggron-Mega'],
    format: 'champions-reg-mb-doubles',
    teamIdentity: 'balanced',
    allowLegendaries: false,
    seedState: 'not-applicable',
    setsConsumed: ['sinistcha-bulky-trick-room-setter-baseline', 'aggronmega-slow-physical-breaker-baseline'],
    movesUsed: [],
    itemsUsed: [],
    abilitiesUsed: [],
    roles: [],
    leadStrategies: [],
    selectedLeadStrategy: 'trick_room',
    score: 80,
    fallbackUsed: false,
    fallbackReason: null,
    exportResult: null,
    errors: [],
    durationMs: 0,
    competitiveVerificationState: 'staging-controlled',
  },
  activeV2Result: {
    path: 'active-v2-staging',
    sourceMode: 'mongo-staging-active',
    enginePath: 'current-with-explicit-v2-context',
    sourceKind: 'mongo-active-staging',
    inputPokemon: ['Sinistcha', 'Aggron-Mega'],
    format: 'champions-reg-mb-doubles',
    teamIdentity: 'balanced',
    allowLegendaries: false,
    seedState: 'not-applicable',
    setsConsumed: ['sinistcha-bulky-trick-room-setter-draft', 'aggronmega-slow-physical-breaker-draft'],
    movesUsed: [],
    itemsUsed: [],
    abilitiesUsed: [],
    roles: [],
    leadStrategies: [],
    selectedLeadStrategy: 'trick_room',
    score: 80,
    fallbackUsed: false,
    fallbackReason: null,
    exportResult: null,
    errors: [],
    durationMs: 0,
    competitiveVerificationState: 'staging-controlled',
  },
  comparison: {
    sameScenarioInput: true,
    sameFormat: true,
    sameTeamIdentity: true,
    sameAllowLegendaries: true,
    sameSeed: 'not-applicable',
    setDiff: { status: 'equal', baseline: [], activeV2: [], added: [], removed: [], changed: [] },
    moveDiff: { status: 'equal', baseline: [], activeV2: [], added: [], removed: [], changed: [] },
    itemDiff: { status: 'equal', baseline: [], activeV2: [], added: [], removed: [], changed: [] },
    abilityDiff: { status: 'equal', baseline: [], activeV2: [], added: [], removed: [], changed: [] },
    roleDiff: { status: 'equal', baseline: [], activeV2: [], added: [], removed: [], changed: [] },
    leadStrategyDiff: { status: 'equal', baseline: [], activeV2: [], added: [], removed: [], changed: [] },
    selectedLeadStrategyDiff: { status: 'equal', baseline: null, activeV2: null, added: [], removed: [], changed: [] },
    teamDataCoverageDiff: { status: 'equal', baseline: {}, activeV2: {}, added: [], removed: [], changed: [] },
    fullTeamEvaluationDiff: { status: 'equal', baseline: {}, activeV2: {}, added: [], removed: [], changed: [] },
    scoreDiff: { status: 'equal', baseline: 80, activeV2: 80, added: [], removed: [], changed: [] },
    fallbackDiff: { status: 'equal', baseline: false, activeV2: false, added: [], removed: [], changed: [] },
    exportDiff: { status: 'equal', baseline: null, activeV2: null, added: [], removed: [], changed: [] },
    latencyDiffMs: 0,
    latencyDeltaPercent: 0,
    errorDiff: { status: 'equal', baseline: [], activeV2: [], added: [], removed: [], changed: [] },
    errors: [],
    criticalFieldsPresent: true,
    differencesFullyRecorded: true,
  },
};

function runClassifierTests(): void {
  // Teste 1: Todos os comparadores críticos iguais -> equivalent
  const res1 = classifyScenarioVerdict(baseScenarioMock);
  if (res1.scenarioClassification !== 'equivalent') {
    throw new Error(`Expected 'equivalent', got '${res1.scenarioClassification}'`);
  }

  // Teste 2: Delta < -10 (Score -12) -> regression
  const scenario2 = {
    ...baseScenarioMock,
    activeV2Result: { ...baseScenarioMock.activeV2Result, score: 68 }, // 80 - 12 = 68
    comparison: {
      ...baseScenarioMock.comparison,
      scoreDiff: { status: 'different', baseline: 80, activeV2: 68, added: [], removed: [], changed: [] },
    },
  };
  const res2 = classifyScenarioVerdict(scenario2 as any);
  if (res2.scenarioClassification !== 'regression') {
    throw new Error(`Expected 'regression' for score -12, got '${res2.scenarioClassification}'`);
  }

  // Teste 3: Delta entre -10 e -5 (Score -7) -> human-review-needed
  const scenario3 = {
    ...baseScenarioMock,
    activeV2Result: { ...baseScenarioMock.activeV2Result, score: 73 }, // 80 - 7 = 73
    comparison: {
      ...baseScenarioMock.comparison,
      scoreDiff: { status: 'different', baseline: 80, activeV2: 73, added: [], removed: [], changed: [] },
    },
  };
  const res3 = classifyScenarioVerdict(scenario3 as any);
  if (res3.scenarioClassification !== 'human-review-needed') {
    throw new Error(`Expected 'human-review-needed' for score -7, got '${res3.scenarioClassification}'`);
  }

  // Teste 4: Delta maior que +5 (Score +8) sem outras divergências -> improvement
  const scenario4 = {
    ...baseScenarioMock,
    activeV2Result: { ...baseScenarioMock.activeV2Result, score: 88 }, // 80 + 8 = 88
    comparison: {
      ...baseScenarioMock.comparison,
      scoreDiff: { status: 'different', baseline: 80, activeV2: 88, added: [], removed: [], changed: [] },
    },
  };
  const res4 = classifyScenarioVerdict(scenario4 as any);
  if (res4.scenarioClassification !== 'improvement') {
    throw new Error(`Expected 'improvement' for score +8, got '${res4.scenarioClassification}'`);
  }

  // Teste 5: Score +8 com estratégia central diferente -> human-review-needed
  const scenario5 = {
    ...baseScenarioMock,
    activeV2Result: { ...baseScenarioMock.activeV2Result, score: 88, selectedLeadStrategy: 'offensive' },
    comparison: {
      ...baseScenarioMock.comparison,
      selectedLeadStrategyDiff: { status: 'different', baseline: 'trick_room', activeV2: 'offensive', added: [], removed: [], changed: [] },
      scoreDiff: { status: 'different', baseline: 80, activeV2: 88, added: [], removed: [], changed: [] },
    },
  };
  const res5 = classifyScenarioVerdict(scenario5 as any);
  if (res5.scenarioClassification !== 'human-review-needed') {
    throw new Error(`Expected 'human-review-needed' for strategy change, got '${res5.scenarioClassification}'`);
  }

  // Teste 6: Score +8 com fallback V2 -> blocker
  const scenario6 = {
    ...baseScenarioMock,
    activeV2Result: { ...baseScenarioMock.activeV2Result, score: 88, fallbackUsed: true },
    comparison: {
      ...baseScenarioMock.comparison,
      fallbackDiff: { status: 'different', baseline: false, activeV2: true, added: [], removed: [], changed: [] },
      scoreDiff: { status: 'different', baseline: 80, activeV2: 88, added: [], removed: [], changed: [] },
    },
  };
  const res6 = classifyScenarioVerdict(scenario6 as any);
  if (res6.scenarioClassification !== 'blocker') {
    throw new Error(`Expected 'blocker' for V2 fallback, got '${res6.scenarioClassification}'`);
  }

  // Teste 7: Moves diferentes + roles iguais + delta +2 -> acceptable-divergence
  const scenario7 = {
    ...baseScenarioMock,
    activeV2Result: { ...baseScenarioMock.activeV2Result, score: 82 }, // 80 + 2 = 82
    comparison: {
      ...baseScenarioMock.comparison,
      moveDiff: { status: 'different', baseline: [], activeV2: [], added: [], removed: [], changed: [] },
      scoreDiff: { status: 'different', baseline: 80, activeV2: 82, added: [], removed: [], changed: [] },
    },
  };
  const res7 = classifyScenarioVerdict(scenario7 as any);
  if (res7.scenarioClassification !== 'acceptable-divergence') {
    throw new Error(`Expected 'acceptable-divergence', got '${res7.scenarioClassification}'`);
  }

  // Teste 8: Queda de quality rank de set (verified para generic-fallback) -> regression
  const scenario8 = {
    ...baseScenarioMock,
    activeV2Result: { ...baseScenarioMock.activeV2Result, setsConsumed: ['sinistcha-bulky-trick-room-setter-fallback'] },
    comparison: {
      ...baseScenarioMock.comparison,
      setDiff: { status: 'different', baseline: [], activeV2: [], added: [], removed: [], changed: [] },
    },
  };
  const res8 = classifyScenarioVerdict(scenario8 as any);
  if (res8.scenarioClassification !== 'regression') {
    throw new Error(`Expected 'regression' for set quality rank drop, got '${res8.scenarioClassification}'`);
  }

  // Teste 9: Erro no comparador errorDiff -> blocker
  const scenario9 = {
    ...baseScenarioMock,
    activeV2Result: { ...baseScenarioMock.activeV2Result, errors: ['Some error'] },
    comparison: {
      ...baseScenarioMock.comparison,
      errorDiff: { status: 'different', baseline: [], activeV2: [], added: [], removed: [], changed: [] },
    },
  };
  const res9 = classifyScenarioVerdict(scenario9 as any);
  if (res9.scenarioClassification !== 'blocker') {
    throw new Error(`Expected 'blocker' for execution errors, got '${res9.scenarioClassification}'`);
  }

  // Teste 10: Comparador obrigatório ausente -> blocker (no classificador por cenario e veredicto)
  const scenario10 = {
    ...baseScenarioMock,
    comparison: {
      ...baseScenarioMock.comparison,
      scoreDiff: undefined, // Ausente
    },
  };
  const res10 = classifyScenarioVerdict(scenario10 as any);
  if (res10.scenarioClassification !== 'blocker') {
    throw new Error(`Expected 'blocker' for missing critical comparator, got '${res10.scenarioClassification}'`);
  }

  // Teste 11: Precedência múltipla (Score +12 + estratégia diferente + fallback V2 introduzido) -> blocker
  const scenario11 = {
    ...baseScenarioMock,
    activeV2Result: {
      ...baseScenarioMock.activeV2Result,
      score: 92, // +12
      selectedLeadStrategy: 'offensive', // estratégia diferente
      fallbackUsed: true, // fallback introduzido
    },
    comparison: {
      ...baseScenarioMock.comparison,
      scoreDiff: { status: 'different', baseline: 80, activeV2: 92, added: [], removed: [], changed: [] },
      selectedLeadStrategyDiff: { status: 'different', baseline: 'trick_room', activeV2: 'offensive', added: [], removed: [], changed: [] },
      fallbackDiff: { status: 'different', baseline: false, activeV2: true, added: [], removed: [], changed: [] },
    },
  };
  const res11 = classifyScenarioVerdict(scenario11 as any);
  if (res11.scenarioClassification !== 'blocker') {
    throw new Error(`Expected 'blocker' (blocker > human-review-needed > improvement), got '${res11.scenarioClassification}'`);
  }

  console.log('[Equinox] Active V2 acceptance classifier validation passed.');
}

runClassifierTests();
