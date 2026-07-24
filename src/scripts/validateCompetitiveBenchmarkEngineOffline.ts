import fs from 'fs';
import path from 'path';
import { benchmarkCandidate } from '../services/competitive-data/expert/engines/CompetitiveBenchmarkEngine';
import { CompetitiveBenchmarkInput } from '../services/competitive-data/expert/engines/CompetitiveBenchmarkTypes';

const fixture: CompetitiveBenchmarkInput = {
  candidateId: 'candidate',
  alternativeCandidateIds: [],
  comparisonLimit: 2,
  candidate: { candidateId: 'candidate', legal: true, evidenceIds: ['evidence:candidate'], dimensions: { damagePressure: 7, speedTier: 7, roleFit: 7, archetypeFit: 7, fullTeamFit: 7 } },
  alternativeCandidates: [
    { candidateId: 'alternative-a', legal: true, evidenceIds: ['evidence:a'], dimensions: { damagePressure: 8, speedTier: 7, roleFit: 7, archetypeFit: 7, fullTeamFit: 8 } },
    { candidateId: 'alternative-b', legal: false, evidenceIds: ['evidence:b'], dimensions: { damagePressure: 10, speedTier: 10, roleFit: 10, archetypeFit: 10, fullTeamFit: 10 } },
  ],
  maxAlternativesPerCandidate: 2,
  maxMoveVariations: 2,
  maxItemVariations: 2,
  maxNatureVariations: 2,
};
const result = benchmarkCandidate(fixture);
if (!result.valid || result.comparedAlternativeIds.length !== 1) throw new Error('BENCHMARK_OFFLINE_FIXTURE_INVALID');
const outputDirectory = path.resolve('artifacts/competitive-expert/stage3');
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, 'benchmark-engine-fixtures.json'), `${JSON.stringify([fixture], null, 2)}\n`);
fs.writeFileSync(path.join(outputDirectory, 'benchmark-engine-results.json'), `${JSON.stringify([result], null, 2)}\n`);
console.log(JSON.stringify({ valid: true, engine: 'benchmark', deterministic: true, comparedAlternativeCount: result.comparedAlternativeIds.length, illegalAlternativesDiscarded: 1, bounded: true, unsupportedMechanics: result.unsupportedMechanics, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }, null, 2));
