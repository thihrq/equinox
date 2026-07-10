import { PokemonData } from '../core/AnalysisContext';
import { getPokemonTypes, getVariant } from '../utils/PokemonUtils';
import { optimizeSingleBattleSet } from '../utils/SingleBattleSetOptimizer';
import { enforceUniqueVgcHeldItems, isAbilityLegalForPokemon, isMegaOption } from '../utils/VgcSetOptimizer';
import { BaseFormatSolver } from './BaseFormatSolver';
import { FormatCandidateScoreParams, SetSourceInput } from './FormatSolver';

const normalize = (value?: string): string => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const hasMove = (pokemon: PokemonData, moves: string[]): boolean => {
  const wanted = moves.map(normalize);
  return (pokemon.moves ?? []).some(move => wanted.includes(normalize(move)));
};

export class ChampionsSinglesSolver extends BaseFormatSolver {
  public readonly mode = 'champions_singles' as const;
  public readonly id = 'champions-singles-solver';
  public readonly label = 'Pokémon Champions Singles Solver';
  public readonly usesItemClause = true;
  public readonly usesFourOfSixModes = false;
  public readonly usesDoublesMechanicContracts = false;
  public readonly usesSinglesFieldControlContracts = true;
  public readonly usesBossGauntlet = false;

  public override normalizePokemonSet(input: SetSourceInput): PokemonData {
    return optimizeSingleBattleSet(super.normalizePokemonSet(input), input.format, 'champions_singles');
  }

  public override normalizeFinalTeam(team: PokemonData[], format: string): PokemonData[] {
    return enforceUniqueVgcHeldItems(team, format);
  }

  public override getDiversityOptions() {
    return {
      maxCandidates: 52,
      topOverall: 28,
      perRole: 7,
      perType: 3,
      minCandidates: 26,
    };
  }

  public override adjustCandidateScore(params: FormatCandidateScoreParams): number {
    const { baseTeam, candidate, format, reasons } = params;
    const team = [...baseTeam, candidate];
    let score = 0;

    const hasHazard = team.some(pokemon => hasMove(pokemon, ['Stealth Rock', 'Spikes', 'Toxic Spikes', 'Ceaseless Edge']));
    const hasRemoval = team.some(pokemon => hasMove(pokemon, ['Rapid Spin', 'Defog', 'Mortal Spin', 'Tidy Up']));
    const hasPivot = team.some(pokemon => hasMove(pokemon, ['U-turn', 'Volt Switch', 'Flip Turn', 'Parting Shot', 'Teleport']));
    const hasStatus = team.some(pokemon => hasMove(pokemon, ['Thunder Wave', 'Will-O-Wisp', 'Toxic', 'Spore', 'Sleep Powder']));
    const fastCount = team.filter(pokemon => Number(getVariant(pokemon, format)?.baseStats?.spe ?? 0) >= 100).length;
    const candidateStats = getVariant(candidate, format)?.baseStats;
    const offense = Math.max(Number(candidateStats?.atk ?? 0), Number(candidateStats?.spa ?? 0));

    if (hasHazard) score += 16;
    if (hasRemoval) score += 18;
    if (hasPivot) score += 10;
    if (hasStatus) score += 6;
    if (fastCount >= 1) score += 8;
    if (offense >= 115) score += 12;

    const types = getPokemonTypes(candidate, format).map(type => type.toLowerCase());
    if (types.includes('ground')) score += 7;
    if (types.includes('flying') || candidate.ability?.toLowerCase() === 'levitate') score += 7;

    reasons.push('Champions Singles prioriza hazards, remoção, pivô, win condition, speed control e núcleo defensivo.');
    return score;
  }

  public override validateFinalTeam(team: PokemonData[], format: string) {
    const hardFailures: string[] = [];
    const warnings: string[] = [];

    if (team.filter(pokemon => isMegaOption(pokemon)).length > 1) hardFailures.push('Mais de uma opção Mega no time.');
    if (team.some(pokemon => !isAbilityLegalForPokemon(pokemon, format, pokemon.ability))) hardFailures.push('Habilidade ilegal no formato.');

    const items = team.map(pokemon => pokemon.item).filter(Boolean) as string[];
    if (new Set(items).size < items.length) hardFailures.push('Item Clause violada.');

    if (!team.some(pokemon => hasMove(pokemon, ['Stealth Rock', 'Spikes', 'Toxic Spikes', 'Ceaseless Edge']))) {
      warnings.push('Singles sem hazard setter claro.');
    }
    if (!team.some(pokemon => hasMove(pokemon, ['Rapid Spin', 'Defog', 'Mortal Spin', 'Tidy Up']))) {
      warnings.push('Singles sem hazard removal claro.');
    }

    return { valid: hardFailures.length === 0, hardFailures, warnings };
  }
}
