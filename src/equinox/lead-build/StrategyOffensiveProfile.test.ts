import { getStrategyOffensiveProfile } from './StrategyOffensiveProfile';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testStrategyOffensiveProfile() {
  console.log('[Equinox Test] Testando perfis de qualidade ofensiva por estratégia...');

  const tr = getStrategyOffensiveProfile('trick_room');
  assert(tr.id === 'trick_room', 'Deve retornar perfil trick_room');
  assert(tr.physicalSpecialSymmetryRequired === false, 'Trick Room não exige simetria física/especial');
  assert(tr.minimumCoverageBreadth === 30, 'Trick Room aceita cobertura de 30%');

  const balanced = getStrategyOffensiveProfile('balanced');
  assert(balanced.id === 'balanced', 'Deve retornar perfil balanced');
  assert(balanced.physicalSpecialSymmetryRequired === true, 'Balanced exige simetria física/especial');

  const unknown = getStrategyOffensiveProfile('unknown_custom_strategy');
  assert(unknown.id === 'balanced', 'Estratégia desconhecida deve usar fallback para balanced');
  assert(unknown.fallbackUsed === true, 'Deve marcar fallbackUsed = true');

  console.log('✅ Testes de StrategyOffensiveProfile passaram com sucesso!');
}

if (require.main === module) {
  testStrategyOffensiveProfile();
}
