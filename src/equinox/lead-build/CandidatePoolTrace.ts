export type CandidateTraceStage =
  | 'RAW_FETCHED'
  | 'HARD_FILTER_ACCEPTED'
  | 'HARD_FILTER_REJECTED'
  | 'POOL_SELECTED'
  | 'BEAM_EXPANDED'
  | 'FINALIST'
  | 'FINAL_ACCEPTED'
  | 'FINAL_REJECTED';

export interface CandidatePoolTraceEntry {
  candidateId: string;
  species: string;
  setId: string;

  stages: CandidateTraceStage[];
  categories: readonly string[];

  rejectionReasons: string[];

  defensiveCapabilities: readonly string[];
  strategicCapabilities: readonly string[];
}

export class CandidatePoolTraceTracker {
  private readonly entries = new Map<string, CandidatePoolTraceEntry>();

  recordCandidate(
    candidateId: string,
    species: string,
    setId: string,
    stage: CandidateTraceStage,
    categories: readonly string[] = [],
    defensiveCapabilities: readonly string[] = [],
    strategicCapabilities: readonly string[] = [],
    rejectionReason?: string,
  ): void {
    let entry = this.entries.get(candidateId);
    if (!entry) {
      entry = {
        candidateId,
        species,
        setId,
        stages: [],
        categories,
        rejectionReasons: [],
        defensiveCapabilities,
        strategicCapabilities,
      };
      this.entries.set(candidateId, entry);
    }

    if (!entry.stages.includes(stage)) {
      entry.stages.push(stage);
    }

    if (rejectionReason && !entry.rejectionReasons.includes(rejectionReason)) {
      entry.rejectionReasons.push(rejectionReason);
    }
  }

  getEntry(candidateId: string): CandidatePoolTraceEntry | undefined {
    return this.entries.get(candidateId);
  }

  getAllEntries(): readonly CandidatePoolTraceEntry[] {
    return Array.from(this.entries.values());
  }

  getIceAnswerLifecycle(): readonly CandidatePoolTraceEntry[] {
    return this.getAllEntries().filter(e =>
      e.defensiveCapabilities.includes('IceResistance') ||
      e.defensiveCapabilities.includes('IceImmunity') ||
      e.species === 'Aggron-Mega' ||
      e.species === 'Heatran' ||
      e.species === 'Kingambit'
    );
  }
}
