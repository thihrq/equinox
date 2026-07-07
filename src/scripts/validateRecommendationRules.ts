import { CandidateSelector } from '../equinox/recommendation/CandidateSelector';
import { AnalysisContext, PokemonData } from '../equinox/core/AnalysisContext';
import { AnalysisEngine } from '../equinox/core/AnalysisEngine';
import { AnalysisPipeline } from '../equinox/core/AnalysisPipeline';
import { CombinationSearchEngine } from '../equinox/recommendation/CombinationSearchEngine';
import { FormatLegalityRules } from '../equinox/recommendation/FormatLegalityRules';

const stats = {
  hp: 80,
  atk: 80,
  def: 80,
  spa: 80,
  spd: 80,
  spe: 80,
};

function assertDeepEqual<T>(actual: T, expected: T, message: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  if (actualJson !== expectedJson) {
    throw new Error(`${message}\nEsperado: ${expectedJson}\nRecebido: ${actualJson}`);
  }
}

function pokemon(name: string, dexNumber: number, bst = 480): PokemonData {
  const each = Math.floor(bst / 6);

  return {
    name,
    dexNumber,
    isLegendary: false,
    variants: [{
      formatId: 'vanilla',
      types: ['Normal'],
      abilities: { 0: 'Run Away' },
      baseStats: {
        ...stats,
        hp: each,
        atk: each,
        def: each,
        spa: each,
        spd: each,
        spe: bst - each * 5,
      },
    }],
  };
}

function select(format: string, candidates: PokemonData[]): string[] {
  return new CandidateSelector()
    .select({
      allPokemon: candidates,
      currentMembers: ['Charizard', 'Jolteon', 'Lapras'],
      format,
      allowLegendaries: false,
      limit: 20,
    })
    .map(candidate => candidate.name);
}

async function assertPipelineUsesFullTeam(): Promise<void> {
  const seenTeamSizes: number[] = [];
  const inspector: AnalysisEngine = {
    name: 'FullTeamInspector',
    execute(context: AnalysisContext): void {
      seenTeamSizes.push(context.selectedPokemon.length);
      context.score.total = context.selectedPokemon.length;
    },
  };

  const baseTeam = [
    pokemon('Charizard', 6),
    pokemon('Jolteon', 135),
    pokemon('Lapras', 131),
  ];

  const candidates = [
    pokemon('Mienfoo', 619, 350),
    pokemon('Abra', 63, 310),
    pokemon('Gastly', 92, 310),
  ];

  await new CombinationSearchEngine(new AnalysisPipeline().use(inspector), 3, {
    maxPipelineEvaluations: 3,
  }).findBestTrios({
    baseTeam,
    candidates,
    format: 'gen9lc',
    teamIdentity: 'balanced',
  });

  assertDeepEqual(
    seenTeamSizes,
    [6],
    'CombinationSearchEngine deve executar o pipeline com o time completo de 6 Pokémon.',
  );
}

async function main(): Promise<void> {
  const legalityRules = new FormatLegalityRules();

  assertDeepEqual(
    legalityRules.isEligible({ pokemon: pokemon('Charizard', 6, 534), format: 'gen9lc' }),
    false,
    'O core fixo também deve ser validado contra as regras do formato.',
  );

  assertDeepEqual(
    select('gen9lc', [
      pokemon('Metagross-Mega', 376, 700),
      pokemon('Mienfoo', 619, 350),
      pokemon('Pawniard', 624, 340),
      pokemon('Gastly', 92, 310),
    ]),
    ['Mienfoo', 'Pawniard', 'Gastly'],
    'Little Cup deve bloquear Megas/evoluídos fortes e permitir candidatos LC.',
  );

  assertDeepEqual(
    select('gen9ou', [
      pokemon('Metagross-Mega', 376, 700),
      pokemon('Corviknight', 823, 495),
      pokemon('Great Tusk', 984, 570),
    ]),
    ['Great Tusk', 'Corviknight'],
    'Gen 9 OU não deve sugerir Mega Evolution ou formas não disponíveis no formato.',
  );

  assertDeepEqual(
    select('vanilla_legends_arceus', [
      pokemon('Blacephalon', 806, 570),
      pokemon('Darmanitan-Galar-Zen', 555, 540),
      pokemon('Volcarona', 637, 550),
      pokemon('Metagross', 376, 600),
      pokemon('Ursaluna-Bloodmoon', 901, 555),
      pokemon('Kleavor', 900, 505),
      pokemon('Basculegion', 902, 530),
    ]),
    ['Basculegion', 'Kleavor'],
    'Legends Arceus deve evitar Ultra Beasts e formas claramente fora do contexto Hisui.',
  );

  await assertPipelineUsesFullTeam();

  console.log('[Equinox] Recommendation rules validation passed.');
}

void main().catch(error => {
  console.error('[Equinox] Recommendation rules validation failed.');
  console.error(error);
  throw error;
});
