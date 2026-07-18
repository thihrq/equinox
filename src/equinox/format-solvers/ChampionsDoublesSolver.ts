import { PokemonData } from '../core/AnalysisContext';
import { getSpeciesClauseKey, getPokemonTypes, getVariant } from '../utils/PokemonUtils';
import { enforceUniqueVgcHeldItems, isAbilityLegalForPokemon, isMegaOption, optimizeVgcSet } from '../utils/VgcSetOptimizer';
import { evaluateVgcArchetypeCompatibility, evaluateVgcSetQuality, getMechanicSlotsForPokemon, VGC_ARCHETYPE_BLUEPRINTS } from '../vgc/VgcArchetypeBlueprints';
import type { VgcMechanicSlotId } from '../vgc/VgcArchetypeBlueprints';
import { evaluateVgcCandidateFit, inferVgcArchetype } from '../vgc/VgcTeamBuilding';
import { BaseFormatSolver } from './BaseFormatSolver';
import { FormatCandidateScoreParams, SetSourceInput } from './FormatSolver';
import { resolveFormatPlan } from './FormatPlanResolver';
import type { CandidateScoreResult } from '../recommendation/CandidateScoreEngine';
import type { CoverageRequirement } from '../recommendation/DiversityCandidateSelector';

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
      // Incidente real 2026-07-17: com maxCandidates=28/topOverall=18, o
      // bônus de pontuação de "abuser primário" (+260, muito acima de +105
      // para suporte e -95 para quem não fecha nenhum slot crítico — ver
      // FormatPlanResolver.ts) fazia o pool diversificado ficar dominado
      // por abusers para times com viés de clima. A regra de composição
      // permite no máximo 2 abusers primários no time final, então o pool
      // reduzido não sobrava candidatos de suporte/setter suficientes para
      // fechar nenhuma combinação válida — usuários reais recebiam zero
      // resultados. Elevado para dar espaço real a esses papéis; seguro
      // agora que CombinationSearchEngine tem orçamento de tempo próprio
      // (não depende mais deste teto para não travar o Render Free).
      maxCandidates: 45,
      topOverall: 24,
      perRole: 8,
      perType: 3,
      minCandidates: 30,
    };
  }

  // Slots de VgcMechanicSlotId sem NENHUM bucket equivalente em VgcRole --
  // groupByRole no DiversityCandidateSelector não tem como resgatar um
  // candidato que só carrega um desses. Terrain, proteção/setter/abuser de
  // Trick Room e recuperação secundária de clima. weather_setter_*,
  // weather_abuser_*_primary, tailwind_setter e premium_redirection ficam
  // FORA desta lista de propósito: já têm cobertura parcial via os buckets
  // genéricos 'Weather Setter'/'Weather Abuser'/'Speed Control'/'Redirection'
  // -- injetar candidatos extras para eles duplica a concentração desses
  // papéis no pool. Achado real 2026-07-18: com weather_abuser_sun_primary
  // incluído aqui, o pool de sun_offense ficou tão denso de abusers que
  // quase todo trio colidia com o teto de "no máximo 2 abusers primários"
  // (FormatPlanResolver.ts:386), e a busca combinatória estourava o
  // orçamento de tempo sem achar nenhuma combinação válida -- resultado
  // real: possible=9139, valid=0. Times sem esse teto (Trick Room/Terrain)
  // não sofrem esse efeito colateral, por isso a injeção continua segura
  // para eles.
  private static readonly ZERO_ROLE_COVERAGE_SLOTS = new Set<VgcMechanicSlotId>([
    'terrain_setter_psychic',
    'terrain_abuser_psychic',
    'terrain_setter_any',
    'terrain_abuser_any',
    'trick_room_setter',
    'trick_room_abuser',
    'trick_room_protection',
    'weather_control_secondary',
  ]);

  public override getMandatoryMechanicCoverage(baseTeam: PokemonData[], format: string): CoverageRequirement[] {
    const archetype = inferVgcArchetype(baseTeam, format);
    const blueprint = VGC_ARCHETYPE_BLUEPRINTS[archetype.id];
    const criticalSlots = blueprint.critical.filter(
      requirement => requirement.critical && ChampionsDoublesSolver.ZERO_ROLE_COVERAGE_SLOTS.has(requirement.id),
    );

    return criticalSlots.map(requirement => ({
      id: `mechanic:${requirement.id}`,
      perRequirement: 3,
      matches: (candidate: CandidateScoreResult) =>
        getMechanicSlotsForPokemon(candidate.pokemon, format).has(requirement.id),
    }));
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

    // validateFinalTeam só precisa do archetype.id para checar
    // compatibilidade -- evaluateVgcTeamPlan (usada em outros lugares para
    // exibir análise completa ao usuário) também computa roleCoverage,
    // mechanicCoverage, modeAnalysis, matchupReadiness, recommendations,
    // concerns e teamInsights, tudo descartado aqui. Medido em produção
    // (2026-07-17): ~322ms por chamada, e esta função roda milhares de
    // vezes por requisição dentro do pré-filtro combinatório de
    // CombinationSearchEngine -- era o gargalo real por trás do orçamento
    // de tempo estourar sem nunca achar um trio válido. archetype.id vem
    // de inferVgcArchetype(team, format), chamada como primeiro passo
    // dentro de evaluateVgcTeamPlan e usada sem modificação -- chamar
    // direto é comportamentalmente idêntico, só sem o trabalho descartado.
    const archetype = inferVgcArchetype(team, format);
    const compatibility = evaluateVgcArchetypeCompatibility(team, format, archetype.id);
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
