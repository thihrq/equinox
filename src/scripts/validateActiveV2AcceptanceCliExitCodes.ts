import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

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
      baselineResult: { setsConsumed: ['set-1-baseline'], errors: [], score: 80 },
      activeV2Result: { setsConsumed: ['set-1-draft'], errors: [], score: 80 },
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
      baselineResult: { setsConsumed: ['set-2-baseline'], errors: [], score: 80 },
      activeV2Result: { setsConsumed: ['set-2-draft'], errors: [], score: 80 },
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
      baselineResult: { setsConsumed: ['set-3-baseline'], errors: [], score: 80 },
      activeV2Result: { setsConsumed: ['set-3-draft'], errors: [], score: 80 },
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
      baselineResult: { setsConsumed: ['set-4-baseline'], errors: [], score: 80 },
      activeV2Result: { setsConsumed: ['set-4-draft'], errors: [], score: 80 },
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

function checkExitCode(cmd: string, expectedCode: number): void {
  try {
    execSync(cmd, { stdio: 'ignore' });
    if (expectedCode !== 0) {
      throw new Error(`Command "${cmd}" returned code 0 but expected ${expectedCode}`);
    }
  } catch (error: any) {
    const code = error.status;
    if (code !== expectedCode) {
      throw new Error(`Command "${cmd}" returned code ${code} but expected ${expectedCode}`);
    }
  }
}

function runCliExitCodeTests(): void {
  const tempDir = path.resolve('./temp-cli-exit-codes-test');

  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  const pathApproved = path.join(tempDir, 'evidence-approved.json');
  const pathRejected = path.join(tempDir, 'evidence-rejected.json');
  const pathHumanReview = path.join(tempDir, 'evidence-human.json');

  // 1. Gravar arquivos de teste mockados
  fs.writeFileSync(pathApproved, JSON.stringify(validBaseEvidence, null, 2));

  // Rejected por regression de score
  const rejectedEvidence = {
    ...validBaseEvidence,
    scenarios: [
      {
        ...validBaseEvidence.scenarios[0],
        activeV2Result: { ...validBaseEvidence.scenarios[0].activeV2Result, score: 68 }, // -12 regressao
        comparison: {
          ...validBaseEvidence.scenarios[0].comparison,
          scoreDiff: { status: 'different' },
        },
      },
      validBaseEvidence.scenarios[1],
      validBaseEvidence.scenarios[2],
      validBaseEvidence.scenarios[3],
    ],
  };
  fs.writeFileSync(pathRejected, JSON.stringify(rejectedEvidence, null, 2));

  // Human Review por score -7
  const humanEvidence = {
    ...validBaseEvidence,
    scenarios: [
      {
        ...validBaseEvidence.scenarios[0],
        activeV2Result: { ...validBaseEvidence.scenarios[0].activeV2Result, score: 73 }, // -7 human review
        comparison: {
          ...validBaseEvidence.scenarios[0].comparison,
          scoreDiff: { status: 'different' },
        },
      },
      validBaseEvidence.scenarios[1],
      validBaseEvidence.scenarios[2],
      validBaseEvidence.scenarios[3],
    ],
  };
  fs.writeFileSync(pathHumanReview, JSON.stringify(humanEvidence, null, 2));

  const cliCmd = 'npx ts-node src/scripts/checkActiveV2Acceptance.ts';

  // Asserção 1: Argumento --input ausente -> Exit 2
  checkExitCode(cliCmd, 2);

  // Asserção 2: Arquivo inexistente -> Exit 3
  checkExitCode(`${cliCmd} --input "${path.join(tempDir, 'does-not-exist.json')}"`, 3);

  // Asserção 3: JSON inválido -> Exit 3
  const invalidJsonFile = path.join(tempDir, 'invalid.json');
  fs.writeFileSync(invalidJsonFile, '{ malformed json }');
  checkExitCode(`${cliCmd} --input "${invalidJsonFile}"`, 3);

  // Asserção 4: Evidência de shadow válida aprovada -> Exit 0
  checkExitCode(`${cliCmd} --input "${pathApproved}"`, 0);

  // Asserção 5: Evidência de shadow rejeitada -> Exit 1
  checkExitCode(`${cliCmd} --input "${pathRejected}"`, 1);

  // Asserção 6: Evidência de shadow com revisão humana -> Exit 4
  checkExitCode(`${cliCmd} --input "${pathHumanReview}"`, 4);

  // Asserção 7: Evidência inválida globalmente (ex: safety counters > 0) -> Exit 1
  const invalidGlobalEvidence = {
    ...validBaseEvidence,
    aggregate: {
      ...validBaseEvidence.aggregate,
      productionCollectionReads: 1, // Violacao
    },
  };
  const invalidGlobalFile = path.join(tempDir, 'invalid-global.json');
  fs.writeFileSync(invalidGlobalFile, JSON.stringify(invalidGlobalEvidence, null, 2));
  checkExitCode(`${cliCmd} --input "${invalidGlobalFile}"`, 1);

  // Cleanup final
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log('[Equinox] Active V2 acceptance CLI exit code validation passed.');
}

runCliExitCodeTests();
