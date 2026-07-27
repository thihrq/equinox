import { ProgressiveCandidateSelectionPolicy } from './ProgressiveCandidateSelectionPolicy';
import type { PokemonData } from '../core/AnalysisContext';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

export function runProgressiveCandidateFetchTest() {
  const policy = new ProgressiveCandidateSelectionPolicy({ targetInitialCount: 5 });

  const candidates: PokemonData[] = [
    { name: 'Heatran', item: 'Leftovers', moves: ['Heat Wave', 'Earth Power'] },
    { name: 'Incinerate-FakeOut', item: 'Sitrus Berry', moves: ['Fake Out', 'Knock Off'] },
    { name: 'Pelipper', ability: 'Drizzle', moves: ['Tailwind', 'Hydro Pump'] },
    { name: 'Landorus-Therian', item: 'Choice Scarf', moves: ['Earthquake', 'U-turn'] },
    { name: 'Amoonguss', item: 'Rocky Helmet', moves: ['Rage Powder', 'Spore'] },
    { name: 'Urshifu', item: 'Choice Band', moves: ['Wicked Blow'] },
  ];

  const selected = policy.selectDiverseBatch(candidates);

  assert(selected.length === 5, 'Deve selecionar exatamente 5 candidatos iniciais.');
  assert(selected.some(c => c.name === 'Pelipper'), 'Deve conter speed control / weather abuser.');
  assert(selected.some(c => c.name === 'Incinerate-FakeOut' || c.name === 'Amoonguss'), 'Deve conter suporte / redirection.');

  console.log('✅ ProgressiveCandidateFetch.test PASS');
}

if (require.main === module) {
  runProgressiveCandidateFetchTest();
}
