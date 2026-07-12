import { PokemonData } from '../core/AnalysisContext';
import { getPokemonTypes, getVariant } from '../utils/PokemonUtils';
import { getDamageMultiplier } from '../utils/DamageMultiplier';
import { BaseFormatSolver } from './BaseFormatSolver';
import { SetSourceInput } from './FormatSolver';
import { optimizeSingleBattleSet } from '../utils/SingleBattleSetOptimizer';
import { FormatCandidateScoreParams } from './FormatSolver';

export class VanillaSolver extends BaseFormatSolver {
  public readonly mode = 'vanilla' as const;
  public readonly id = 'vanilla-solver';
  public readonly label = 'Vanilla Adventure Solver';
  public readonly usesItemClause = false;
  public readonly usesFourOfSixModes = false;
  public readonly usesDoublesMechanicContracts = false;
  public readonly usesSinglesFieldControlContracts = false;
  public readonly usesBossGauntlet = false;

  public override normalizePokemonSet(input: SetSourceInput): PokemonData {
    const neutral = super.normalizePokemonSet({
      ...input,
      savedSet: null,
      defaultKit: null,
      preferCurated: false,
    });
    return optimizeSingleBattleSet(neutral, input.format, 'vanilla');
  }

  public override adjustCandidateScore(params: FormatCandidateScoreParams): number {
    const { baseTeam, candidate, format, reasons } = params;
    const baseTypes = new Set(baseTeam.flatMap(pokemon => getPokemonTypes(pokemon, format).map(type => type.toLowerCase())));
    const candidateTypes = getPokemonTypes(candidate, format).map(type => type.toLowerCase());
    let score = 0;

    for (const type of candidateTypes) {
      if (!baseTypes.has(type)) score += 10;
    }

    const coverageTypes = this.countNewCoverageTypes(baseTeam, candidate, format);
    score += coverageTypes * 4;

    const speed = Number(getVariant(candidate, format)?.baseStats?.spe ?? 0);
    if (speed >= 80) score += 8;

    reasons.push('Vanilla prioriza cobertura simples, baixo acúmulo de fraquezas e facilidade de uso.');
    return score;
  }

  private countNewCoverageTypes(baseTeam: PokemonData[], candidate: PokemonData, format: string): number {
    const baseCovered = new Set<string>();
    for (const teammate of baseTeam) {
      for (const type of getPokemonTypes(teammate, format)) {
        baseCovered.add(type.toLowerCase());
      }
    }

    let count = 0;
    for (const defendingType of Object.keys({
      normal: true, fire: true, water: true, electric: true, grass: true, ice: true,
      fighting: true, poison: true, ground: true, flying: true, psychic: true, bug: true,
      rock: true, ghost: true, dragon: true, dark: true, steel: true, fairy: true,
    })) {
      const hadAnswer = [...baseCovered].some(type => getDamageMultiplier([defendingType], type) >= 2);
      const candidateAddsAnswer = getPokemonTypes(candidate, format).some(type => getDamageMultiplier([defendingType], type) >= 2);
      if (!hadAnswer && candidateAddsAnswer) count++;
    }

    return count;
  }
}
