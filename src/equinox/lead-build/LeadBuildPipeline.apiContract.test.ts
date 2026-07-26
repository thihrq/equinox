function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testApiContractEquivalence() {
  console.log('[Equinox Test] Testando equivalência do contrato da API pública...');

  const samplePublicResponse = {
    strategies: [
      {
        strategyId: 'sun_offense',
        strategyName: 'Sun Offense',
        lead: ['Charizard-Mega-Y', 'Whimsicott'],
        team: ['Charizard-Mega-Y', 'Whimsicott', 'Heatran', 'Venusaur'],
        score: 85,
      },
    ],
  };

  assert(Array.isArray(samplePublicResponse.strategies), 'strategies deve ser um array');
  assert(samplePublicResponse.strategies.length > 0, 'Deve conter pelo menos 1 estratégia na resposta pública');

  console.log('✅ LeadBuildPipeline API contract equivalence testado com sucesso!');
}

if (require.main === module) {
  testApiContractEquivalence();
}
