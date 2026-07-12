import type { PokemonData } from '../equinox/core/AnalysisContext';
import { resolveBattleState } from '../equinox/vgc/VgcBattleState';
import { validateModeContract } from '../equinox/vgc/VgcModeContractValidator';
import { analyzeTacticalInteractions } from '../equinox/vgc/TacticalInteractionAnalyzer';

const pokemon = (name: string, moves: string[] = [], ability?: string, types: string[] = []): PokemonData => ({
  name,
  moves,
  ability,
  types,
  abilities: ability ? { 0: ability } : undefined,
});

const assert = {
  equal(actual: unknown, expected: unknown): void { if (actual !== expected) throw new Error(`Esperado ${String(expected)}, recebido ${String(actual)}`); },
  ok(value: unknown): void { if (!value) throw new Error('Condição esperada não foi atendida.'); },
  deepEqual(actual: unknown, expected: unknown): void { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Esperado ${JSON.stringify(expected)}, recebido ${JSON.stringify(actual)}`); },
};

function run(): void {
  const fullTeam = [
    pokemon('Pelipper', ['Weather Ball', 'Wide Guard', 'Tailwind'], 'Drizzle', ['Water', 'Flying']),
    pokemon('Relicanth', ['Wave Crash', 'Protect'], 'Swift Swim', ['Water', 'Rock']),
    pokemon('Sinistcha', ['Trick Room', 'Rage Powder'], 'Hospitality', ['Grass', 'Ghost']),
    pokemon('Aggron-Mega', ['Body Press', 'Protect'], 'Filter', ['Steel']),
    pokemon('Omastar', ['Muddy Water', 'Protect'], 'Swift Swim', ['Rock', 'Water']),
    pokemon('Togekiss', ['Follow Me', 'Protect'], 'Super Luck', ['Fairy', 'Flying']),
  ];

  const state = resolveBattleState(
    fullTeam,
    ['Pelipper', 'Relicanth', 'Sinistcha', 'Aggron-Mega'],
    ['Pelipper', 'Relicanth'],
  );
  assert.deepEqual(state.backline, ['Sinistcha', 'Aggron-Mega']);
  assert.deepEqual(state.reserves, ['Omastar', 'Togekiss']);

  const fakeOutInvalid = validateModeContract({
    selectedFour: ['Pelipper', 'Sinistcha', 'Relicanth', 'Aggron-Mega'],
    lead: ['Pelipper', 'Sinistcha'],
    backline: ['Relicanth', 'Aggron-Mega'],
    requiredActions: [{ actor: 'Iron Hands', move: 'Fake Out', timing: 'turn-1' }],
  }, [...fullTeam, pokemon('Iron Hands', ['Fake Out'], 'Quark Drive')]);
  assert.equal(fakeOutInvalid.valid, false);
  assert.ok(fakeOutInvalid.errors.some(error => error.includes('não está ativo')));

  const selfProtectionInvalid = validateModeContract({
    selectedFour: ['Sinistcha', 'Pelipper', 'Relicanth', 'Aggron-Mega'],
    lead: ['Sinistcha', 'Pelipper'],
    backline: ['Relicanth', 'Aggron-Mega'],
    requiredActions: [
      { actor: 'Sinistcha', move: 'Trick Room', timing: 'turn-1' },
      { actor: 'Sinistcha', move: 'Rage Powder', timing: 'turn-1' },
    ],
  }, fullTeam);
  assert.equal(selfProtectionInvalid.valid, false);
  assert.ok(selfProtectionInvalid.errors.some(error => error.includes('mais de uma ação')));

  const insights = analyzeTacticalInteractions(
    state.selectedPokemon,
    'champions',
    { lead: state.active, backline: state.backline },
  );
  const swiftSwim = insights.find(insight => insight.type === 'swift_swim_rain');
  assert.ok(swiftSwim);
  assert.equal(swiftSwim?.availability, 'active-now');
  assert.equal(swiftSwim?.timing?.immediateFromLead, true);

  const noOmastarInsight = insights.every(insight => !insight.pokemonInvolved.includes('Omastar'));
  assert.equal(noOmastarInsight, true);

  console.log('VGC playbook regression suite: OK');
}

run();
