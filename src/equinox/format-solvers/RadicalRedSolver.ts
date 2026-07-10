import { PokemonData } from '../core/AnalysisContext';
import { RadicalRedGauntletScorer } from '../radicalred/RadicalRedGauntletScorer';
import { optimizeSingleBattleSet } from '../utils/SingleBattleSetOptimizer';
import { BaseFormatSolver } from './BaseFormatSolver';
import { FormatCandidateScoreParams, SetSourceInput } from './FormatSolver';

export class RadicalRedSolver extends BaseFormatSolver {
  private readonly scorer = new RadicalRedGauntletScorer();

  public readonly mode = 'radical_red' as const;
  public readonly id = 'radical-red-solver';
  public readonly label = 'Radical Red Boss Gauntlet Solver';
  public readonly usesItemClause = false;
  public readonly usesFourOfSixModes = false;
  public readonly usesDoublesMechanicContracts = false;
  public readonly usesSinglesFieldControlContracts = false;
  public readonly usesBossGauntlet = true;

  public override normalizePokemonSet(input: SetSourceInput): PokemonData {
    return optimizeSingleBattleSet(super.normalizePokemonSet(input), input.format, 'radical_red');
  }

  public override getDiversityOptions() {
    return {
      maxCandidates: 56,
      topOverall: 28,
      perRole: 8,
      perType: 3,
      minCandidates: 28,
    };
  }

  public override adjustCandidateScore(params: FormatCandidateScoreParams): number {
    const { baseTeam, candidate, format, reasons } = params;
    const gauntlet = this.scorer.scoreCandidate({ baseTeam, candidate, format });
    if (gauntlet.reasons.length) reasons.push(...gauntlet.reasons.slice(0, 2));
    reasons.push('Radical Red prioriza consistência do time completo contra bosses, Elite 4 e campeão.');
    return Math.round(gauntlet.score * 1.75);
  }
}
