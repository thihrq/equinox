import { benchmarkCandidate } from '../services/competitive-data/expert/engines/CompetitiveBenchmarkEngine';
import { CompetitiveBenchmarkInput } from '../services/competitive-data/expert/engines/CompetitiveBenchmarkTypes';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const candidate = { candidateId: 'candidate', legal: true, evidenceIds: ['evidence:candidate'], dimensions: { damagePressure: 7, speedTier: 7, roleFit: 7, archetypeFit: 7, fullTeamFit: 7 } };
const input: CompetitiveBenchmarkInput = {
  candidateId: 'candidate',
  alternativeCandidateIds: [],
  comparisonLimit: 3,
  candidate,
  alternativeCandidates: [
    { candidateId: 'identical', legal: true, evidenceIds: ['evidence:identical'], dimensions: candidate.dimensions },
    { candidateId: 'illegal', legal: false, evidenceIds: ['evidence:illegal'], dimensions: { damagePressure: 10, speedTier: 10, roleFit: 10, archetypeFit: 10, fullTeamFit: 10 } },
    { candidateId: 'dominating', legal: true, evidenceIds: ['evidence:dominating'], dimensions: { damagePressure: 8, speedTier: 8, roleFit: 8, archetypeFit: 8, fullTeamFit: 8 } },
    { candidateId: 'mixed', legal: true, evidenceIds: ['evidence:mixed'], dimensions: { damagePressure: 9, speedTier: 6, roleFit: 8, archetypeFit: 6, fullTeamFit: 9 } },
    { candidateId: 'creative', legal: true, evidenceIds: [], creative: true, dimensions: { damagePressure: 7, speedTier: 7, roleFit: 7, archetypeFit: 7, fullTeamFit: 8 } },
  ],
  maxAlternativesPerCandidate: 3,
  maxMoveVariations: 2,
  maxItemVariations: 2,
  maxNatureVariations: 2,
};

const result = benchmarkCandidate(input);
assert(result.valid, 'benchmark should be valid with legal candidates');
assert(result.comparedAlternativeIds.length === 3, 'alternative limit was not respected');
assert(!result.comparedAlternativeIds.includes('illegal'), 'illegal alternative was compared');
assert(!result.comparedAlternativeIds.includes('identical'), 'identical alternative was compared');
assert(result.comparisons.some(item => item.candidateId === 'dominating' && item.classification === 'dominated'), 'dominated candidate was not detected');
assert(result.comparisons.some(item => item.candidateId === 'mixed' && item.classification !== 'strictly-inferior'), 'mixed candidate was incorrectly strictly inferior');
assert(result.comparisons.some(item => item.candidateId === 'creative' && item.classification === 'creative-but-unproven'), 'creative warning was not recorded');
assert(result.findings.some(item => item.code === 'BENCHMARK_EVIDENCE_REQUIRED'), 'missing evidence warning was not recorded');
const repeat = benchmarkCandidate(input);
assert(repeat.resultDigest === result.resultDigest, 'same benchmark input must generate same digest');

console.log('[Equinox] Competitive benchmark engine tests passed.');
