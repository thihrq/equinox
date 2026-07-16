export interface PublishOptions {
  publishRunId: string;
  dryRun: boolean;
  sourceCollection: string;
  targetCollection: string;
  /** Publicação emergencial durante janela canária ativa — ver ActiveV2DataFreezeGuard. */
  emergencyOverride?: boolean;
  emergencyJustification?: string | null;
}

export type PublishStatus = 'no-op' | 'success' | 'failed';

export interface PublishResult {
  status: PublishStatus;
  reasonCode?: string;
  activePublishRunId?: string;
  requestedPublishRunId?: string;
  manifest?: any;
}

export interface RollbackOptions {
  dryRun: boolean;
}

export interface RollbackResult {
  status: 'success' | 'failed';
  reasonCode?: string;
}
