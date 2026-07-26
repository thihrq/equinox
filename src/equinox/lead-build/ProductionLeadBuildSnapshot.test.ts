import { loadProductionSnapshot } from './ProductionLeadBuildSnapshot';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testProductionLeadBuildSnapshot() {
  console.log('[Equinox Test] Testando carregamento e integridade do snapshot de incidente produtivo...');

  const snapshot = loadProductionSnapshot();

  assert(snapshot.format === 'champions_reg_m_b_doubles', 'Formato deve ser champions_reg_m_b_doubles');
  assert(snapshot.lead[0] === 'Charizard-Mega-Y' && snapshot.lead[1] === 'Whimsicott', 'Lead deve ser Charizard-Mega-Y + Whimsicott');

  assert(snapshot.rawCandidateCount === 39, 'rawCandidateCount deve ser 39');
  assert(snapshot.usableCandidateCount === 32, 'usableCandidateCount deve ser 32');
  assert(snapshot.sourceExhausted === true, 'sourceExhausted deve ser true');

  assert(snapshot.rawCandidates.length === 39, 'Lista rawCandidates deve conter 39 itens');

  const accepted = snapshot.rawCandidates.filter(c => c.acceptedByHardFilter);
  assert(accepted.length === 32, 'Candidatos aceitos pelos hard filters devem ser exatamente 32');

  const rejected = snapshot.rawCandidates.filter(c => !c.acceptedByHardFilter);
  assert(rejected.length === 7, 'Candidatos rejeitados pelos hard filters devem ser exatamente 7');

  console.log('✅ Snapshots carregados e validados com sucesso!');
}

if (require.main === module) {
  testProductionLeadBuildSnapshot();
}
