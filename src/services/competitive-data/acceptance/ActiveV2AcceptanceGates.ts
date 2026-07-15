import type {
  ActiveV2AcceptanceReport,
  AcceptanceGateStatus,
} from './ActiveV2AcceptanceTypes';

export function evaluateAcceptanceGates(report: ActiveV2AcceptanceReport): ActiveV2AcceptanceReport {
  const counts = report.classificationCounts;

  let gateStatus: AcceptanceGateStatus = 'approved';

  if (counts.blocker > 0 || counts.regression > 0 || report.globalBlockers.length > 0) {
    gateStatus = 'rejected';
  } else if (counts['human-review-needed'] > 0) {
    gateStatus = 'human-review-required';
  }

  const automaticRolloutApproved = gateStatus === 'approved';

  return {
    ...report,
    gateStatus,
    automaticRolloutApproved,
  };
}
