import { runFormatScopeAudit } from '../equinox/qa/FormatScopeAudit';

const report = runFormatScopeAudit();

console.log(
  `[Equinox] Format scope audit: status=${report.status} checks=${report.totalChecks} pass=${report.passedChecks} warnings=${report.warningChecks} fail=${report.failedChecks}`,
);

for (const check of report.checks) {
  const issueCount = check.errors.length + check.warnings.length;
  console.log(`[${check.status.toUpperCase()}] ${check.id} | issues=${issueCount}`);

  for (const detail of check.details.slice(0, 3)) {
    console.log(`  detail: ${detail}`);
  }

  for (const error of check.errors) {
    console.error(`  error: ${error}`);
  }

  for (const warning of check.warnings.slice(0, 3)) {
    console.warn(`  warning: ${warning}`);
  }
}

if (report.status === 'fail') {
  throw new Error(`Format scope audit failed with ${report.failedChecks} failing checks.`);
}
