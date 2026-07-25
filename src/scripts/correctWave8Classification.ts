// Release governance -- Task 1 of the release-immutability-and-real-ga plan. Corrects the prior
// Wave 8 run's overclaimed final report. The real authorization envelope for run 20260723T232100Z
// (artifacts/competitive-production-readiness/20260723T232100Z/authorization/ga-authorization-
// sanitized.json) records deploymentTarget:"local-worktree-isolated" and a placeholder
// artifactDigest ("sha256:wave8-build-digest-e9abeb5" -- not a real 64-hex sha256), proving that
// run was an isolated local simulation, not real production traffic -- yet its final report
// claimed "WAVE 8 APPROVED — GENERAL AVAILABILITY COMPLETED". This script never mutates evidence;
// it only reclassifies the report text to match the real, already-recorded evidence.
import fs from 'fs';
import path from 'path';
import { classifyWave8Outcome, ExecutionEvidenceIdentity } from '../services/release-governance/ExecutionEvidence';

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function hasFlag(name: string): boolean { return process.argv.includes(name); }
function fail(message: string, code: number): never { console.error(message); process.exitCode = code; throw new Error(message); }
function writeAtomic(file: string, value: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, value, 'utf8');
  try { fs.renameSync(temporary, file); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EPERM') { console.error(`ARTIFACT_ATOMIC_RENAME_BLOCKED:${file}`); fs.copyFileSync(temporary, file); fs.unlinkSync(temporary); return; }
    throw error;
  }
}

// The real, already-recorded evidence for this specific run -- derived from its own authorization
// envelope, not asserted fresh. See file header for the two concrete tells (deploymentTarget,
// placeholder artifactDigest).
const WAVE8_REAL_EVIDENCE: ExecutionEvidenceIdentity = {
  executionMode: 'isolated-production-simulation',
  evidenceClass: 'simulated',
  realPublicTrafficChanged: false,
  requestOrigin: 'deterministic-fixtures',
  metricsOrigin: 'local-runtime-instrumentation',
};

function main(): void {
  const allowed = new Set(['--run-id', '--check']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--') && process.argv[i] !== '--check') i += 1; }
  const runId = arg('--run-id');
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const runDir = path.resolve(`artifacts/competitive-production-readiness/${runId}`);
  const authPath = path.join(runDir, 'authorization', 'ga-authorization-sanitized.json');
  if (!fs.existsSync(authPath)) fail(`Missing authorization envelope for run ${runId}: ${authPath}`, 12);
  const auth = JSON.parse(fs.readFileSync(authPath, 'utf8')) as { deploymentTarget: string; artifactDigest: string };

  // Verify the evidence against the real, on-disk authorization envelope rather than trusting a
  // hardcoded assumption -- if a future run's envelope genuinely shows a real deploymentTarget and
  // a real sha256 artifactDigest, this script must not still call it a simulation.
  const looksIsolated = auth.deploymentTarget === 'local-worktree-isolated';
  const looksPlaceholderDigest = !/^sha256:[a-f0-9]{64}$/.test(auth.artifactDigest);
  const evidence: ExecutionEvidenceIdentity = looksIsolated || looksPlaceholderDigest
    ? WAVE8_REAL_EVIDENCE
    : { executionMode: 'production-execution', evidenceClass: 'production-observed', realPublicTrafficChanged: true, requestOrigin: 'authorized-production-traffic', metricsOrigin: 'provider-production-telemetry' };

  const classification = classifyWave8Outcome(evidence);
  const isDryRun = classification.startsWith('WAVE 8 DRY-RUN APPROVED');

  if (hasFlag('--check')) {
    console.log(`executionMode=${evidence.executionMode}`);
    console.log(`evidenceClass=${evidence.evidenceClass}`);
    console.log(`realPublicTrafficChanged=${evidence.realPublicTrafficChanged}`);
    console.log(`classification=${isDryRun ? 'DRY_RUN_APPROVED' : 'GA_COMPLETED'}`);
    return;
  }

  // Correct the final report text. Idempotent by construction: if this script has already run
  // against this file (detected via the correction-section marker), skip re-applying the
  // replacements -- a second run previously double-applied every .replace() and duplicated the
  // appended section, corrupting the file (peer review Ciclo A caught this live).
  const reportPath = path.join(runDir, 'reports', 'wave-8-final-report.md');
  const CORRECTION_MARKER = '## Correção de Classificação (release-immutability-and-real-ga, Task 1)';
  const originalReport = fs.readFileSync(reportPath, 'utf8');
  const alreadyCorrected = originalReport.includes(CORRECTION_MARKER);
  if (!alreadyCorrected) {
    const correctedReport = originalReport
      .replace('Classificação Final: WAVE 8 APPROVED — GENERAL AVAILABILITY COMPLETED, POST-LAUNCH STABILIZATION PASSED', `Classificação Final: ${classification}`)
      .replace('Ambiente Autorizado: production', 'Ambiente Autorizado: production (mas executado como isolated-production-simulation -- ver correção abaixo)')
      .replace('Target de Tráfego Atingido: 100% General Availability', 'Target de Tráfego Simulado: 100% (local-worktree-isolated, não tráfego real)')
      .replace('Estado Operacional Atual: General Availability Ativa sob Pacote Homologado', 'Estado Operacional Atual: Simulação de GA aprovada (dry-run); GA real ainda não executada')
      + `\n${CORRECTION_MARKER}\n\n` +
      `A classificação original desta run afirmava "GENERAL AVAILABILITY COMPLETED" apesar do próprio\n` +
      `envelope de autorização (\`authorization/ga-authorization-sanitized.json\`) registrar\n` +
      `\`deploymentTarget: "local-worktree-isolated"\` e um \`artifactDigest\` placeholder\n` +
      `(\`sha256:wave8-build-digest-e9abeb5\`, não um sha256 real de 64 caracteres hex) -- ambos\n` +
      `provando que esta run foi uma simulação local isolada, não tráfego real de produção.\n\n` +
      `- executionMode: \`${evidence.executionMode}\`\n` +
      `- evidenceClass: \`${evidence.evidenceClass}\`\n` +
      `- realPublicTrafficChanged: \`${evidence.realPublicTrafficChanged}\`\n` +
      `- requestOrigin: \`${evidence.requestOrigin}\`\n` +
      `- metricsOrigin: \`${evidence.metricsOrigin}\`\n\n` +
      `Esta correção não altera nenhuma evidência real -- apenas reclassifica o texto do relatório\n` +
      `para corresponder à evidência já registrada. A GA real (production-execution,\n` +
      `evidenceClass=production-observed, tráfego real) permanece pendente do Ciclo B do plano.\n`;
    writeAtomic(reportPath, correctedReport);
  }

  // Correct the closure runtime state to carry the honest evidence identity.
  const closurePath = path.join(runDir, 'closure', 'final-runtime-state.json');
  const closure = JSON.parse(fs.readFileSync(closurePath, 'utf8')) as Record<string, unknown>;
  closure.executionMode = evidence.executionMode;
  closure.evidenceClass = evidence.evidenceClass;
  closure.realPublicTrafficChanged = evidence.realPublicTrafficChanged;
  closure.classification = classification;
  writeAtomic(closurePath, `${JSON.stringify(closure, null, 2)}\n`);

  // Peer review finding (Ciclo A review, P1): the original overclaim also lived in sibling
  // evidence files within the same run directory, not just the two files above -- correcting only
  // reports/wave-8-final-report.md left qa/qa-results.json's "verdict" field and decision-package/
  // post-launch-recommendation.md's headline status still asserting the false claim. Both are
  // corrected here for the same reason: the classification must match the real, already-recorded
  // evidence everywhere it appears, not just in the one file a reviewer happens to open first.
  const correctedFiles = [reportPath, closurePath];

  const qaResultsPath = path.join(runDir, 'qa', 'qa-results.json');
  if (fs.existsSync(qaResultsPath)) {
    const qaResults = JSON.parse(fs.readFileSync(qaResultsPath, 'utf8')) as Record<string, unknown>;
    qaResults.verdict = classification;
    qaResults.executionMode = evidence.executionMode;
    qaResults.evidenceClass = evidence.evidenceClass;
    writeAtomic(qaResultsPath, `${JSON.stringify(qaResults, null, 2)}\n`);
    correctedFiles.push(qaResultsPath);
  }

  const decisionPackagePath = path.join(runDir, 'decision-package', 'post-launch-recommendation.md');
  if (fs.existsSync(decisionPackagePath)) {
    const original = fs.readFileSync(decisionPackagePath, 'utf8');
    const corrected = original
      .replace('Status: GA COMPLETED AND STABILIZED', `Status: ${isDryRun ? 'GA DRY-RUN APPROVED (SIMULATION) -- REAL GA NOT YET EXECUTED' : 'GA COMPLETED AND STABILIZED'}`)
      .replace('O runtime competitivo validado está 100% estabilizado em produção em General Availability.', isDryRun
        ? 'O runtime competitivo validado passou por uma simulação isolada local de GA (executionMode: isolated-production-simulation) com resultado aprovado -- NAO ha trafego real de producao associado a esta run; a GA real permanece pendente.'
        : 'O runtime competitivo validado está 100% estabilizado em produção em General Availability.');
    writeAtomic(decisionPackagePath, corrected);
    correctedFiles.push(decisionPackagePath);
  }

  // Final sweep: confirm no other file in the run directory still asserts the overclaim after the
  // corrections above -- fail loudly rather than silently leaving a stray contradictory file.
  const residualClaimPattern = /GENERAL AVAILABILITY COMPLETED|GA COMPLETED AND STABILIZED|100% estabilizado em produ[cç][aã]o em General Availability/;
  const residualFiles: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.isFile() || !/\.(md|json)$/.test(entry.name)) continue;
      const content = fs.readFileSync(full, 'utf8');
      if (residualClaimPattern.test(content) && full !== reportPath) residualFiles.push(full); // reportPath legitimately quotes the old claim while explaining the correction
    }
  };
  walk(runDir);
  if (isDryRun && residualFiles.length > 0) fail(`RESIDUAL_GA_OVERCLAIM_FOUND: ${residualFiles.join(', ')}`, 41);

  console.log(JSON.stringify({ valid: true, runId, classification, evidence, correctedFiles, residualFiles, mongoReads: 0, mongoWrites: 0, networkReads: 0, productionWrites: 0 }));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    if (process.exitCode === undefined) { console.error(error instanceof Error ? error.message : error); process.exitCode = 25; }
  }
}
