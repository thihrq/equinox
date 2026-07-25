import fs from 'fs';
import path from 'path';
import { assertChampionsExpertValidationFlags, assertExpertContractsOnly } from '../services/competitive-data/expert/CompetitiveDoublesExpertPolicy';
import { validateExpertVerdictContract } from '../services/competitive-data/expert/CompetitiveDoublesExpertResultValidator';
import { ExpertCandidateRef, ExpertVerdict } from '../services/competitive-data/expert/CompetitiveDoublesExpertTypes';

declare const process: { env: Record<string, string | undefined>; exitCode?: number };

const errors: string[] = [];
try {
  const flags = assertChampionsExpertValidationFlags();
  assertExpertContractsOnly(flags);
  const expertRoot = path.resolve('src/services/competitive-data/expert');
  for (const relativePath of [
    'CompetitiveDoublesExpertTypes.ts',
    'CompetitiveDoublesExpertPolicy.ts',
    'CompetitiveDoublesExpertContext.ts',
    'CompetitiveDoublesExpertAgent.ts',
    'CompetitiveDoublesExpertOrchestrator.ts',
    'CompetitiveDoublesExpertRegistry.ts',
    'CompetitiveDoublesExpertResultValidator.ts',
    'engines/DamageCalculationTypes.ts',
    'engines/SpeedTierTypes.ts',
    'engines/TeamScenarioTypes.ts',
    'engines/CompetitiveBenchmarkTypes.ts',
    'validators/ExpertValidatorTypes.ts',
    'specialists/ExpertSpecialistTypes.ts',
    'audit/ExpertAuditTypes.ts',
    'adversarial/ExpertAdversarialTypes.ts',
  ]) if (!fs.existsSync(path.join(expertRoot, relativePath))) errors.push(`CONTRACT_FILE_MISSING:${relativePath}`);
  const candidate: ExpertCandidateRef = { candidateId: 'offline', candidateDigest: 'sha256:offline', pokemonId: '0006-000', speciesId: 'charizard', status: 'generated', reviewStatus: 'draft' };
  const verdict: ExpertVerdict = { candidate, decision: 'expert-review-required', score: 0, findings: [], evidence: [], automaticPromotionAllowed: false, humanReviewRequired: true, policyVersion: 'champions-mb-automated-expert-validation-v1' };
  if (validateExpertVerdictContract(verdict).length > 0) errors.push('VERDICT_CONTRACT_INVALID');
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
}
console.log(JSON.stringify({ valid: errors.length === 0, enginesExecuted: false, networkReads: 0, mongoReads: 0, mongoWrites: 0, productionWrites: 0, errors }, null, 2));
if (errors.length > 0) process.exitCode = 1;
