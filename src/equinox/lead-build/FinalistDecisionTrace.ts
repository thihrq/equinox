import { StructuredGateReason } from './StrategyQualityDiagnostics';

export interface GateTrace {
  gate: string;
  valid: boolean;
  score?: number;
  threshold?: number;
  reasons: readonly StructuredGateReason[];
}

export interface FinalistDecisionTrace {
  strategyId: string;
  teamKey: string;

  gates: readonly GateTrace[];

  valid: boolean;
  failedGates: readonly string[];
  primaryReason: string;
}

export function createFinalistDecisionTrace(
  strategyId: string,
  teamKey: string,
  gates: readonly GateTrace[],
): FinalistDecisionTrace {
  const failedGates = gates.filter(g => !g.valid).map(g => g.gate);
  const valid = failedGates.length === 0;

  let primaryReason = 'APPROVED';
  if (!valid) {
    const firstFailed = gates.find(g => !g.valid);
    if (firstFailed && firstFailed.reasons.length > 0) {
      primaryReason = firstFailed.reasons[0].reasonCode;
    } else if (firstFailed) {
      primaryReason = `${firstFailed.gate}_FAILURE`;
    } else {
      primaryReason = 'QUALITY_GATE_FAILURE';
    }
  }

  return {
    strategyId,
    teamKey,
    gates,
    valid,
    failedGates,
    primaryReason,
  };
}
