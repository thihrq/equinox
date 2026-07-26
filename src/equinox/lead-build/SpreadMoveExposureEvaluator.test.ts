import { calculateTeamDefensiveProfile, PokemonType } from './TeamDefensiveProfile';
import { evaluateSpreadMoveExposure } from './SpreadMoveExposureEvaluator';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testSpreadMoveExposureEvaluator() {
  console.log('[Equinox Test] Testando o SpreadMoveExposureEvaluator...');

  // 1. Blizzard/Icy Wind contra 4 fracos a Gelo sem respostas -> alta exposição crítica
  const iceWeakTeam = [
    { types: ['Fire', 'Flying'] as PokemonType[] },
    { types: ['Grass', 'Fairy'] as PokemonType[] },
    { types: ['Ground', 'Fighting'] as PokemonType[] },
    { types: ['Electric', 'Ground'] as PokemonType[] },
    { types: ['Electric', 'Normal'] as PokemonType[] },
    { types: ['Grass', 'Poison'] as PokemonType[] },
  ];
  const profileIce = calculateTeamDefensiveProfile(iceWeakTeam);
  const exposuresIce = evaluateSpreadMoveExposure(iceWeakTeam, profileIce);

  const iceSpread = exposuresIce.find(e => e.attackType === 'Ice');
  assert(iceSpread !== undefined, 'Deve avaliar exposição a golpes do tipo Gelo (Blizzard, Icy Wind)');
  assert(iceSpread?.vulnerableTargets === 4, `Esperava 4 alvos vulneráveis a Gelo, obteve ${iceSpread?.vulnerableTargets}`);
  assert(iceSpread?.critical === true, '4 vulnerabilidades a Gelo em área sem resposta deve ser crítico');

  // 2. Dazzling Gleam / Blizzard COM Wide Guard -> exposição reduzida
  const teamWithWideGuard = [
    { types: ['Fire', 'Flying'] as PokemonType[], moves: ['Wide Guard'] },
    { types: ['Grass', 'Fairy'] as PokemonType[] },
    { types: ['Ground', 'Fighting'] as PokemonType[] },
    { types: ['Electric', 'Ground'] as PokemonType[] },
    { types: ['Electric', 'Normal'] as PokemonType[] },
    { types: ['Grass', 'Poison'] as PokemonType[] },
  ];
  const profileWg = calculateTeamDefensiveProfile(teamWithWideGuard);
  const exposuresWg = evaluateSpreadMoveExposure(teamWithWideGuard, profileWg);
  const iceSpreadWg = exposuresWg.find(e => e.attackType === 'Ice');
  assert(iceSpreadWg?.wideGuardAvailable === true, 'Wide Guard deve estar registrado como disponível');
  assert(iceSpreadWg?.wideGuardEffective === true, 'Wide Guard deve ser efetivo contra Blizzard/Icy Wind');
  assert(iceSpreadWg?.critical === false, 'Wide Guard efetivo desativa a criticidade de exposição em área');

  // 3. Earthquake contra 2 imunidades (Flying / Levitate) -> mitigação real
  const groundTeam = [
    { types: ['Fire', 'Flying'] as PokemonType[] }, // Flying (imune a Ground)
    { types: ['Dragon', 'Flying'] as PokemonType[] }, // Flying (imune a Ground)
    { types: ['Fire', 'Rock'] as PokemonType[] }, // 4x fraco a Ground
    { types: ['Electric', 'Steel'] as PokemonType[] }, // 4x fraco a Ground
    { types: ['Fire', 'Steel'] as PokemonType[] }, // 4x fraco a Ground
    { types: ['Water'] as PokemonType[] },
  ];
  const profileGround = calculateTeamDefensiveProfile(groundTeam);
  const exposuresGround = evaluateSpreadMoveExposure(groundTeam, profileGround);
  const groundSpread = exposuresGround.find(e => e.attackType === 'Ground');
  assert(groundSpread?.immuneTargets === 2, 'Deve registrar 2 imunidades a Ground');

  // 4. Redirecionamento (Follow Me) NÃO reduz exposição a Blizzard / Earthquake (ataques em área)
  const teamWithRedirectionOnly = [
    { types: ['Fire', 'Flying'] as PokemonType[], moves: ['Follow Me'] },
    { types: ['Grass', 'Fairy'] as PokemonType[] },
    { types: ['Ground', 'Fighting'] as PokemonType[] },
    { types: ['Electric', 'Ground'] as PokemonType[] },
    { types: ['Electric', 'Normal'] as PokemonType[] },
    { types: ['Grass', 'Poison'] as PokemonType[] },
  ];
  const profileRedir = calculateTeamDefensiveProfile(teamWithRedirectionOnly);
  const exposuresRedir = evaluateSpreadMoveExposure(teamWithRedirectionOnly, profileRedir);
  const iceSpreadRedir = exposuresRedir.find(e => e.attackType === 'Ice');
  assert(iceSpreadRedir?.wideGuardAvailable === false, 'Follow Me NÃO conta como Wide Guard');
  assert(iceSpreadRedir?.critical === true, 'Follow Me NÃO protege contra golpes em área (Blizzard)');

  console.log('✅ Testes do SpreadMoveExposureEvaluator passaram com sucesso!');
}

if (require.main === module) {
  testSpreadMoveExposureEvaluator();
}
