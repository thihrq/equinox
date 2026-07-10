import { FormatIntelligenceRegistry } from '../formats/FormatIntelligenceRegistry';
import { ChampionsDoublesSolver } from './ChampionsDoublesSolver';
import { ChampionsSinglesSolver } from './ChampionsSinglesSolver';
import { FormatSolver } from './FormatSolver';
import { RadicalRedSolver } from './RadicalRedSolver';
import { VanillaSolver } from './VanillaSolver';

export class FormatSolverRegistry {
  private readonly formatRegistry = new FormatIntelligenceRegistry();
  private readonly vanilla = new VanillaSolver();
  private readonly radicalRed = new RadicalRedSolver();
  private readonly championsSingles = new ChampionsSinglesSolver();
  private readonly championsDoubles = new ChampionsDoublesSolver();

  public getSolver(format: string): FormatSolver {
    const intelligence = this.formatRegistry.getProfile(format);

    if (intelligence.gameFamily === 'radical_red') return this.radicalRed;

    if (intelligence.gameFamily === 'pokemon_champions') {
      return intelligence.battleStyle === 'doubles'
        ? this.championsDoubles
        : this.championsSingles;
    }

    // Showdown/National Dex left intentionally out of the product solver map.
    // Unknown competitive aliases fall back to Champions Singles instead of
    // applying Doubles/VGC contracts globally.
    if (intelligence.gameFamily === 'smogon' || intelligence.id === 'national_dex') {
      return this.championsSingles;
    }

    return this.vanilla;
  }
}
