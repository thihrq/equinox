/// <reference types="node" />
import { AnalysisContext, PokemonData } from '../equinox/core/AnalysisContext';
import { SynergyEngine } from '../equinox/engines/SynergyEngine';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function mockPokemon(params: {
  name: string;
  ability?: string;
  abilities?: Record<string, string>;
  item?: string;
  moves?: string[];
  baseSpeed?: number;
}): PokemonData {
  return {
    name: params.name,
    dexNumber: 1,
    isLegendary: false,
    ability: params.ability,
    abilities: params.abilities,
    item: params.item,
    moves: params.moves,
    variants: [{
      formatId: 'gen9ou',
      baseStats: {
        hp: 80,
        atk: 80,
        def: 80,
        spa: 80,
        spd: 80,
        spe: params.baseSpeed ?? 80,
      },
    }],
  };
}

const filler = (name: string, item?: string) => mockPokemon({ name, item, baseSpeed: 80 });

async function runTests() {
  const engine = new SynergyEngine();

  console.log('🧪 Iniciando testes de validação da SynergyEngine...');

  // --- Teste 1: Chuva Sinergética (Pelipper/Drizzle + Kingdra/Swift Swim) -> score deve ser 25.
  {
    const team = [
      mockPokemon({ name: 'Pelipper', ability: 'Drizzle' }),
      mockPokemon({ name: 'Kingdra', ability: 'Swift Swim' }),
      filler('Pikachu', 'Light Ball'),
      filler('Bulbasaur', 'Eviolite'),
      filler('Charmander', 'Charcoal'),
      filler('Squirtle', 'Mystic Water'),
    ];
    const context = new AnalysisContext({ format: 'gen9ou', selectedPokemon: team });
    engine.execute(context);
    assert(context.score.synergy === 25, `Teste 1 Falhou: Score de chuva esperado 25, obtido ${context.score.synergy}`);
    console.log('✅ Teste 1 (Chuva Sinergética) Passou!');
  }

  // --- Teste 2: Conflito de Clima (Charizard/Drought + Tyranitar/Sand Stream) -> score deve ser -45.
  {
    const team = [
      mockPokemon({ name: 'Charizard', ability: 'Drought' }),
      mockPokemon({ name: 'Tyranitar', ability: 'Sand Stream' }),
      filler('Pikachu', 'Light Ball'),
      filler('Bulbasaur', 'Eviolite'),
      filler('Charmander', 'Charcoal'),
      filler('Squirtle', 'Mystic Water'),
    ];
    const context = new AnalysisContext({ format: 'gen9ou', selectedPokemon: team });
    engine.execute(context);
    assert(context.score.synergy === -45, `Teste 2 Falhou: Score de conflito de clima esperado -45, obtido ${context.score.synergy}`);
    console.log('✅ Teste 2 (Conflito de Clima) Passou!');
  }

  // --- Teste 3: Campo Psíquico (Indeedee/Psychic Surge + Expanding Force) -> score deve ser 20.
  {
    const team = [
      mockPokemon({ name: 'Indeedee', ability: 'Psychic Surge' }),
      mockPokemon({ name: 'Alakazam', moves: ['Expanding Force'] }),
      filler('Pikachu', 'Light Ball'),
      filler('Bulbasaur', 'Eviolite'),
      filler('Charmander', 'Charcoal'),
      filler('Squirtle', 'Mystic Water'),
    ];
    const context = new AnalysisContext({ format: 'gen9ou', selectedPokemon: team });
    engine.execute(context);
    assert(context.score.synergy === 20, `Teste 3 Falhou: Score de terreno psíquico esperado 20, obtido ${context.score.synergy}`);
    console.log('✅ Teste 3 (Campo Psíquico) Passou!');
  }

  // --- Teste 4: Conflito de Campos (Indeedee/Psychic Surge + Rillaboom/Grassy Surge) -> score deve ser -35.
  {
    const team = [
      mockPokemon({ name: 'Indeedee', ability: 'Psychic Surge' }),
      mockPokemon({ name: 'Rillaboom', ability: 'Grassy Surge' }),
      filler('Pikachu', 'Light Ball'),
      filler('Bulbasaur', 'Eviolite'),
      filler('Charmander', 'Charcoal'),
      filler('Squirtle', 'Mystic Water'),
    ];
    const context = new AnalysisContext({ format: 'gen9ou', selectedPokemon: team });
    engine.execute(context);
    assert(context.score.synergy === -35, `Teste 4 Falhou: Score de conflito de campos esperado -35, obtido ${context.score.synergy}`);
    console.log('✅ Teste 4 (Conflito de Campos) Passou!');
  }

  // --- Teste 5: Trick Room Sinergético (Trick Room Setter + 2 Pokémon com base speed <= 55) -> score deve ser 20.
  {
    const team = [
      mockPokemon({ name: 'Cresselia', moves: ['Trick Room'], baseSpeed: 50 }),
      mockPokemon({ name: 'Torkoal', baseSpeed: 20 }),
      filler('Pikachu', 'Light Ball'),
      filler('Bulbasaur', 'Eviolite'),
      filler('Charmander', 'Charcoal'),
      filler('Squirtle', 'Mystic Water'),
    ];
    const context = new AnalysisContext({ format: 'gen9ou', selectedPokemon: team });
    engine.execute(context);
    assert(context.score.synergy === 20, `Teste 5 Falhou: Score de Trick Room sinérgico esperado 20, obtido ${context.score.synergy}`);
    console.log('✅ Teste 5 (Trick Room Sinergético) Passou!');
  }

  // --- Teste 6: Conflito de Trick Room (Trick Room Setter + 2 Pokémon rápidos >= 100 Spe) -> score deve ser -30.
  {
    const team = [
      mockPokemon({ name: 'Cresselia', moves: ['Trick Room'], baseSpeed: 50 }),
      mockPokemon({ name: 'Dragapult', baseSpeed: 142 }),
      mockPokemon({ name: 'Regieleki', baseSpeed: 200 }),
      filler('Pikachu', 'Light Ball'),
      filler('Bulbasaur', 'Eviolite'),
      filler('Charmander', 'Charcoal'),
    ];
    const context = new AnalysisContext({ format: 'gen9ou', selectedPokemon: team });
    engine.execute(context);
    assert(context.score.synergy === -30, `Teste 6 Falhou: Score de conflito de Trick Room esperado -30, obtido ${context.score.synergy}`);
    console.log('✅ Teste 6 (Conflito de Trick Room) Passou!');
  }

  // --- Teste 7: Volt-Turn Momentum (2 ou mais Pokémon com golpes Volt Switch/U-turn/Flip Turn/Parting Shot) -> score deve ser 15.
  {
    const team = [
      mockPokemon({ name: 'Rotom-Wash', moves: ['Volt Switch'] }),
      mockPokemon({ name: 'Landorus-T', moves: ['U-turn'] }),
      filler('Pikachu', 'Light Ball'),
      filler('Bulbasaur', 'Eviolite'),
      filler('Charmander', 'Charcoal'),
      filler('Squirtle', 'Mystic Water'),
    ];
    const context = new AnalysisContext({ format: 'gen9ou', selectedPokemon: team });
    engine.execute(context);
    assert(context.score.synergy === 15, `Teste 7 Falhou: Score de Volt-Turn Momentum esperado 15, obtido ${context.score.synergy}`);
    console.log('✅ Teste 7 (Volt-Turn Momentum) Passou!');
  }

  // --- Teste 8: Violação de Item Clause (dois itens iguais em formatos oficiais) -> score deve ser -50.
  {
    const team = [
      mockPokemon({ name: 'Gholdengo', item: 'Leftovers' }),
      mockPokemon({ name: 'Gliscor', item: 'Leftovers' }),
      filler('Pikachu', 'Light Ball'),
      filler('Bulbasaur', 'Eviolite'),
      filler('Charmander', 'Charcoal'),
      filler('Squirtle', 'Choice Band'),
    ];
    const context = new AnalysisContext({ format: 'vgc2026', selectedPokemon: team });
    engine.execute(context);
    assert(context.score.synergy === -50, `Teste 8 Falhou: Score de violação de Item Clause esperado -50, obtido ${context.score.synergy}`);
    console.log('✅ Teste 8 (Violação de Item Clause) Passou!');
  }

  // --- Teste 9: Conflito de Abusador com Clima Concorrente (Tyranitar/Sand Stream + Charizard/Solar Power) -> score deve ser -40.
  {
    const team = [
      mockPokemon({ name: 'Tyranitar', ability: 'Sand Stream' }),
      mockPokemon({ name: 'Charizard', ability: 'Solar Power' }),
      filler('Pikachu'),
      filler('Bulbasaur'),
      filler('Charmander'),
      filler('Squirtle'),
    ];
    const context = new AnalysisContext({ format: 'gen9ou', selectedPokemon: team });
    engine.execute(context);
    assert(context.score.synergy === -40, `Teste 9 Falhou: Score de conflito abuser/clima esperado -40, obtido ${context.score.synergy}`);
    console.log('✅ Teste 9 (Conflito Abusador/Clima) Passou!');
  }

  // --- Teste 10: Conflito de Abusador com Terreno Concorrente (Rillaboom/Grassy Surge + Alakazam/Expanding Force) -> score deve ser -30.
  {
    const team = [
      mockPokemon({ name: 'Rillaboom', ability: 'Grassy Surge' }),
      mockPokemon({ name: 'Alakazam', moves: ['Expanding Force'] }),
      filler('Pikachu'),
      filler('Bulbasaur'),
      filler('Charmander'),
      filler('Squirtle'),
    ];
    const context = new AnalysisContext({ format: 'gen9ou', selectedPokemon: team });
    engine.execute(context);
    assert(context.score.synergy === -30, `Teste 10 Falhou: Score de conflito abuser/terreno esperado -30, obtido ${context.score.synergy}`);
    console.log('✅ Teste 10 (Conflito Abusador/Terreno) Passou!');
  }

  console.log('🎉 Todos os 10 testes da SynergyEngine passaram com sucesso!');
}

runTests().catch(err => {
  console.error('❌ Erro durante a execução dos testes da SynergyEngine:', err);
  process.exit(1);
});
