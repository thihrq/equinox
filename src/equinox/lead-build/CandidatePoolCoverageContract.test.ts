import { CandidateCapabilityClassifier } from './CandidateCapabilityClassifier';
import { CandidatePoolCoverageContract, evaluateCandidatePoolCoverage } from './CandidatePoolCoverageContract';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testCandidatePoolCoverageContract() {
  console.log('[Equinox Test] Testando o contrato de cobertura funcional do pool de candidatos...');

  const classifier = new CandidateCapabilityClassifier();

  const pHeatran = classifier.classify({
    candidateId: 'heatran',
    species: 'Heatran',
    setId: 'heatran-standard',
    types: ['Steel', 'Fire'],
  });

  const pArchaludon = classifier.classify({
    candidateId: 'archaludon',
    species: 'Archaludon',
    setId: 'archaludon-stamina',
    types: ['Steel', 'Dragon'],
  });

  const pKingambit = classifier.classify({
    candidateId: 'kingambit',
    species: 'Kingambit',
    setId: 'kingambit-defiant',
    types: ['Dark', 'Steel'],
  });

  const contract: CandidatePoolCoverageContract = {
    targetSize: 40,
    minimumOffensiveQuota: 0.5,
    minimumPivotQuota: 0,
    minimumUtilityQuota: 0,
    requirements: [
      {
        id: 'TYPE_RESISTANCE:Ice',
        capability: 'TYPE_RESISTANCE',
        attackType: 'Ice',
        severity: 'CRITICAL',
        requiredMinimum: 1,
        desiredMinimum: 2,
        acceptedAlternatives: ['TYPE_IMMUNITY', 'SAFE_SWITCH_IN'],
        reasonCodes: ['CRITICAL_ICE_WEAKNESS'],
      },
    ],
  };

  // 1. Pool com 32 selecionados que contêm Heatran + Kingambit (2 respostas distintas a Gelo)
  const profiles = [pHeatran, pArchaludon, pKingambit];
  const selectedIds = ['heatran', 'kingambit'];

  const result1 = evaluateCandidatePoolCoverage(contract, profiles, selectedIds);

  assert(result1.targetSizeReached === false, 'targetSizeReached deve ser false (2 < 40)');
  assert(result1.functionalCoverageSatisfied === true, 'functionalCoverageSatisfied deve ser true (contém respostas a Gelo)');
  assert(result1.valid === true, 'valid deve ser true mesmo com targetSizeReached = false');
  assert(result1.unmetRequiredCapabilities.length === 0, 'unmetRequiredCapabilities deve ser vazio');

  console.log('✅ CandidatePoolCoverageContract testado com sucesso!');
}

if (require.main === module) {
  testCandidatePoolCoverageContract();
}
