import { LeadBuildPhaseBudget } from './LeadBuildPhaseBudget';

export interface LeadCompletionSearchControl {
  shouldContinue(): boolean;
  maximumFinalists?: number;
  onInterrupted?(state: {
    stage: number;
    beamSize: number;
    evaluatedCombinations: number;
  }): void;
}

export class PrimarySearchGuard implements LeadCompletionSearchControl {
  public interrupted = false;
  public interruptedState?: { stage: number; beamSize: number; evaluatedCombinations: number };

  public constructor(
    private readonly phaseBudget: LeadBuildPhaseBudget,
    public readonly maximumFinalists: number = 4,
  ) {}

  public shouldContinue(): boolean {
    if (this.phaseBudget.mustFinalize() || !this.phaseBudget.canContinuePrimary()) {
      this.interrupted = true;
      return false;
    }
    return true;
  }

  public onInterrupted(state: { stage: number; beamSize: number; evaluatedCombinations: number }): void {
    this.interrupted = true;
    this.interruptedState = state;
    this.phaseBudget.setStopReason('PRIMARY_TIME_BUDGET_REACHED');
  }
}
