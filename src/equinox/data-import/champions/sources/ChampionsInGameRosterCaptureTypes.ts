export interface ChampionsInGameRosterCaptureEntry {
  displayedName?: string;
  displayedForm?: string;
  pageOrPosition?: number;
  evidenceFileId: string;
  iconReference?: string;
}

export interface ChampionsInGameRosterCapture {
  snapshotId: string;
  regulationId: 'M-B';
  capturedAt: string;
  capturedBy: string;
  gameVersion: string;
  platformVersion?: string;
  locale: string;
  entries: ChampionsInGameRosterCaptureEntry[];
  captureComplete: boolean;
  reviewerAttestations: Array<{
    reviewerId: string;
    reviewedAt: string;
    result: 'approved' | 'rejected';
  }>;
}

export interface ChampionsInGameEvidenceManifest {
  snapshotId: string;
  files: Array<{
    evidenceFileId: string;
    relativePath: string;
    sha256: string;
    pageOrPosition?: number;
  }>;
}
