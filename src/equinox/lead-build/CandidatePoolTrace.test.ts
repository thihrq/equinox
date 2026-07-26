import { CandidatePoolTraceTracker } from './CandidatePoolTrace';
import { loadProductionSnapshot } from './ProductionLeadBuildSnapshot';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testCandidatePoolTrace() {
  console.log('[Equinox Test] Testando o rastreamento do ciclo de vida dos candidatos...');

  const tracker = new CandidatePoolTraceTracker();
  const snapshot = loadProductionSnapshot();

  for (const c of snapshot.rawCandidates) {
    tracker.recordCandidate(
      c.candidateId,
      c.species,
      c.setId,
      'RAW_FETCHED',
      c.categories,
      c.types.includes('Fire') || c.types.includes('Steel') || c.types.includes('Ice') ? ['IceResistance'] : [],
      [],
    );

    if (c.acceptedByHardFilter) {
      tracker.recordCandidate(c.candidateId, c.species, c.setId, 'HARD_FILTER_ACCEPTED');
    } else {
      tracker.recordCandidate(c.candidateId, c.species, c.setId, 'HARD_FILTER_REJECTED', [], [], [], c.hardFilterReasons.join(', '));
    }
  }

  const entries = tracker.getAllEntries();
  assert(entries.length === 39, 'Tracker deve conter 39 entradas');

  const iceAnswers = tracker.getIceAnswerLifecycle();
  assert(iceAnswers.length > 0, 'Deve rastrear candidatos com resistência/capacidade contra Gelo');

  const charizardBase = tracker.getEntry('charizard-base');
  assert(charizardBase !== undefined, 'Charizard-base deve existir no tracker');
  assert(charizardBase?.rejectionReasons.length! > 0, 'Charizard-base deve possuir motivo de rejeição');

  console.log('✅ CandidatePoolTrace testado com sucesso!');
}

if (require.main === module) {
  testCandidatePoolTrace();
}
