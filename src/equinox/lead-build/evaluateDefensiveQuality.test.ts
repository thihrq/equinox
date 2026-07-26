import { calculateTeamDefensiveProfile, PokemonType } from './TeamDefensiveProfile';
import { evaluateDefensiveQuality } from './evaluateDefensiveQuality';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testEvaluateDefensiveQuality() {
  console.log('[Equinox Test] Testando a avaliação de qualidade defensiva...');

  // 1. Caso Charizard-Mega-Y + Whimsicott (4 fraquezas a Gelo, 0 respostas)
  const charizardWhimsicottTeam = [
    { types: ['Fire', 'Flying'] as PokemonType[] },
    { types: ['Grass', 'Fairy'] as PokemonType[] },
    { types: ['Ground', 'Fighting'] as PokemonType[] },
    { types: ['Electric', 'Ground'] as PokemonType[] },
    { types: ['Electric', 'Normal'] as PokemonType[] },
    { types: ['Grass', 'Poison'] as PokemonType[] },
  ];

  const profileCharizard = calculateTeamDefensiveProfile(charizardWhimsicottTeam);
  const resultCharizard = evaluateDefensiveQuality(profileCharizard);

  assert(resultCharizard.valid === false, 'Time com 4 fraquezas a Gelo e 0 respostas deve ser REJEITADO (valid = false)');
  assert(resultCharizard.reasons.includes('UNANSWERED_REPEATED_WEAKNESS'), 'Deve conter a razão UNANSWERED_REPEATED_WEAKNESS');
  assert(resultCharizard.reasons.includes('NO_DEFENSIVE_SWITCH_IN'), 'Deve conter a razão NO_DEFENSIVE_SWITCH_IN');
  assert(resultCharizard.criticalExposureCount >= 1, 'Deve registrar ao menos 1 exposição crítica');

  // 2. Time com 4 fraquezas a Gelo + 1 Resistência (Incineroar) -> Não deve ser criticamente rejeitado por essa regra
  const teamWithResistance = [
    { types: ['Fire', 'Flying'] as PokemonType[] },
    { types: ['Grass', 'Fairy'] as PokemonType[] },
    { types: ['Ground', 'Fighting'] as PokemonType[] },
    { types: ['Electric', 'Ground'] as PokemonType[] },
    { types: ['Fire', 'Dark'] as PokemonType[] }, // Incineroar (resiste a Gelo)
    { types: ['Grass', 'Poison'] as PokemonType[] },
  ];
  const profileRes = calculateTeamDefensiveProfile(teamWithResistance);
  const resultRes = evaluateDefensiveQuality(profileRes);
  const iceRes = resultRes.assessments.Ice;
  assert(iceRes.critical === false, '4 fraquezas a Gelo com 1 resistência NÃO deve ser marcado como critical');

  // 3. Time com 4 fraquezas + 1 Imunidade (ex: Water com Volt Absorb / Ground com Levitate)
  const teamWithImmunity = [
    { types: ['Fire', 'Flying'] as PokemonType[] },
    { types: ['Grass', 'Fairy'] as PokemonType[] },
    { types: ['Ground', 'Fighting'] as PokemonType[] },
    { types: ['Electric', 'Ground'] as PokemonType[] },
    { types: ['Steel'] as PokemonType[] }, // Registeel (resiste a Gelo)
    { types: ['Grass', 'Poison'] as PokemonType[] },
  ];
  const profileImm = calculateTeamDefensiveProfile(teamWithImmunity);
  const resultImm = evaluateDefensiveQuality(profileImm);
  const iceImm = resultImm.assessments.Ice;
  assert(iceImm.critical === false, '4 fraquezas a Gelo com resposta defensiva (Steel) NÃO é crítico');

  // 4. Mitigação apenas tática (Tailwind) com 4 fraquezas a Gelo e 0 respostas -> Continua crítico!
  const teamWithTailwindOnly = [
    { types: ['Fire', 'Flying'] as PokemonType[] },
    { types: ['Grass', 'Fairy'] as PokemonType[], moves: ['Tailwind'] },
    { types: ['Ground', 'Fighting'] as PokemonType[] },
    { types: ['Electric', 'Ground'] as PokemonType[] },
    { types: ['Electric', 'Normal'] as PokemonType[] },
    { types: ['Grass', 'Poison'] as PokemonType[] },
  ];
  const profileTw = calculateTeamDefensiveProfile(teamWithTailwindOnly);
  const resultTw = evaluateDefensiveQuality(profileTw);
  assert(resultTw.valid === false, 'Tailwind sozinho NÃO apaga exposição crítica de tipo');

  console.log('✅ Testes de evaluateDefensiveQuality passaram com sucesso!');
}

if (require.main === module) {
  testEvaluateDefensiveQuality();
}
