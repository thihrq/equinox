import { getLeadBuildRuntimeFlags } from './LeadBuildRuntimeFlags';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

function main(): void {
  // Default: sem env var nenhuma, weaknessPenaltyWeight deve ser 0.
  const noEnv = getLeadBuildRuntimeFlags({});
  assert(noEnv.weaknessPenaltyWeight === 0, `Sem env var, weaknessPenaltyWeight deveria ser 0, mas foi ${noEnv.weaknessPenaltyWeight}`);

  // Valor valido e propagado corretamente.
  const withValue = getLeadBuildRuntimeFlags({ EQUINOX_WEAKNESS_PENALTY_WEIGHT: '0.6' });
  assert(withValue.weaknessPenaltyWeight === 0.6, `Com EQUINOX_WEAKNESS_PENALTY_WEIGHT=0.6, esperado 0.6, mas foi ${withValue.weaknessPenaltyWeight}`);

  // Fail-safe: valor invalido (NaN) cai para 0, nao liga a penalidade por acidente.
  const invalidValue = getLeadBuildRuntimeFlags({ EQUINOX_WEAKNESS_PENALTY_WEIGHT: 'not-a-number' });
  assert(invalidValue.weaknessPenaltyWeight === 0, `Com valor invalido, esperado fallback para 0, mas foi ${invalidValue.weaknessPenaltyWeight}`);

  // Fail-safe: valor negativo tambem cai para 0.
  const negativeValue = getLeadBuildRuntimeFlags({ EQUINOX_WEAKNESS_PENALTY_WEIGHT: '-0.5' });
  assert(negativeValue.weaknessPenaltyWeight === 0, `Com valor negativo, esperado fallback para 0, mas foi ${negativeValue.weaknessPenaltyWeight}`);

  // Valor limite valido: 1 e o maximo aceito, nao deve cair para 0.
  const boundaryValue = getLeadBuildRuntimeFlags({ EQUINOX_WEAKNESS_PENALTY_WEIGHT: '1' });
  assert(boundaryValue.weaknessPenaltyWeight === 1, `Com EQUINOX_WEAKNESS_PENALTY_WEIGHT=1, esperado 1, mas foi ${boundaryValue.weaknessPenaltyWeight}`);

  // Fail-safe: valor acima de 1 (ex: typo de 6 em vez de 0.6) cai para 0.
  const tooLargeValue = getLeadBuildRuntimeFlags({ EQUINOX_WEAKNESS_PENALTY_WEIGHT: '10' });
  assert(tooLargeValue.weaknessPenaltyWeight === 0, `Com valor acima de 1, esperado fallback para 0, mas foi ${tooLargeValue.weaknessPenaltyWeight}`);

  // Fail-safe: string malformada (numero + lixo) cai para 0, nao trunca silenciosamente.
  const malformedValue = getLeadBuildRuntimeFlags({ EQUINOX_WEAKNESS_PENALTY_WEIGHT: '0.6abc' });
  assert(malformedValue.weaknessPenaltyWeight === 0, `Com valor malformado '0.6abc', esperado fallback para 0, mas foi ${malformedValue.weaknessPenaltyWeight}`);

  console.log('✅ LeadBuildRuntimeFlags.test PASS');
}

main();
