// src/services/LeadStrategyRecommendationService.ts
// Orquestrador do pipeline Build-Around-Lead para Champions Doubles

import { PokemonService } from './PokemonService';
import { Pokemon } from '../models/Pokemon';
import { PokemonSet } from '../models/PokemonSet';
import { generateBasicKit, getMegaBaseName, getMegaStone, getSpeciesClauseKey, getPokemonTypes } from '../equinox/utils/PokemonUtils';
import { CompetitiveKitGenerator } from '../equinox/utils/CompetitiveKitGenerator';
import { PokemonData } from '../equinox/core/AnalysisContext';
import { CandidateSelector } from '../equinox/recommendation/CandidateSelector';
import { CandidateScoreEngine, type TeamIdentity } from '../equinox/recommendation/CandidateScoreEngine';
import { DiversityCandidateSelector } from '../equinox/recommendation/DiversityCandidateSelector';
import { FormatSolverRegistry } from '../equinox/format-solvers/FormatSolverRegistry';
import { resolveFormatPlan } from '../equinox/format-solvers/FormatPlanResolver';
import { FormatPerformanceProfileRegistry } from '../equinox/performance/FormatPerformanceProfile';
import { FormatLegalityRules } from '../equinox/recommendation/FormatLegalityRules';
import { appConfig } from '../config/env';

import type {
  SuggestFromLeadRequest,
  LeadSuggestionResult,
  LeadStrategyResult,
  LeadCapabilityProfile,
  LeadStrategyCandidate,
  LeadCompletionResult,
  LeadCompletionSearchInput,
} from '../equinox/vgc/LeadBuildTypes';

import { analyzeLeadCapabilities } from '../equinox/vgc/LeadCapabilityAnalyzer';
import { generateLeadStrategies } from '../equinox/vgc/LeadStrategyGenerator';
import { searchLeadCompletions } from '../equinox/vgc/LeadCompletionSearch';
import { evaluateFullTeam } from '../equinox/vgc/FullTeamEvaluator';
import { evaluateLeadLockedQuartets } from '../equinox/vgc/LeadLockedQuartetEvaluator';
import { generateLeadPlaybook } from '../equinox/vgc/LeadPlaybookGenerator';
import { TeamSuggestionInputError } from './TeamService';
import { validateCompetitiveTeam } from '../equinox/competitive/CompetitiveTeamLegalityValidator';
import { CompetitivePokemonSet, withCompetitiveSet } from '../equinox/competitive/CompetitivePokemonSet';
import { calculateTeamDataCoverage } from '../equinox/competitive/TeamDataCoverage';
import { compareLegacyAndV2Sets } from '../equinox/competitive/CompetitiveSetShadowComparator';
import pilotCompetitiveSets from '../equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json';
import { enforceUniqueVgcHeldItems } from '../equinox/utils/VgcSetOptimizer';
import { CompetitiveSetValidationInput } from '../equinox/data-validation/CompetitiveValidationTypes';

// ─── Service ──────────────────────────────────────────────────────────────────

export class LeadStrategyRecommendationService {
  private readonly formatSolverRegistry = new FormatSolverRegistry();
  private readonly formatLegalityRules = new FormatLegalityRules();

  public async execute(input: SuggestFromLeadRequest): Promise<any> {
    console.time('LeadBuildTotal');
    const { lead, format, allowLegendaries, teamIdentity } = input;

    // 1. Resolver formato
    const formatSolver = this.formatSolverRegistry.getSolver(format);
    if (formatSolver.mode !== 'champions_doubles') {
      throw new TeamSuggestionInputError(
        'FORMAT_RULE_INCOMPATIBLE',
        'O modo Build-Around-Lead está disponível apenas para Champions Doubles.',
        { format },
      );
    }

    console.log(`[LeadBuild] Iniciando pipeline para ${lead[0].name} + ${lead[1].name} | format=${format}`);

    // 2. Hidratar Pokémon da lead
    console.time('LeadHydrate');
    const hydratedLead = await this.hydrateLeadPokemon(lead, format, formatSolver);
    console.timeEnd('LeadHydrate');

    // 3. Verificar legalidade da lead
    for (const pokemon of hydratedLead) {
      if (!this.formatLegalityRules.isEligible({ pokemon, format })) {
        throw new TeamSuggestionInputError(
          'FORMAT_RULE_INCOMPATIBLE',
          `${pokemon.name} não é compatível com as regras de ${format}.`,
          { pokemonNames: [pokemon.name], format },
        );
      }
    }

    // 4. Analisar capacidades da lead
    console.time('LeadAnalysis');
    const leadProfile = analyzeLeadCapabilities(hydratedLead[0], hydratedLead[1], format);
    console.timeEnd('LeadAnalysis');

    console.log(`[LeadBuild] Perfil: weather=${leadProfile.weather.map(w => w.family).join(',')} speedControl=${leadProfile.speedControl.map(s => s.type).join(',')}`);

    // 5. Gerar estratégias
    console.time('StrategyGeneration');
    const strategies = generateLeadStrategies(hydratedLead as [PokemonData, PokemonData], leadProfile, format);
    console.timeEnd('StrategyGeneration');

    console.log(`[LeadBuild] Estratégias geradas: ${strategies.length} → ${strategies.map(s => s.id).join(', ')}`);

    if (strategies.length === 0) {
      console.timeEnd('LeadBuildTotal');
      return {
        lead: [hydratedLead[0].name, hydratedLead[1].name],
        leadProfile,
        strategies: [],
        bestOverallTeam: hydratedLead,
        warnings: ['Nenhuma estratégia viável identificada para esta lead.'],
      };
    }

    // 6. Buscar candidatos (reutiliza infraestrutura existente)
    console.time('CandidateFetch');
    const candidates = await this.fetchAndScoreCandidates(
      hydratedLead,
      format,
      allowLegendaries,
      teamIdentity as TeamIdentity,
      formatSolver,
    );
    console.timeEnd('CandidateFetch');

    console.log(`[LeadBuild] Candidatos disponíveis: ${candidates.length}`);

    if (candidates.length < 4) {
      console.timeEnd('LeadBuildTotal');
      return {
        lead: [hydratedLead[0].name, hydratedLead[1].name],
        leadProfile,
        strategies: [],
        bestOverallTeam: hydratedLead,
        warnings: ['Candidatos insuficientes para completar o time (mínimo 4 necessários).'],
      };
    }

    // 7. Para cada estratégia, completar time, avaliar e gerar playbook
    console.time('StrategyPipeline');
    const strategyResults: LeadStrategyResult[] = [];

    for (const strategy of strategies.slice(0, 5)) { // Máximo de 5 estratégias
      try {
        const result = await this.processStrategy(
          strategy,
          hydratedLead as [PokemonData, PokemonData],
          candidates,
          format,
        );
        if (result) {
          strategyResults.push(result);
        }
      } catch (error) {
        console.warn(`[LeadBuild] Falha ao processar estratégia ${strategy.id}:`, error);
      }
    }
    console.timeEnd('StrategyPipeline');

    strategyResults.sort((a, b) => b.teamEvaluation.overallScore - a.teamEvaluation.overallScore);

    const bestOverallTeam = strategyResults[0]?.completions[0]?.fullTeam ?? hydratedLead;
    const dataCoverage = calculateTeamDataCoverage(bestOverallTeam);
    const warnings = strategyResults.flatMap(result => [
      ...result.teamEvaluation.warnings,
      ...(result.dataCoverage?.notes ?? []),
      ...result.quartets.flatMap(quartet => [
        ...quartet.assessment.warnings.map(issue => issue.message),
        ...quartet.assessment.matchupRisks.map(issue => issue.message),
      ]),
    ]);

    const response: LeadSuggestionResult = {
      lead: [hydratedLead[0].name, hydratedLead[1].name],
      leadProfile,
      strategies: strategyResults,
      bestOverallTeam,
      dataCoverage,
      warnings: [...new Set(warnings)].slice(0, 12),
    };

    console.log(`[LeadBuild] Resultados: ${response.strategies.length} estratégias nativas processadas com sucesso`);
    console.timeEnd('LeadBuildTotal');

    return response;
  }

  // ─── Pipeline de Processamento por Estratégia ──────────────────────────────

  private async processStrategy(
    strategy: LeadStrategyCandidate,
    lead: [PokemonData, PokemonData],
    candidates: PokemonData[],
    format: string,
  ): Promise<LeadStrategyResult | null> {
    // Busca em feixe para completar o time
    const completionInput: LeadCompletionSearchInput = {
      lead,
      strategy,
      candidates,
      maxCandidatesPerStage: 40,
      format,
    };

    const completions = searchLeadCompletions(completionInput);

    if (completions.length === 0) {
      console.warn(`[LeadBuild] Estratégia ${strategy.id}: nenhum time completo encontrado`);
      return null;
    }

    const evaluatedCompletions = completions
      .map(completion => {
        const fullTeam = this.resolveCompetitiveTeam(completion.fullTeam, format);
        const legality = validateCompetitiveTeam(fullTeam, format);
        const evaluation = evaluateFullTeam(fullTeam, strategy, format);
        const dataCoverage = calculateTeamDataCoverage(fullTeam);
        return {
          completion: {
            ...completion,
            fullTeam,
            dataCoverage,
            fullTeamScore: Math.min(
              this.calculateFinalCompletionScore(completion.fullTeamScore, evaluation, legality.legal),
              dataCoverage.competitiveIndexCap,
            ),
          },
          legality,
          evaluation,
          dataCoverage,
        };
      })
      .filter(result =>
        result.legality.legal &&
        result.evaluation.strategyComplete &&
        result.evaluation.overallScore >= 60 &&
        result.evaluation.roleCoverageScore >= 55 &&
        result.evaluation.offensiveBalanceScore >= 45,
      )
      .sort((a, b) => b.completion.fullTeamScore - a.completion.fullTeamScore);

    if (evaluatedCompletions.length === 0) {
      const diagnostic = completions
        .map(completion => {
          const fullTeam = this.resolveCompetitiveTeam(completion.fullTeam, format);
          const legality = validateCompetitiveTeam(fullTeam, format);
          const evaluation = evaluateFullTeam(fullTeam, strategy, format);
          return {
            legal: legality.legal,
            strategyComplete: evaluation.strategyComplete,
            overallScore: evaluation.overallScore,
            roleCoverageScore: evaluation.roleCoverageScore,
            offensiveBalanceScore: evaluation.offensiveBalanceScore,
            firstIssue: legality.issues[0]?.message,
          };
        })
        .sort((a, b) => b.overallScore - a.overallScore)[0];
      console.warn(`[LeadBuild] EstratÃ©gia ${strategy.id}: nenhuma composiÃ§Ã£o competitivamente consistente`, diagnostic);
      return null;
    }

    const bestCompletion = evaluatedCompletions[0].completion;
    const teamEvaluation = evaluatedCompletions[0].evaluation;
    const dataCoverage = evaluatedCompletions[0].dataCoverage;

    // Avaliar quartetos com lead travada
    const quartets = evaluateLeadLockedQuartets({
      fullTeam: bestCompletion.fullTeam,
      lead,
      strategy,
      format,
    });

    // Gerar playbooks para cada quarteto válido
    const playbooks = quartets
      .filter(q => q.contractValid)
      .slice(0, 6) // Máximo de 6 playbooks (todas as backlines)
      .map(quartet => generateLeadPlaybook({
        quartet,
        strategy,
        fullTeam: bestCompletion.fullTeam,
        format,
      }));

    return {
      strategy,
      completions: evaluatedCompletions.map(result => result.completion).slice(0, 3), // Top 3 completions
      quartets,
      playbooks,
      teamEvaluation,
      dataCoverage,
    };
  }

  private resolveCompetitiveTeam(team: PokemonData[], format: string): PokemonData[] {
    const generatedSets = team.map(member => withCompetitiveSet(member, format, member.competitiveSet?.setSource ?? 'generated'));
    const shadowSets = this.applyV2ShadowSetSelection(generatedSets, format);
    return enforceUniqueVgcHeldItems(shadowSets, format)
      .map(member => {
        if (!member.competitiveSet) return withCompetitiveSet(member, format, 'generated');
        if (member.item !== member.competitiveSet.item) {
          return {
            ...member,
            competitiveSet: {
              ...member.competitiveSet,
              item: member.item ?? member.competitiveSet.item,
            },
          };
        }
        return member;
      });
  }

  private applyV2ShadowSetSelection(team: PokemonData[], format: string): PokemonData[] {
    if (!appConfig.useCompetitiveSetsV2 || format !== 'champions_reg_m_b_doubles') {
      return team;
    }

    return team.map(member => {
      const requiredRole = inferRequiredRole(member);
      const v2Set = findPilotSetForPokemon(member, requiredRole);
      if (!v2Set) return member;

      const comparison = compareLegacyAndV2Sets({
        legacySets: member.competitiveSet ? [competitiveSetToValidationInput(member, format)] : [],
        v2Sets: [v2Set],
      })[0];

      console.log(
        `[SET SELECTION SHADOW] pokemon=${member.name} requiredRole=${requiredRole} legacySet=${member.competitiveSet?.setId ?? member.competitiveSet?.setSource ?? 'none'} v2Set=${v2Set.setId} preferred=${comparison.preferred} writes=0 reasons=${comparison.reasons.join(' | ')}`,
      );

      if (comparison.preferred !== 'v2') return member;

      const competitiveSet = pilotSetToCompetitivePokemonSet(member, v2Set);
      return {
        ...member,
        ability: competitiveSet.ability,
        item: competitiveSet.item,
        nature: competitiveSet.nature,
        moves: competitiveSet.moves,
        role: competitiveSet.role ?? member.role,
        competitiveSet,
      };
    });
  }

  private calculateFinalCompletionScore(
    searchScore: number,
    evaluation: ReturnType<typeof evaluateFullTeam>,
    legal: boolean,
  ): number {
    if (!legal) return 0;
    return Math.round(
      evaluation.overallScore * 0.35 +
      evaluation.roleCoverageScore * 0.25 +
      100 * 0.15 +
      evaluation.offensiveBalanceScore * 0.15 +
      evaluation.matchupFlexibilityScore * 0.10 +
      Math.min(5, searchScore / 100),
    );
  }

  // ─── Hidratação da Lead ────────────────────────────────────────────────────

  private async hydrateLeadPokemon(
    leadInputs: SuggestFromLeadRequest['lead'],
    format: string,
    formatSolver: ReturnType<FormatSolverRegistry['getSolver']>,
  ): Promise<PokemonData[]> {
    const result: PokemonData[] = [];

    for (const input of leadInputs) {
      const pokemon = await PokemonService.getPokemonByName(input.name, format);
      if (!pokemon) {
        throw new TeamSuggestionInputError(
          'POKEMON_NOT_FOUND',
          `Pokémon não encontrado: ${input.name}.`,
          { pokemonNames: [input.name] },
        );
      }

      const baseName = getMegaBaseName(pokemon.name);
      let set = await PokemonSet.findOne({ pokemonName: pokemon.name, formatId: format }).lean();
      if (!set && baseName !== pokemon.name) {
        set = await PokemonSet.findOne({ pokemonName: baseName, formatId: format }).lean();
      }
      if (!set) {
        set = await PokemonSet.findOne({ pokemonName: pokemon.name }).lean();
      }
      if (!set && baseName !== pokemon.name) {
        set = await PokemonSet.findOne({ pokemonName: baseName }).lean();
      }

      const defaultKit = set || !formatSolver.usesDoublesMechanicContracts
        ? null
        : CompetitiveKitGenerator.generate(pokemon, format);
      const basicKit = generateBasicKit(pokemon, format);
      const megaStone = getMegaStone(pokemon.name);

      const resolved = formatSolver.normalizePokemonSet({
        pokemon: {
          ...pokemon,
          ability: input.ability || pokemon.ability || set?.ability || defaultKit?.ability,
          item: megaStone || input.item || pokemon.item || set?.item || defaultKit?.item,
          moves: (input.moves && input.moves.length > 0)
            ? input.moves
            : (pokemon.moves && pokemon.moves.length > 0 ? pokemon.moves : (set?.moves || defaultKit?.moves)),
          nature: input.nature || pokemon.nature || set?.nature || basicKit.nature,
          role: pokemon.role || set?.role || basicKit.role,
        },
        format,
        savedSet: set,
        defaultKit,
        basicKit,
        preferCurated: true,
      });

      result.push(resolved);
    }

    return formatSolver.normalizeFinalTeam(result, format);
  }

  // ─── Busca e Score de Candidatos ───────────────────────────────────────────

  private async fetchAndScoreCandidates(
    baseTeam: PokemonData[],
    format: string,
    allowLegendaries: boolean,
    teamIdentity: TeamIdentity,
    formatSolver: ReturnType<FormatSolverRegistry['getSolver']>,
  ): Promise<PokemonData[]> {
    const currentMembers = baseTeam.map(p => p.name);
    const allCandidates = (await Pokemon.find({}).lean()) as unknown as PokemonData[];

    const performanceProfile = new FormatPerformanceProfileRegistry().getProfile(format);
    const candidateLimit = appConfig.runtimeProfile !== 'render_free' ? 300 : 42;

    const validCandidates = new CandidateSelector().select({
      allPokemon: allCandidates,
      currentMembers,
      format,
      allowLegendaries,
      limit: candidateLimit,
      baseTeam,
      formatSolverMode: formatSolver.mode,
    });

    const scoredCandidates = new CandidateScoreEngine().scoreCandidates({
      baseTeam,
      candidates: validCandidates,
      format,
      teamIdentity,
      formatSolver,
    });

    const diversifiedResults = new DiversityCandidateSelector().select(
      scoredCandidates,
      formatSolver.getDiversityOptions(),
      formatSolver.getMandatoryMechanicCoverage(baseTeam, format),
    );

    const diversifiedCandidates = diversifiedResults.map(r => r.pokemon);
    const lockedFormatPlan = resolveFormatPlan(baseTeam, format, formatSolver.mode);

    // Hidratar candidatos com sets competitivos
    const candidateNames = diversifiedCandidates.map(c => c.name);
    const candidateSetNames = [...new Set([
      ...candidateNames,
      ...candidateNames.map(name => getMegaBaseName(name)),
    ])];
    const candidateSets = await PokemonSet.find({
      pokemonName: { $in: candidateSetNames },
    }).lean();

    const finalCandidates: PokemonData[] = [];
    for (const candidate of diversifiedCandidates) {
      const baseCandidateName = getMegaBaseName(candidate.name);
      let sets = candidateSets.filter(s => s.pokemonName === candidate.name && s.formatId === format);
      if (sets.length === 0 && baseCandidateName !== candidate.name) {
        sets = candidateSets.filter(s => s.pokemonName === baseCandidateName && s.formatId === format);
      }
      if (sets.length === 0) {
        sets = candidateSets.filter(s => s.pokemonName === candidate.name);
      }
      if (sets.length === 0 && baseCandidateName !== candidate.name) {
        sets = candidateSets.filter(s => s.pokemonName === baseCandidateName);
      }

      const megaStone = getMegaStone(candidate.name);
      if (sets.length > 0) {
        const bestSet = sets[0];
        finalCandidates.push(formatSolver.normalizePokemonSet({
          pokemon: {
            ...candidate,
            ability: bestSet.ability,
            item: megaStone ?? bestSet.item,
            moves: bestSet.moves,
            nature: bestSet.nature,
            role: bestSet.role,
          },
          format,
          savedSet: bestSet,
          preferCurated: true,
          formatPlan: lockedFormatPlan,
        }));
      } else {
        const defaultKit = formatSolver.usesDoublesMechanicContracts
          ? CompetitiveKitGenerator.generate(candidate, format)
          : null;
        const basicKit = generateBasicKit(candidate, format);
        finalCandidates.push(formatSolver.normalizePokemonSet({
          pokemon: {
            ...candidate,
            ability: defaultKit?.ability,
            item: megaStone ?? defaultKit?.item,
            moves: defaultKit?.moves,
            nature: basicKit.nature,
            role: basicKit.role,
          },
          format,
          defaultKit,
          basicKit,
          preferCurated: true,
          formatPlan: lockedFormatPlan,
        }));
      }
    }

    // Deduplicar por Species Clause
    const selected = new Map<string, PokemonData>();
    for (const candidate of finalCandidates) {
      const key = getSpeciesClauseKey(candidate.name);
      if (!selected.has(key)) {
        selected.set(key, candidate);
      }
    }

    return [...selected.values()];
  }
}

type PilotCompetitiveSet = CompetitiveSetValidationInput & {
  setId: string;
  pokemonName: string;
  item: string;
  ability: string;
  nature: string;
  evs: Required<NonNullable<CompetitiveSetValidationInput['evs']>>;
  ivs: Required<NonNullable<CompetitiveSetValidationInput['ivs']>>;
  moves: [string, string, string, string] | string[];
};

const PILOT_SETS = (pilotCompetitiveSets as { sets: PilotCompetitiveSet[] }).sets;

function normalizeId(value?: string): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function inferRequiredRole(member: PokemonData): string {
  const role = String(member.role ?? member.competitiveSet?.role ?? '').toLowerCase();
  if (role.includes('trick room')) return 'trick-room-setter';
  if (role.includes('redirection')) return 'redirection-support';
  if (role.includes('fake out')) return 'fake-out-control';
  if (role.includes('body press') || role.includes('physical wall')) return 'physical-wall';
  if (role.includes('special wall')) return 'special-wall';
  if (role.includes('special')) return 'slow-special-breaker';
  if (role.includes('slow') || role.includes('physical')) return 'slow-physical-breaker';
  return member.competitiveSet?.role ?? 'bulky-pivot';
}

function findPilotSetForPokemon(member: PokemonData, requiredRole: string): PilotCompetitiveSet | undefined {
  const memberId = normalizeId(member.name);
  const baseId = normalizeId(getMegaBaseName(member.name));
  const speciesMatches = PILOT_SETS.filter(set => {
    const setName = normalizeId(set.pokemonName);
    const setForm = normalizeId(set.formId);
    const setPokemon = normalizeId(set.pokemonId);
    return setName === memberId || setForm === memberId || setPokemon === memberId || setPokemon === baseId;
  });

  return speciesMatches.find(set => set.primaryRole === requiredRole || set.secondaryRoles?.includes(requiredRole)) ??
    speciesMatches[0];
}

function pilotSetToCompetitivePokemonSet(member: PokemonData, set: PilotCompetitiveSet): CompetitivePokemonSet {
  const source = set.status === 'verified' || set.status === 'active'
    ? 'v2-verified'
    : set.status === 'reviewed'
      ? 'v2-reviewed'
      : 'v2-draft';
  return {
    name: set.pokemonName,
    types: member.types ?? [],
    item: set.item,
    ability: set.ability,
    nature: set.nature,
    evs: {
      hp: Number(set.evs.hp ?? 0),
      atk: Number(set.evs.atk ?? 0),
      def: Number(set.evs.def ?? 0),
      spa: Number(set.evs.spa ?? 0),
      spd: Number(set.evs.spd ?? 0),
      spe: Number(set.evs.spe ?? 0),
    },
    ivs: {
      hp: Number(set.ivs.hp ?? 31),
      atk: Number(set.ivs.atk ?? 31),
      def: Number(set.ivs.def ?? 31),
      spa: Number(set.ivs.spa ?? 31),
      spd: Number(set.ivs.spd ?? 31),
      spe: Number(set.ivs.spe ?? 31),
    },
    moves: set.moves.slice(0, 4) as [string, string, string, string],
    role: set.primaryRole,
    level: 50,
    setId: set.setId,
    confidence: set.confidence,
    status: set.status,
    sourceType: set.sourceType,
    setSource: source,
    validation: { legal: set.legal !== false, errors: [], warnings: [] },
  };
}

function competitiveSetToValidationInput(member: PokemonData, format: string): CompetitiveSetValidationInput {
  const set = member.competitiveSet;
  return {
    pokemonName: member.name,
    formatId: format,
    regulationId: format,
    battleStyle: 'doubles',
    setId: set?.setId,
    setName: set?.role ?? set?.setSource ?? 'legacy',
    item: set?.item,
    ability: set?.ability,
    nature: set?.nature,
    evs: set?.evs,
    ivs: set?.ivs,
    moves: set?.moves,
    primaryRole: set?.role,
    sourceType: set?.setSource,
    confidence: set?.confidence,
    legal: set?.validation.legal,
    status: set?.status === 'draft' || set?.status === 'active' || set?.status === 'quarantined' || set?.status === 'deprecated'
      ? set.status
      : undefined,
    coherenceScore: set?.setSource === 'generated' ? 45 : 60,
  };
}
