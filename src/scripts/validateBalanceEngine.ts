import { EquinoxBalanceReport } from '../equinox/balance/EquinoxBalanceTypes';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const sample: EquinoxBalanceReport = {
  score: 82,
  level: 'Strong',
  dimensions: {
    competitivePower: 84,
    formatFit: 83,
    coreSynergy: 80,
    setQuality: 78,
    gamePlanClarity: 82,
    matchupStability: 79,
    riskControl: 76,
    creativityViability: 72,
    identityAlignment: 85,
  },
  summary: 'Balanced competitive team with clear direction.',
  warnings: [],
};

assert(sample.score === 82, 'Balance report contract should support score.');
assert(sample.level === 'Strong', 'Balance report contract should support level.');

console.log('[Equinox] Balance engine contract validation passed.');
