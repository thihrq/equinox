import { evaluateFullTeamCached } from './LeadBuildCachedEvaluator';
import { RequestScopedEvaluationCache } from './RequestScopedEvaluationCache';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testLeadBuildCachedEvaluator() {
  console.log('[Equinox Test] Testando o avaliador cacheado de times...');

  const cache = new RequestScopedEvaluationCache<any>(500);
  const mockStrategy = { id: 'sun_offense', lead: ['Charizard-Mega-Y', 'Whimsicott'], requiredRoles: [], optionalRoles: [] } as any;

  const team = [
    { name: 'Charizard-Mega-Y', types: ['Fire', 'Flying'] },
    { name: 'Whimsicott', types: ['Grass', 'Fairy'] },
  ] as any;

  const res1 = evaluateFullTeamCached({ team, strategy: mockStrategy, format: 'gen9vgc2024', cache });
  assert(res1.cacheStatus === 'MISS', 'A primeira consulta deve ser MISS');

  const res2 = evaluateFullTeamCached({ team, strategy: mockStrategy, format: 'gen9vgc2024', cache });
  assert(res2.cacheStatus === 'HIT', 'A segunda consulta deve ser HIT');

  console.log('✅ LeadBuildCachedEvaluator testado com sucesso!');
}

if (require.main === module) {
  testLeadBuildCachedEvaluator();
}
