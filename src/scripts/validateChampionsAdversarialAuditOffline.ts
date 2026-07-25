import fs from 'fs';
import path from 'path';
declare const process: { exitCode?: number };
const root = path.resolve('artifacts/competitive-curation');
const audits = fs.existsSync(root) ? fs.readdirSync(root).filter(name => fs.existsSync(path.join(root, name, 'adversarial-audit/adversarial-summary.json'))) : [];
const errors: string[] = [];
for (const audit of audits) { const summary = JSON.parse(fs.readFileSync(path.join(root, audit, 'adversarial-audit/adversarial-summary.json'), 'utf8')); if (summary.mongoReads !== 0 || summary.mongoWrites !== 0 || summary.productionWrites !== 0) errors.push(`${audit}:UNSAFE_IO`); if (summary.criticalErrors?.length || !summary.independencePassed || !summary.thresholdsPassed || !summary.scenariosPassed || !summary.fullTeamPassed || !summary.promotionGuardPassed) errors.push(`${audit}:GATE_FAILED`); }
console.log(JSON.stringify({ valid: audits.length > 0 && errors.length === 0, audits, errors, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }, null, 2));
if (audits.length === 0 || errors.length > 0) process.exitCode = 1;
