import { evaluateSetCoherence } from './SetCoherenceEvaluator';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testSetCoherenceEvaluator() {
  console.log('[Equinox Test] Testando a validação de coerência interna de sets competitivos...');

  // 1. Caso Heliolisk-like: Timid + 124 Atk EV + Double-Edge -> CRITICAL
  const helioliskSet = {
    species: 'Heliolisk',
    item: 'Life Orb',
    nature: 'Timid',
    evs: { atk: 124, spa: 124, spe: 252 },
    moves: ['Thunderbolt', 'Double-Edge', 'Hyper Voice', 'Protect'],
  };
  const resHeliolisk = evaluateSetCoherence(helioliskSet);
  assert(resHeliolisk.valid === false, 'Heliolisk Timid com 124 Atk EV e Double-Edge deve ser REJEITADO (valid = false)');
  assert(resHeliolisk.criticalIssues.some(i => i.reason === 'NATURE_OFFENSIVE_STAT_MISMATCH'), 'Deve conter NATURE_OFFENSIVE_STAT_MISMATCH');

  // 2. Mixed Attacker Legítimo: Naive (sem penalizar Atk nem SpA) + Double-Edge + Thunderbolt -> VÁLIDO
  const legitimateMixed = {
    species: 'Heliolisk',
    item: 'Life Orb',
    nature: 'Naive',
    evs: { atk: 124, spa: 124, spe: 252 },
    moves: ['Thunderbolt', 'Double-Edge', 'Hyper Voice', 'Protect'],
  };
  const resMixed = evaluateSetCoherence(legitimateMixed);
  assert(resMixed.valid === true, 'Mixed attacker com Nature Naive deve ser VÁLIDO');

  // 3. Choice Specs com Protect -> CRITICAL
  const choiceProtectSet = {
    species: 'Gholdengo',
    item: 'Choice Specs',
    nature: 'Modest',
    evs: { spa: 252, spe: 252 },
    moves: ['Make It Rain', 'Shadow Ball', 'Thunderbolt', 'Protect'],
  };
  const resChoice = evaluateSetCoherence(choiceProtectSet);
  assert(resChoice.valid === false, 'Choice Specs com Protect deve ser REJEITADO');
  assert(resChoice.criticalIssues.some(i => i.reason === 'CHOICE_ITEM_WITH_PROTECT'), 'Deve conter CHOICE_ITEM_WITH_PROTECT');

  // 4. Assault Vest com Status Move -> CRITICAL
  const assaultVestSet = {
    species: 'Incineroar',
    item: 'Assault Vest',
    nature: 'Adamant',
    evs: { hp: 252, atk: 252 },
    moves: ['Fake Out', 'Flare Blitz', 'Knock Off', 'Protect'],
  };
  const resAv = evaluateSetCoherence(assaultVestSet);
  assert(resAv.valid === false, 'Assault Vest com Protect deve ser REJEITADO');
  assert(resAv.criticalIssues.some(i => i.reason === 'ASSAULT_VEST_WITH_STATUS_MOVE'), 'Deve conter ASSAULT_VEST_WITH_STATUS_MOVE');

  // 5. Zero IV em Attack com Atacante Físico -> CRITICAL
  const zeroAtkPhysicalSet = {
    species: 'Urshifu-Rapid-Strike',
    item: 'Choice Scarf',
    nature: 'Jolly',
    evs: { atk: 252, spe: 252 },
    ivs: { atk: 0, spe: 31 },
    moves: ['Surging Strikes', 'Close Combat', 'U-turn', 'Aqua Jet'],
  };
  const resZeroAtk = evaluateSetCoherence(zeroAtkPhysicalSet);
  assert(resZeroAtk.valid === false, 'Urshifu físico com 0 IVs em Atk deve ser REJEITADO');
  assert(resZeroAtk.criticalIssues.some(i => i.reason === 'ZERO_IV_CONFLICT'), 'Deve conter ZERO_IV_CONFLICT');

  // 6. Protosynthesis + Booster Energy + Set Válido -> VÁLIDO
  const flutterManeSet = {
    species: 'Flutter Mane',
    item: 'Booster Energy',
    nature: 'Timid',
    evs: { spa: 252, spe: 252 },
    moves: ['Moonblast', 'Shadow Ball', 'Dazzling Gleam', 'Protect'],
  };
  const resFlutter = evaluateSetCoherence(flutterManeSet);
  assert(resFlutter.valid === true, 'Flutter Mane Booster Energy clássico deve ser VÁLIDO');

  console.log('✅ Testes do SetCoherenceEvaluator passaram com sucesso!');
}

if (require.main === module) {
  testSetCoherenceEvaluator();
}
