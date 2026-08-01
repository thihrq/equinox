import { buildTestPokemon } from './DeterministicCandidateSources';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

/**
 * Prova de que a corrupção silenciosa de casing (088-C) não pode mais
 * acontecer sem ser notada: uma fixture com tipo fora do domínio canônico
 * falha na construção, em vez de produzir um gate defensivo sempre cego.
 */
export function testDeterministicCandidateSourcesCasing() {
  console.log('[Equinox Test] Testando validação de casing canônico em buildTestPokemon...');

  const canonical = buildTestPokemon('Heatran', 485, ['Steel', 'Fire']);
  assert(canonical.types?.[0] === 'Steel', 'buildTestPokemon com tipos canônicos deve funcionar normalmente.');
  console.log('✅ buildTestPokemon com "Fire"/"Steel" PASS');

  let threw = false;
  try {
    buildTestPokemon('BrokenMon', 1, ['fire']);
  } catch (error) {
    threw = true;
    assert(
      String((error as Error).message).includes('INVALID_POKEMON_TYPE_CASING'),
      'Erro deve identificar explicitamente a causa como casing inválido.',
    );
  }
  assert(threw, 'buildTestPokemon com "fire" (minúsculo) deveria lançar, não degradar silenciosamente.');
  console.log('✅ buildTestPokemon com "fire" minúsculo THROWS INVALID_POKEMON_TYPE_CASING PASS');

  console.log('✅ DeterministicCandidateSources (casing) testado com sucesso!');
}

if (require.main === module) {
  testDeterministicCandidateSourcesCasing();
}
