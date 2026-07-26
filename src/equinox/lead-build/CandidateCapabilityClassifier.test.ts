import { CandidateCapabilityClassifier, getDamageMultiplier } from './CandidateCapabilityClassifier';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testCandidateCapabilityClassifier() {
  console.log('[Equinox Test] Testando o classificador de capacidades funcionais dos candidatos...');

  const classifier = new CandidateCapabilityClassifier();

  // 1. Dual typing Fire/Flying (Charizard) contra Gelo (deve ser 1x neutro, NAO resistencia)
  const charizardMult = getDamageMultiplier('Ice', ['Fire', 'Flying']);
  assert(charizardMult === 1, 'Fire/Flying contra Gelo deve ter multiplicador 1 (neutro)');

  const charizardProfile = classifier.classify({
    candidateId: 'charizard-mega-y',
    species: 'Charizard-Mega-Y',
    setId: 'charizard-mega-y-standard',
    types: ['Fire', 'Flying'],
  });

  const charizardIceRes = charizardProfile.defensiveCapabilities.find(c => c.capability === 'TYPE_RESISTANCE' && c.attackType === 'Ice');
  assert(charizardIceRes === undefined, 'Charizard-Mega-Y NÃO deve possuir resistência a Gelo');

  // 2. Dual typing Steel/Dragon (Archaludon) contra Gelo (0.5x em Steel, 2x em Dragon -> 1x neutro)
  const archaludonMult = getDamageMultiplier('Ice', ['Steel', 'Dragon']);
  assert(archaludonMult === 1, 'Steel/Dragon contra Gelo deve ter multiplicador 1 (neutro)');

  // 3. Dual typing Steel/Fire (Heatran) contra Gelo (0.5x em Steel, 0.5x em Fire -> 0.25x resistencia dupla)
  const heatranMult = getDamageMultiplier('Ice', ['Steel', 'Fire']);
  assert(heatranMult === 0.25, 'Steel/Fire contra Gelo deve ter multiplicador 0.25');

  const heatranProfile = classifier.classify({
    candidateId: 'heatran',
    species: 'Heatran',
    setId: 'heatran-standard',
    types: ['Steel', 'Fire'],
  });

  const heatranIceRes = heatranProfile.defensiveCapabilities.find(c => c.capability === 'TYPE_RESISTANCE' && c.attackType === 'Ice');
  assert(heatranIceRes !== undefined, 'Heatran DEVE possuir resistência a Gelo');

  // 4. Wide Guard -> SPREAD_MOVE_MITIGATION apenas (não TYPE_RESISTANCE)
  const wideGuardProfile = classifier.classify({
    candidateId: 'mienshao',
    species: 'Mienshao',
    setId: 'mienshao-wide-guard',
    types: ['Fighting'],
    moves: ['Wide Guard', 'Fake Out', 'Close Combat'],
  });

  const wgCap = wideGuardProfile.defensiveCapabilities.find(c => c.capability === 'SPREAD_MOVE_MITIGATION');
  assert(wgCap !== undefined, 'Wide Guard deve gerar SPREAD_MOVE_MITIGATION');
  assert(wgCap?.appliesTo === 'SPREAD', 'Wide Guard deve aplicar-se apenas a SPREAD');

  // 5. Redirection sem resistência vs com resistência
  const amoongussProfile = classifier.classify({
    candidateId: 'amoonguss',
    species: 'Amoonguss',
    setId: 'amoonguss-support',
    types: ['Grass', 'Poison'],
    moves: ['Rage Powder', 'Spore', 'Pollen Puff', 'Protect'],
  });

  const amoongussRedir = amoongussProfile.strategicCapabilities.find(c => c.capability === 'REDIRECTION');
  assert(amoongussRedir !== undefined, 'Amoonguss com Rage Powder deve possuir REDIRECTION');

  // Amoonguss resiste a Electric (Grass/Poison resiste Electric)
  const amoongussResistRedir = amoongussProfile.defensiveCapabilities.find(c => c.capability === 'RESISTANT_REDIRECTION' && c.attackType === 'Electric');
  assert(amoongussResistRedir !== undefined, 'Amoonguss deve ter RESISTANT_REDIRECTION para Electric');

  // 6. Pivots (Parting Shot)
  const incineroarProfile = classifier.classify({
    candidateId: 'incineroar',
    species: 'Incineroar',
    setId: 'incineroar-pivot',
    types: ['Fire', 'Dark'],
    ability: 'Intimidate',
    moves: ['Fake Out', 'Flare Blitz', 'Knock Off', 'Parting Shot'],
  });

  const incineroarPivot = incineroarProfile.defensiveCapabilities.find(c => c.capability === 'DEFENSIVE_PIVOT');
  assert(incineroarPivot !== undefined, 'Incineroar com Parting Shot deve possuir DEFENSIVE_PIVOT');

  const incineroarIntimidate = incineroarProfile.strategicCapabilities.find(c => c.capability === 'INTIMIDATE');
  assert(incineroarIntimidate !== undefined, 'Incineroar com Intimidate deve possuir INTIMIDATE');

  console.log('✅ CandidateCapabilityClassifier testado com sucesso!');
}

if (require.main === module) {
  testCandidateCapabilityClassifier();
}
