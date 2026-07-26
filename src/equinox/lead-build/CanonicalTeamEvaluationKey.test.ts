import { createCanonicalTeamEvaluationKey, CanonicalEvaluationContext, CanonicalPokemonBuildIdentity } from './CanonicalTeamEvaluationKey';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testCanonicalTeamEvaluationKey() {
  console.log('[Equinox Test] Testando a chave de avaliação canônica de time...');

  const ctx: CanonicalEvaluationContext = {
    format: 'gen9vgc2024',
    strategyId: 'sun_offense',
    strategyProfileId: 'sun_standard',
  };

  const team1: CanonicalPokemonBuildIdentity[] = [
    {
      canonicalSpecies: 'Charizard',
      form: 'Mega-Y',
      setId: 'charizard-mega-y-sun',
      item: 'Charizardite Y',
      ability: 'Drought',
      moves: ['Protect', 'Heat Wave', 'Solar Beam', 'Air Slash'],
    },
  ];

  const key1 = createCanonicalTeamEvaluationKey(ctx, team1);
  assert(key1.startsWith('sha256:'), 'Key deve iniciar com sha256:');

  // 1. Golpes em ordem diferente devem gerar a MESMA chave
  const team1ReorderedMoves: CanonicalPokemonBuildIdentity[] = [
    {
      canonicalSpecies: 'Charizard',
      form: 'Mega-Y',
      setId: 'charizard-mega-y-sun',
      item: 'Charizardite Y',
      ability: 'Drought',
      moves: ['Air Slash', 'Solar Beam', 'Heat Wave', 'Protect'],
    },
  ];
  const key1Alt = createCanonicalTeamEvaluationKey(ctx, team1ReorderedMoves);
  assert(key1 === key1Alt, 'Reordenação de golpes deve produzir a mesma chave canônica');

  // 2. Mudança em forma/set/item/habilidade deve gerar CHAVE DIFERENTE
  const team2: CanonicalPokemonBuildIdentity[] = [
    {
      canonicalSpecies: 'Charizard',
      form: 'Base',
      setId: 'charizard-solar-power',
      item: 'Life Orb',
      ability: 'Solar Power',
      moves: ['Protect', 'Heat Wave', 'Solar Beam', 'Air Slash'],
    },
  ];
  const key2 = createCanonicalTeamEvaluationKey(ctx, team2);
  assert(key1 !== key2, 'Forma/Set/Item diferentes devem gerar chave canônica diferente');

  console.log('✅ CanonicalTeamEvaluationKey testado com sucesso!');
}

if (require.main === module) {
  testCanonicalTeamEvaluationKey();
}
