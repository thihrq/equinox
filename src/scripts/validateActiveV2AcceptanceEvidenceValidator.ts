import { validateActiveV2ShadowEvidence } from '../services/competitive-data/acceptance/ActiveV2AcceptanceEvidenceValidator';

const validBaseEvidence = {
  aggregate: {
    targetCollection: 'pokemonsets_v2_staging',
    scenariosCompared: 4,
    differencesFullyRecorded: true,
    readyForCompetitiveAcceptanceGate: true,
    productionCollectionReads: 0,
    observedMongoWriteCommands: 0,
    recordsWritten: 0,
    productionWrites: 0,
    baselineFallbackUsed: false,
    activeV2FallbackUsed: false,
    localPilotFallbackUsed: false,
    activeRunId: 'active-staging-run-123',
    baselineSourceVersion: 'baseline-v1',
    baselineSourceDigest: 'sha256-abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    baselineSourceRecordCount: 9,
  },
  scenarios: [
    {
      scenarioId: 'scenario-1',
      baselineResult: { setsConsumed: ['set-1-baseline'], errors: [] },
      activeV2Result: { setsConsumed: ['set-1-draft'], errors: [] },
      comparison: {
        setDiff: { status: 'equal' },
        moveDiff: { status: 'equal' },
        itemDiff: { status: 'equal' },
        abilityDiff: { status: 'equal' },
        roleDiff: { status: 'equal' },
        leadStrategyDiff: { status: 'equal' },
        selectedLeadStrategyDiff: { status: 'equal' },
        teamDataCoverageDiff: { status: 'equal' },
        fullTeamEvaluationDiff: { status: 'equal' },
        scoreDiff: { status: 'equal' },
        fallbackDiff: { status: 'equal' },
        exportDiff: { status: 'equal' },
        errorDiff: { status: 'equal' },
        differencesFullyRecorded: true,
      },
    },
    {
      scenarioId: 'scenario-2',
      baselineResult: { setsConsumed: ['set-2-baseline'], errors: [] },
      activeV2Result: { setsConsumed: ['set-2-draft'], errors: [] },
      comparison: {
        setDiff: { status: 'equal' },
        moveDiff: { status: 'equal' },
        itemDiff: { status: 'equal' },
        abilityDiff: { status: 'equal' },
        roleDiff: { status: 'equal' },
        leadStrategyDiff: { status: 'equal' },
        selectedLeadStrategyDiff: { status: 'equal' },
        teamDataCoverageDiff: { status: 'equal' },
        fullTeamEvaluationDiff: { status: 'equal' },
        scoreDiff: { status: 'equal' },
        fallbackDiff: { status: 'equal' },
        exportDiff: { status: 'equal' },
        errorDiff: { status: 'equal' },
        differencesFullyRecorded: true,
      },
    },
    {
      scenarioId: 'scenario-3',
      baselineResult: { setsConsumed: ['set-3-baseline'], errors: [] },
      activeV2Result: { setsConsumed: ['set-3-draft'], errors: [] },
      comparison: {
        setDiff: { status: 'equal' },
        moveDiff: { status: 'equal' },
        itemDiff: { status: 'equal' },
        abilityDiff: { status: 'equal' },
        roleDiff: { status: 'equal' },
        leadStrategyDiff: { status: 'equal' },
        selectedLeadStrategyDiff: { status: 'equal' },
        teamDataCoverageDiff: { status: 'equal' },
        fullTeamEvaluationDiff: { status: 'equal' },
        scoreDiff: { status: 'equal' },
        fallbackDiff: { status: 'equal' },
        exportDiff: { status: 'equal' },
        errorDiff: { status: 'equal' },
        differencesFullyRecorded: true,
      },
    },
    {
      scenarioId: 'scenario-4',
      baselineResult: { setsConsumed: ['set-4-baseline'], errors: [] },
      activeV2Result: { setsConsumed: ['set-4-draft'], errors: [] },
      comparison: {
        setDiff: { status: 'equal' },
        moveDiff: { status: 'equal' },
        itemDiff: { status: 'equal' },
        abilityDiff: { status: 'equal' },
        roleDiff: { status: 'equal' },
        leadStrategyDiff: { status: 'equal' },
        selectedLeadStrategyDiff: { status: 'equal' },
        teamDataCoverageDiff: { status: 'equal' },
        fullTeamEvaluationDiff: { status: 'equal' },
        scoreDiff: { status: 'equal' },
        fallbackDiff: { status: 'equal' },
        exportDiff: { status: 'equal' },
        errorDiff: { status: 'equal' },
        differencesFullyRecorded: true,
      },
    },
  ],
};

function runValidationTests(): void {
  // Teste 1: Evidência perfeitamente válida
  const res1 = validateActiveV2ShadowEvidence(validBaseEvidence);
  if (!res1.valid) {
    throw new Error(`Valid evidence failed validation: ${res1.errors.join(', ')}`);
  }

  // Teste 2: targetCollection incorreta
  const res2 = validateActiveV2ShadowEvidence({
    ...validBaseEvidence,
    aggregate: { ...validBaseEvidence.aggregate, targetCollection: 'pokemonsets_production' as any },
  });
  if (res2.valid) {
    throw new Error('Validation should fail for invalid targetCollection');
  }

  // Teste 3: safety counter violado
  const res3 = validateActiveV2ShadowEvidence({
    ...validBaseEvidence,
    aggregate: { ...validBaseEvidence.aggregate, productionCollectionReads: 10 },
  });
  if (res3.valid) {
    throw new Error('Validation should fail for productionCollectionReads > 0');
  }

  // Teste 4: digest malformado
  const res4 = validateActiveV2ShadowEvidence({
    ...validBaseEvidence,
    aggregate: { ...validBaseEvidence.aggregate, baselineSourceDigest: 'md5-invalid-digest' },
  });
  if (res4.valid) {
    throw new Error('Validation should fail for invalid digest format');
  }

  // Teste 5: fallback do baseline usado
  const res5 = validateActiveV2ShadowEvidence({
    ...validBaseEvidence,
    aggregate: { ...validBaseEvidence.aggregate, baselineFallbackUsed: true },
  });
  if (res5.valid) {
    throw new Error('Validation should fail for baselineFallbackUsed = true');
  }

  // Teste 6: cenários duplicados
  const res6 = validateActiveV2ShadowEvidence({
    ...validBaseEvidence,
    scenarios: [
      validBaseEvidence.scenarios[0],
      validBaseEvidence.scenarios[0],
      validBaseEvidence.scenarios[2],
      validBaseEvidence.scenarios[3],
    ],
  });
  if (res6.valid) {
    throw new Error('Validation should fail for duplicate scenarioId');
  }

  console.log('[Equinox] Active V2 acceptance evidence validator validation passed.');
}

runValidationTests();
