import { auditCompetitiveSetCoverage } from '../equinox/data-audit/CompetitiveSetCoverageAuditor';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const report = auditCompetitiveSetCoverage({
  eligibleRoster: [
    { pokemonId: 'aggron', forms: ['aggron', 'aggronmega'] },
    { pokemonId: 'sinistcha', forms: ['sinistcha'] },
  ],
  sets: [
    {
      pokemonId: 'aggron',
      formId: 'aggronmega',
      regulationId: 'champions_reg_m_b_doubles',
      battleStyle: 'doubles',
      legal: true,
      status: 'active',
      confidence: 92,
      coherenceScore: 88,
      primaryRole: 'physical-wall',
    },
  ],
  regulationId: 'champions_reg_m_b_doubles',
  battleStyle: 'doubles',
});

assert(report.eligiblePokemon === 2, 'Coverage report must count eligible Pokemon.');
assert(report.coveredPokemon === 1, 'Coverage report must count covered Pokemon.');
assert(report.missingPokemon.includes('sinistcha'), 'Coverage report must expose missing Pokemon.');
assert(report.coveragePercent === 50, 'Coverage percent must be rounded from covered/eligible.');

console.log('[Equinox] Competitive set coverage validation passed.');
