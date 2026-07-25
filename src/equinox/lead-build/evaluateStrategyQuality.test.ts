import { diagnoseOffensiveScore } from './StrategyQualityDiagnostics';
import { PokemonData } from '../core/AnalysisContext';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testStrategyQualityDiagnostics() {
  console.log('[Equinox Test] Testando a paridade e decomposição do score de qualidade ofensiva...');

  const mockTeam: PokemonData[] = [
    { name: 'Aggron-Mega', types: ['Steel'], baseStats: { hp: 70, atk: 140, def: 230, spa: 60, spd: 80, spe: 50 } } as any,
    { name: 'Sinistcha', types: ['Grass', 'Ghost'], baseStats: { hp: 71, atk: 65, def: 106, spa: 121, spd: 80, spe: 52 } } as any,
    { name: 'Amoonguss', types: ['Grass', 'Poison'], baseStats: { hp: 114, atk: 85, def: 70, spa: 85, spd: 80, spe: 30 } } as any,
    { name: 'Porygon2', types: ['Normal'], baseStats: { hp: 85, atk: 80, def: 90, spa: 105, spd: 95, spe: 60 } } as any,
    { name: 'Torkoal', types: ['Fire'], baseStats: { hp: 70, atk: 85, def: 140, spa: 85, spd: 70, spe: 20 } } as any,
    { name: 'Ursaluna', types: ['Ground', 'Normal'], baseStats: { hp: 130, atk: 140, def: 105, spa: 45, spd: 80, spe: 50 } } as any,
  ];

  const diag = diagnoseOffensiveScore(mockTeam, 'champions_reg_m_b_doubles');

  console.log('[Score Diagnostics] Breakdown:', diag.breakdown);
  console.log('[Score Diagnostics] Reasons:', diag.reasons);

  // Paridade matemática com a fórmula original de FullTeamEvaluator:
  // Tipos ofensivos: Steel, Grass, Ghost, Poison, Normal, Fire, Ground (7 tipos em 18 -> 7/18 = 0.3888 -> 39)
  // Physical attackers (atk >= 100): Aggron-Mega, Ursaluna (2)
  // Special attackers (spa >= 100): Sinistcha, Porygon2 (2)
  // balancePenalty: ratio 2/2 = 1.0 -> penalty 0
  // rawScore = 38.88 - 0 = 38.88 -> Math.round -> 39!
  assert(diag.breakdown.finalScore === 39, `scoreAfter deve ser exatamente 39, recebeu ${diag.breakdown.finalScore}`);
  assert(diag.reasons.includes('LIMITED_STAB_COVERAGE'), 'Deve registrar LIMITED_STAB_COVERAGE');
  console.log('✅ Teste de paridade de diagnóstico aprovado com sucesso!');
}

if (require.main === module) {
  testStrategyQualityDiagnostics();
}
