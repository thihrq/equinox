import { PokemonData } from '../core/AnalysisContext';
import { getSpeciesClauseKey, getPokemonTypes, getVariant } from '../utils/PokemonUtils';
import { enforceUniqueVgcHeldItems, isAbilityLegalForPokemon, isMegaOption, optimizeVgcSet } from '../utils/VgcSetOptimizer';
import { evaluateVgcArchetypeCompatibility, evaluateVgcSetQuality } from '../vgc/VgcArchetypeBlueprints';
import { evaluateVgcCandidateFit, evaluateVgcTeamPlan } from '../vgc/VgcTeamBuilding';
import { BaseFormatSolver } from './BaseFormatSolver';
import { FormatCandidateScoreParams, SetSourceInput } from './FormatSolver';
import { resolveFormatPlan } from './FormatPlanResolver';

export class ChampionsDoublesSolver extends BaseFormatSolver {
  public readonly mode = 'champions_doubles' as const;
  public readonly id = 'champions-doubles-solver';
  public readonly label = 'Pokémon Champions Doubles Solver';
  public readonly usesItemClause = true;
  public readonly usesFourOfSixModes = true;
  public readonly usesDoublesMechanicContracts = true;
  public readonly usesSinglesFieldControlContracts = false;
  public readonly usesBossGauntlet = false;

  public override normalizePokemonSet(input: SetSourceInput): PokemonData {
    return optimizeVgcSet(super.normalizePokemonSet(input), input.format, {
      preferCurated: input.preferCurated ?? true,
      formatPlan: input.formatPlan,
    });
  }

  public override normalizeFinalTeam(team: PokemonData[], format: string): PokemonData[] {
    return enforceUniqueVgcHeldItems(team, format);
  }

  public override getDiversityOptions() {
    return {
      maxCandidates: 28,
      topOverall: 18,
      perRole: 5,
      perType: 2,
      minCandidates: 22,
    };
  }

  public override adjustCandidateScore(params: FormatCandidateScoreParams): number {
    const { baseTeam, candidate, format, reasons, currentRoles } = params;
    const plan = resolveFormatPlan(baseTeam, format, this.mode);
    const optimized = this.normalizePokemonSet({ pokemon: candidate, format, preferCurated: true, formatPlan: plan });
    const fit = evaluateVgcCandidateFit(optimized, baseTeam, format);
    const setQuality = evaluateVgcSetQuality(optimized, format, fit.archetype.id);
    let score = Math.round(fit.score * 1.15 + setQuality.score * 0.35);

    for (const role of fit.roles) {
      if (!currentRoles.includes(role)) currentRoles.push(role);
    }

    if (setQuality.hardFailures.length) {
      score -= setQuality.hardFailures.length * 180;
      reasons.push('Set provável não sustenta a função Doubles atribuída.');
    } else if (setQuality.warnings.length) {
      score -= setQuality.warnings.length * 10;
    }

    if (fit.score !== 0) reasons.push(...fit.reasons.slice(0, 4));
    return score;
  }

  public override validateFinalTeam(team: PokemonData[], format: string) {
    const hardFailures: string[] = [];
    const warnings: string[] = [];
    const species = new Set(team.map(pokemon => getSpeciesClauseKey(pokemon.name)));
    if (species.size !== team.length) hardFailures.push('Species Clause violada.');
    if (team.filter(pokemon => isMegaOption(pokemon)).length > 1) hardFailures.push('Mais de uma opção Mega no time.');
    if (team.some(pokemon => !isAbilityLegalForPokemon(pokemon, format, pokemon.ability))) hardFailures.push('Habilidade ilegal no formato.');

    const items = team.map(pokemon => pokemon.item).filter(Boolean) as string[];
    if (new Set(items).size < items.length) hardFailures.push('Item Clause violada.');

    const plan = evaluateVgcTeamPlan(team, format);
    const compatibility = evaluateVgcArchetypeCompatibility(team, format, plan.archetype.id);
    hardFailures.push(...compatibility.hardFailures);
    warnings.push(...compatibility.warnings);

    return {
      valid: hardFailures.length === 0,
      hardFailures,
      warnings,
    };
  }

  protected override shouldForceProtect(): boolean {
    return true;
  }
}
