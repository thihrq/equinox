import { calculateTeamDefensiveProfile, ALL_POKEMON_TYPES, PokemonType } from './TeamDefensiveProfile';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testTeamDefensiveProfile() {
  console.log('[Equinox Test] Testando o cálculo da matriz defensiva de time...');

  // 1. Validar avaliação dos 18 tipos
  assert(ALL_POKEMON_TYPES.length === 18, 'Deve conter exatamente 18 tipos');

  // 2. Time do caso Charizard-Mega-Y + Whimsicott:
  // Charizard-Mega-Y (Fire/Flying) -> Ice: 1.0x (neutral)
  // Whimsicott (Grass/Fairy) -> Ice: 2.0x (weak)
  // Great Tusk (Ground/Fighting) -> Ice: 2.0x (weak)
  // Sandy Shocks (Electric/Ground) -> Ice: 2.0x (weak)
  // Heliolisk (Electric/Normal) -> Ice: 1.0x (neutral)
  // Venusaur (Grass/Poison) -> Ice: 2.0x (weak)
  const baselineTeam = [
    { types: ['Fire', 'Flying'] as PokemonType[] },
    { types: ['Grass', 'Fairy'] as PokemonType[] },
    { types: ['Ground', 'Fighting'] as PokemonType[] },
    { types: ['Electric', 'Ground'] as PokemonType[] },
    { types: ['Electric', 'Normal'] as PokemonType[] },
    { types: ['Grass', 'Poison'] as PokemonType[] },
  ];

  const profile = calculateTeamDefensiveProfile(baselineTeam);
  const ice = profile.byType.Ice;

  assert(ice.weakTargets === 4, `Esperava 4 fraquezas a Gelo, encontrou ${ice.weakTargets}`);
  assert(ice.neutralTargets === 2, `Esperava 2 neutros a Gelo, encontrou ${ice.neutralTargets}`);
  assert(ice.resistantTargets === 0, `Esperava 0 resistências a Gelo, encontrou ${ice.resistantTargets}`);
  assert(ice.immuneTargets === 0, `Esperava 0 imunidades a Gelo, encontrou ${ice.immuneTargets}`);
  assert(ice.safeSwitchIns === 0, `Esperava 0 switch-ins seguros contra Gelo, encontrou ${ice.safeSwitchIns}`);

  assert(profile.criticalExposures.length > 0, 'Deve registrar ao menos 1 exposição defensiva crítica');
  const iceIssue = profile.criticalExposures.find(i => i.attackType === 'Ice');
  assert(iceIssue !== undefined, 'Deve conter exposição crítica do tipo Gelo');
  assert(iceIssue?.severity === 'CRITICAL', 'Exposição de Gelo deve ser CRITICAL');

  // 3. Time balanceado com resposta a Gelo (ex: Incineroar / Steel puro / Water)
  const balancedTeam = [
    { types: ['Fire', 'Flying'] as PokemonType[] },
    { types: ['Grass', 'Fairy'] as PokemonType[] },
    { types: ['Fire', 'Dark'] as PokemonType[] }, // Incineroar (0.5x resiste a Gelo)
    { types: ['Steel'] as PokemonType[] }, // Registeel (0.5x resiste a Gelo)
    { types: ['Water'] as PokemonType[] }, // Suicune (0.5x resiste a Gelo)
    { types: ['Electric', 'Normal'] as PokemonType[] },
  ];

  const balancedProfile = calculateTeamDefensiveProfile(balancedTeam);
  const balancedIce = balancedProfile.byType.Ice;
  assert(balancedIce.weakTargets === 1, 'Time balanceado deve ter apenas 1 fraqueza a Gelo');
  assert(balancedIce.resistantTargets === 3, 'Time balanceado deve ter 3 resistências a Gelo');

  console.log('✅ Testes de TeamDefensiveProfile passaram com sucesso!');
}

if (require.main === module) {
  testTeamDefensiveProfile();
}
