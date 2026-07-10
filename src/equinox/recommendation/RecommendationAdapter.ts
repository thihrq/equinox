import { TYPE_CHART } from '../../utils/TypeChart';
import { EvaluatedCombination } from './CombinationSearchEngine';
import { PokemonData } from '../core/AnalysisContext';
import { getDamageMultiplier } from '../utils/DamageMultiplier';
import { generateBasicKit, getPokemonTypes, getSpeciesClauseKey, getVariant } from '../utils/PokemonUtils';
import { isMegaOption } from '../utils/VgcSetOptimizer';
import {
  hasActiveRainSetterForVgc,
  hasActiveSunSetterForVgc,
  hasPrimaryRainAbuserForVgc,
  hasPrimarySunAbuserForVgc,
  inferVgcRoles,
  isLikelyRedirectionSupportForVgc,
  isLikelyTrickRoomAbuserForVgc,
  isLikelyTrickRoomSetterForVgc,
  isPremiumTrickRoomRedirectionForVgc,
} from '../vgc/VgcTeamBuilding';
import { evaluateVgcArchetypeCompatibility, evaluateVgcSetQuality } from '../vgc/VgcArchetypeBlueprints';

export interface CandidateDiversityInsight {
  name: string;
  score: number;
  roles: string[];
  types: string[];
  reasons: string[];
}

export interface CandidateDiversitySummary {
  rawCandidates: number;
  validCandidates: number;
  scoredCandidates: number;
  diversifiedCandidates: number;
  topCandidates: CandidateDiversityInsight[];
}

export interface BattleInsight {
  practicalRole: string;
  offers: string[];
  pressures: string[];
  risks: string[];
  usageTip: string;
}

type StrategySlot = 'recommended' | 'offensive' | 'defensive' | 'antiMeta' | 'creative';

export class RecommendationAdapter {
  public toLegacyResponse(
    combinations: EvaluatedCombination[],
    format: string,
    candidateDiversity?: CandidateDiversitySummary,
  ) {
    const selectedCombinations = this.selectStrategyOptions(combinations, format);

    return {
      topTeams: selectedCombinations.map((combination, index) =>
        this.formatOption(combination, format, index),
      ),
      candidateDiversity,
    };
  }

  private selectStrategyOptions(
    combinations: EvaluatedCombination[],
    format: string,
  ): EvaluatedCombination[] {
    const valid = combinations.filter(combination =>
      combination.context.selectedPokemon.filter(pokemon => isMegaOption(pokemon)).length <= 1,
    );

    const unique = this.dedupeCombinations(valid);
    const slots: StrategySlot[] = ['recommended', 'offensive', 'defensive', 'antiMeta', 'creative'];
    const selected: EvaluatedCombination[] = [];
    const selectedSignatures = new Set<string>();

    for (const slot of slots) {
      const candidate = this.pickBestForSlot({
        combinations: unique,
        selected,
        selectedSignatures,
        slot,
        format,
      });

      if (!candidate) continue;

      selected.push(candidate);
      selectedSignatures.add(this.getTeamSignature(candidate.team));
    }

    for (const combination of unique) {
      if (selected.length >= 5) break;
      const signature = this.getTeamSignature(combination.team);
      if (selectedSignatures.has(signature)) continue;

      selected.push(combination);
      selectedSignatures.add(signature);
    }

    return selected.slice(0, 5);
  }

  private dedupeCombinations(combinations: EvaluatedCombination[]): EvaluatedCombination[] {
    const selected = new Map<string, EvaluatedCombination>();

    for (const combination of combinations) {
      const signature = this.getTeamSignature(combination.team);
      if (!selected.has(signature)) {
        selected.set(signature, combination);
      }
    }

    return [...selected.values()];
  }

  private pickBestForSlot(params: {
    combinations: EvaluatedCombination[];
    selected: EvaluatedCombination[];
    selectedSignatures: Set<string>;
    slot: StrategySlot;
    format: string;
  }): EvaluatedCombination | null {
    const { combinations, selected, selectedSignatures, slot, format } = params;
    let best: EvaluatedCombination | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const combination of combinations) {
      const signature = this.getTeamSignature(combination.team);
      if (selectedSignatures.has(signature)) continue;

      const score = this.scoreStrategySlot(combination, selected, slot, format);
      if (score > bestScore) {
        best = combination;
        bestScore = score;
      }
    }

    return best;
  }

  private scoreStrategySlot(
    combination: EvaluatedCombination,
    selected: EvaluatedCombination[],
    slot: StrategySlot,
    format: string,
  ): number {
    const fullTeam = combination.context.selectedPokemon;
    const suggested = combination.team;
    const baseScore = Number(combination.context.score.total ?? 0);
    const vgcScore = Number(combination.context.analysis.vgcTeamPlan?.score ?? 0);
    const roles = suggested.flatMap(pokemon => inferVgcRoles(pokemon, format));
    const roleSet = new Set(roles);
    const suggestedNames = suggested.map(pokemon => getSpeciesClauseKey(pokemon.name));
    const alreadySelectedNames = new Set(
      selected.flatMap(previous => previous.team.map(pokemon => getSpeciesClauseKey(pokemon.name))),
    );
    const newSuggested = suggested.filter(pokemon => !alreadySelectedNames.has(getSpeciesClauseKey(pokemon.name)));

    const averageOffense = this.averageStat(suggested, format, pokemon => {
      const stats = getVariant(pokemon, format)?.baseStats;
      return Math.max(Number(stats?.atk ?? 0), Number(stats?.spa ?? 0));
    });
    const averageBulk = this.averageStat(suggested, format, pokemon => {
      const stats = getVariant(pokemon, format)?.baseStats;
      return Number(stats?.hp ?? 0) + Number(stats?.def ?? 0) + Number(stats?.spd ?? 0);
    });
    const averageSpeed = this.averageStat(suggested, format, pokemon => Number(getVariant(pokemon, format)?.baseStats?.spe ?? 0));
    const isSunOffense = combination.context.analysis.vgcTeamPlan?.archetype.id === 'sun_offense' ||
      fullTeam.some(pokemon => hasActiveSunSetterForVgc(pokemon, format));
    const hasVenusaur = fullTeam.some(pokemon => /venusaur/i.test(pokemon.name));
    const hasLifeOrbSuggested = suggested.some(pokemon => /life orb/i.test(String(pokemon.item ?? '')));
    const archetypeId = combination.context.analysis.vgcTeamPlan?.archetype.id ?? '';
    const architectureCompatibility = archetypeId
      ? evaluateVgcArchetypeCompatibility(fullTeam, format, archetypeId as any)
      : { score: 0, warnings: [], hardFailures: [] };
    const isTrickRoomPlan = archetypeId.includes('trick_room');
    const isRainPlan = archetypeId === 'rain_offense' || archetypeId === 'rain_tailwind';
    const hasRainSetter = fullTeam.some(pokemon => hasActiveRainSetterForVgc(pokemon, format));
    const rainAbuserCount = fullTeam.filter(pokemon => hasPrimaryRainAbuserForVgc(pokemon, format)).length;
    const suggestedRainAbuserCount = suggested.filter(pokemon => hasPrimaryRainAbuserForVgc(pokemon, format)).length;
    const suggestedOffPlanFireCount = suggested.filter(pokemon => {
      const types = getPokemonTypes(pokemon, format).map(type => type.toLowerCase());
      const roles = inferVgcRoles(pokemon, format);
      return types.includes('fire') && !roles.includes('Redirection') && !roles.includes('Turn Control');
    }).length;
    const setQuality = archetypeId
      ? suggested.map(pokemon => evaluateVgcSetQuality(pokemon, format, archetypeId as any))
      : [];
    const setQualityScore = setQuality.reduce((sum, quality) => sum + quality.score, 0);
    const setQualityFailures = setQuality.reduce((sum, quality) => sum + quality.hardFailures.length, 0);
    const setQualityWarnings = setQuality.reduce((sum, quality) => sum + quality.warnings.length, 0);
    const hasPremiumTrickRoomRedirection = fullTeam.some(pokemon => isPremiumTrickRoomRedirectionForVgc(pokemon));
    const hasAnyRedirection = fullTeam.some(pokemon => isLikelyRedirectionSupportForVgc(pokemon));
    const trickRoomSetterCount = fullTeam.filter(pokemon => isLikelyTrickRoomSetterForVgc(pokemon)).length;
    const trickRoomAbuserCount = fullTeam.filter(pokemon => isLikelyTrickRoomAbuserForVgc(pokemon, format)).length;
    const fastSuggestedCount = suggested.filter(pokemon => Number(getVariant(pokemon, format)?.baseStats?.spe ?? 0) >= 90).length;
    const disfavoredTrickRoomSuggested = suggested.some(pokemon => /volcarona|dragonite|salamence|gyarados/i.test(pokemon.name));

    let score = baseScore * 0.55 + vgcScore * 1.35 + architectureCompatibility.score * 0.55 + setQualityScore * 0.35;
    score -= architectureCompatibility.hardFailures.length * 160;
    score -= architectureCompatibility.warnings.length * 34;
    score -= setQualityFailures * 140;
    score -= setQualityWarnings * 16;

    if (isTrickRoomPlan) {
      if (hasPremiumTrickRoomRedirection) score += 140;
      else if (hasAnyRedirection) score += 45;
      else score -= 220;

      if (trickRoomSetterCount >= 2) score += 54;
      if (trickRoomAbuserCount >= 3) score += 42;
      if (fastSuggestedCount > 0 && !roleSet.has('Redirection')) score -= fastSuggestedCount * 42;
      if (disfavoredTrickRoomSuggested) score -= 85;
    }

    if (this.requiresRepeatedSunAbuser(fullTeam, suggested, format)) {
      score += 38;
    }

    if (isRainPlan && hasRainSetter) {
      score += rainAbuserCount >= 2 ? 54 : -70;
      score += suggestedRainAbuserCount * 38;
      score -= suggestedOffPlanFireCount * 44;
    }

    if (isSunOffense && hasVenusaur) {
      score += 16;
    } else if (isSunOffense && !hasVenusaur) {
      score -= 28;
    }

    switch (slot) {
      case 'recommended':
        score += vgcScore * 1.5;
        score -= Number(combination.context.analysis.vgcTeamPlan?.roleCoverage.missingCriticalRoles.length ?? 0) * 35;
        break;

      case 'offensive':
        score += averageOffense * 0.55;
        score += averageSpeed * 0.22;
        if (roleSet.has('Spread Damage')) score += 22;
        if (roleSet.has('Late Game Cleaner')) score += 18;
        if (roleSet.has('Priority')) score += 10;
        if (roleSet.has('Defensive Glue') && averageOffense < 105) score -= 16;
        if (isTrickRoomPlan && averageSpeed <= 65) score += 16;
        if (isTrickRoomPlan && roleSet.has('Speed Control') && !suggested.some(pokemon => isLikelyTrickRoomSetterForVgc(pokemon))) score -= 18;
        if (isTrickRoomPlan && suggested.some(pokemon => isLikelyTrickRoomAbuserForVgc(pokemon, format))) score += 34;
        if (isTrickRoomPlan && fastSuggestedCount > 0 && !roleSet.has('Redirection')) score -= 38;
        if (isRainPlan && suggestedRainAbuserCount > 0) score += 46;
        if (isRainPlan && suggestedRainAbuserCount === 0 && averageOffense < 120) score -= 52;
        if (this.hasReliableOffensiveSlot(newSuggested.length ? newSuggested : suggested, format, isTrickRoomPlan)) {
          score += 70;
        } else {
          score -= 140;
        }
        break;

      case 'defensive':
        score += averageBulk * 0.22;
        if (roleSet.has('Defensive Glue')) score += 24;
        if (roleSet.has('Redirection')) score += 34;
        if (roleSet.has('Pivot')) score += 18;
        if (roleSet.has('Turn Control')) score += 10;
        if (isTrickRoomPlan && suggested.some(pokemon => isPremiumTrickRoomRedirectionForVgc(pokemon))) score += 70;
        if (isSunOffense && hasVenusaur) score += 28;
        if (isSunOffense && !hasVenusaur) score -= 42;
        if (hasLifeOrbSuggested && !roleSet.has('Defensive Glue') && !roleSet.has('Redirection')) score -= 26;
        if (isRainPlan && suggestedRainAbuserCount > 0 && roleSet.has('Defensive Glue')) score += 16;
        if (this.hasDefensiveOrSupportSlot(newSuggested.length ? newSuggested : suggested, format, isTrickRoomPlan)) {
          score += 44;
        } else {
          score -= 82;
        }
        break;

      case 'antiMeta':
        if (roleSet.has('Anti Trick Room')) score += 28;
        if (roleSet.has('Anti Weather')) score += 18;
        if (roleSet.has('Speed Control')) score += 14;
        if (roleSet.has('Turn Control')) score += 12;
        if (roleSet.has('Priority')) score += 10;
        score += Number(combination.context.analysis.championsRegulation?.roleCoverage?.threatCoverage ?? 0) * 0.25;
        if (isTrickRoomPlan && suggested.some(pokemon => isLikelyTrickRoomSetterForVgc(pokemon))) score += 28;
        if (isTrickRoomPlan && suggested.some(pokemon => isPremiumTrickRoomRedirectionForVgc(pokemon))) score += 42;
        if (isTrickRoomPlan && disfavoredTrickRoomSuggested) score -= 64;
        if (isRainPlan && (suggestedRainAbuserCount > 0 || roleSet.has('Anti Weather') || roleSet.has('Speed Control'))) score += 24;
        if (this.hasAntiMetaSlot(newSuggested.length ? newSuggested : suggested, format, isTrickRoomPlan)) {
          score += 48;
        } else {
          score -= 92;
        }
        break;

      case 'creative':
        score += this.calculateNoveltyScore(suggested, selected, format);
        score += Math.max(0, 120 - averageOffense) * 0.08;
        if (setQualityWarnings === 0 && setQualityFailures === 0) score += 18;
        if (isSunOffense && hasVenusaur) score += 18;
        if (isSunOffense && !hasVenusaur) score -= 32;
        if (isTrickRoomPlan && suggested.some(pokemon => isPremiumTrickRoomRedirectionForVgc(pokemon))) score += 34;
        if (isTrickRoomPlan && disfavoredTrickRoomSuggested) score -= 54;
        if (isRainPlan && suggestedRainAbuserCount > 0) score += 22;
        if (this.hasArchetypeCompatibleNovelty(newSuggested.length ? newSuggested : suggested, format, isTrickRoomPlan)) {
          score += 36;
        } else {
          score -= 86;
        }
        break;
    }

    const overlapPenalty = selected.reduce((sum, previous) => {
      const previousNames = new Set(previous.team.map(pokemon => getSpeciesClauseKey(pokemon.name)));
      return sum + suggestedNames.filter(name => previousNames.has(name)).length * 24;
    }, 0);

    return score - overlapPenalty;
  }

  private hasReliableOffensiveSlot(team: PokemonData[], format: string, isTrickRoomPlan: boolean): boolean {
    return team.some(pokemon => {
      const stats = getVariant(pokemon, format)?.baseStats;
      const atk = Number(stats?.atk ?? 0);
      const spa = Number(stats?.spa ?? 0);
      const spe = Number(stats?.spe ?? 0);
      const roles = inferVgcRoles(pokemon, format);
      const moves = (pokemon.moves ?? []).map(move => String(move).toLowerCase().replace(/[^a-z0-9]/g, ''));
      const hasPressureMove = moves.some(move => [
        'eruption', 'waterspout', 'bloodmoon', 'facade', 'headlongrush', 'makeitrain',
        'expandingforce', 'heatwave', 'rockslide', 'gyroball', 'glaciallance', 'closecombat',
        'woodhammer', 'dracometeor', 'thunderclap', 'suckerpunch', 'firstimpression',
      ].includes(move));
      const hasOffensiveStats = Math.max(atk, spa) >= 110;
      const isTrickRoomCompatible = !isTrickRoomPlan || spe <= 75 || isLikelyTrickRoomAbuserForVgc(pokemon, format) || roles.includes('Priority');
      const isPureSupport = roles.includes('Redirection') || roles.includes('Defensive Glue') || roles.includes('Turn Control') && !hasOffensiveStats;
      return hasOffensiveStats && hasPressureMove && isTrickRoomCompatible && !isPureSupport;
    });
  }

  private hasDefensiveOrSupportSlot(team: PokemonData[], format: string, isTrickRoomPlan: boolean): boolean {
    return team.some(pokemon => {
      const roles = inferVgcRoles(pokemon, format);
      const moves = (pokemon.moves ?? []).map(move => String(move).toLowerCase().replace(/[^a-z0-9]/g, ''));
      const stats = getVariant(pokemon, format)?.baseStats;
      const bulk = Number(stats?.hp ?? 0) + Number(stats?.def ?? 0) + Number(stats?.spd ?? 0);
      return roles.includes('Redirection') ||
        roles.includes('Defensive Glue') ||
        roles.includes('Pivot') ||
        roles.includes('Turn Control') ||
        moves.some(move => ['followme', 'ragepowder', 'spore', 'willowisp', 'snarl', 'partingshot', 'wideguard', 'quickguard', 'helpinghand'].includes(move)) ||
        (isTrickRoomPlan && isPremiumTrickRoomRedirectionForVgc(pokemon)) ||
        bulk >= 285;
    });
  }

  private hasAntiMetaSlot(team: PokemonData[], format: string, isTrickRoomPlan: boolean): boolean {
    return team.some(pokemon => {
      const roles = inferVgcRoles(pokemon, format);
      const moves = (pokemon.moves ?? []).map(move => String(move).toLowerCase().replace(/[^a-z0-9]/g, ''));
      return roles.includes('Anti Trick Room') ||
        roles.includes('Anti Weather') ||
        roles.includes('Speed Control') ||
        roles.includes('Turn Control') ||
        roles.includes('Priority') ||
        moves.some(move => ['taunt', 'encore', 'imprison', 'haze', 'wideguard', 'quickguard', 'trickroom', 'willowisp', 'snarl', 'spore', 'fakeout'].includes(move)) ||
        (isTrickRoomPlan && (isLikelyTrickRoomSetterForVgc(pokemon) || isPremiumTrickRoomRedirectionForVgc(pokemon)));
    });
  }

  private hasArchetypeCompatibleNovelty(team: PokemonData[], format: string, isTrickRoomPlan: boolean): boolean {
    return team.some(pokemon => {
      const setQuality = evaluateVgcSetQuality(pokemon, format, isTrickRoomPlan ? 'hard_trick_room' as any : 'balance' as any);
      if (setQuality.hardFailures.length > 0) return false;
      if (!isTrickRoomPlan) return true;
      const speed = Number(getVariant(pokemon, format)?.baseStats?.spe ?? 0);
      return speed <= 75 ||
        isLikelyTrickRoomSetterForVgc(pokemon) ||
        isLikelyTrickRoomAbuserForVgc(pokemon, format) ||
        isLikelyRedirectionSupportForVgc(pokemon) ||
        inferVgcRoles(pokemon, format).some(role => ['Turn Control', 'Defensive Glue', 'Priority', 'Pivot'].includes(role));
    });
  }

  private requiresRepeatedSunAbuser(fullTeam: PokemonData[], suggested: PokemonData[], format: string): boolean {
    const suggestedKeys = new Set(suggested.map(pokemon => getSpeciesClauseKey(pokemon.name)));
    const baseTeam = fullTeam.filter(pokemon => !suggestedKeys.has(getSpeciesClauseKey(pokemon.name)));
    const baseHasSunSetter = baseTeam.some(pokemon => hasActiveSunSetterForVgc(pokemon, format));
    const baseHasPrimarySunAbuser = baseTeam.some(pokemon => hasPrimarySunAbuserForVgc(pokemon, format));

    return baseHasSunSetter &&
      !baseHasPrimarySunAbuser &&
      suggested.some(pokemon => hasPrimarySunAbuserForVgc(pokemon, format));
  }

  private calculateNoveltyScore(
    suggested: PokemonData[],
    selected: EvaluatedCombination[],
    format: string,
  ): number {
    const selectedKeys = new Set(
      selected.flatMap(combination => combination.team.map(pokemon => getSpeciesClauseKey(pokemon.name))),
    );

    const uniqueNew = suggested.filter(pokemon => !selectedKeys.has(getSpeciesClauseKey(pokemon.name))).length;
    const typeCount = new Set(suggested.flatMap(pokemon => getPokemonTypes(pokemon, format))).size;
    const unusualBonus = suggested.filter(pokemon => {
      const bst = this.calculateBst(pokemon, format);
      return bst > 0 && bst < 530;
    }).length;

    return uniqueNew * 24 + typeCount * 5 + unusualBonus * 8;
  }

  private averageStat(
    team: PokemonData[],
    format: string,
    selector: (pokemon: PokemonData) => number,
  ): number {
    if (!team.length) return 0;
    return team.reduce((sum, pokemon) => sum + selector(pokemon), 0) / team.length;
  }

  private calculateBst(pokemon: PokemonData, format: string): number {
    const stats = getVariant(pokemon, format)?.baseStats;
    return Number(stats?.hp ?? 0) +
      Number(stats?.atk ?? 0) +
      Number(stats?.def ?? 0) +
      Number(stats?.spa ?? 0) +
      Number(stats?.spd ?? 0) +
      Number(stats?.spe ?? 0);
  }

  private getTeamSignature(team: Array<{ name: string }>): string {
    return team
      .map(pokemon => getSpeciesClauseKey(pokemon.name))
      .sort()
      .join(',');
  }

  private formatOption(
    combination: EvaluatedCombination,
    format: string,
    index: number,
  ) {
    const { context } = combination;

    const reasoning =
      context.analysis.fatalUncovered === 0 &&
      context.analysis.normalUncovered === 0
        ? `Opção ${index + 1}: Perfeição Alcançada. Zero fraquezas fatais ou normais sem Switch-in ideal.`
        : `Opção ${index + 1}: Equilíbrio Estratégico. Restaram ${context.analysis.fatalUncovered} falha(s) 4x e ${context.analysis.normalUncovered} falha(s) 2x expostas.`;

    return {
      suggestedPokemons: combination.team.map(pokemon => {
        const basicKit = generateBasicKit(pokemon, format);
        return {
          name: pokemon.name,
          kit: {
            nature: pokemon.nature || basicKit.nature,
            role: pokemon.role || basicKit.role,
            ability: pokemon.ability || pokemon.abilities?.[0] || 'Nenhum',
            item: pokemon.item || 'Nenhum',
            moves: pokemon.moves || [],
          },
          nature: pokemon.nature || basicKit.nature,
          role: pokemon.role || basicKit.role,
          ability: pokemon.ability || pokemon.abilities?.[0] || 'Nenhum',
          item: pokemon.item || 'Nenhum',
          moves: pokemon.moves || [],
          battleInsight: this.buildBattleInsight(pokemon, format),
        };
      }),
      fullTeam: combination.context.selectedPokemon.map(pokemon => {
        const basicKit = generateBasicKit(pokemon, format);
        return {
          name: pokemon.name,
          kit: {
            nature: pokemon.nature || basicKit.nature,
            role: pokemon.role || basicKit.role,
            ability: pokemon.ability || pokemon.abilities?.[0] || 'Nenhum',
            item: pokemon.item || 'Nenhum',
            moves: pokemon.moves || [],
          },
          nature: pokemon.nature || basicKit.nature,
          role: pokemon.role || basicKit.role,
          ability: pokemon.ability || pokemon.abilities?.[0] || 'Nenhum',
          item: pokemon.item || 'Nenhum',
          moves: pokemon.moves || [],
          battleInsight: this.buildBattleInsight(pokemon, format),
        };
      }),
      reasoning,
      stats: {
        fatalUncovered: context.analysis.fatalUncovered,
        normalUncovered: context.analysis.normalUncovered,
        totalWeaknesses: context.analysis.totalWeaknesses,
      },
      score: context.score,
      explanations: context.explanations,
      roles: context.analysis.roles,
      speed: context.analysis.speed,
      offensiveCoverage: context.analysis.offensiveCoverage,
      threatAnalysis: context.analysis.threats,
      metaAnalysis: context.analysis.meta,
      coach: context.analysis.coach,
      damageReport: context.analysis.damage,
      aiBuilder: context.analysis.aiBuilder,
      formatIntelligence: context.analysis.formatIntelligence,
      radicalRedGauntlet: context.analysis.radicalRedGauntlet,
      championsRegulation: context.analysis.championsRegulation,
      dataSourceReport: context.analysis.dataSources,
      vgcTeamPlan: context.analysis.vgcTeamPlan,
    };
  }

  private buildBattleInsight(pokemon: PokemonData, format: string): BattleInsight {
    const types = getPokemonTypes(pokemon, format);
    const basicKit = generateBasicKit(pokemon, format);
    const kitRole = pokemon.role || basicKit.role;

    const offers = this.getDefensiveOffers(types);
    const pressures = this.getOffensivePressures(types);
    const risks = this.getDefensiveRisks(types);

    return {
      practicalRole: this.getPracticalRole(kitRole, types),
      offers: offers.slice(0, 5),
      pressures: pressures.slice(0, 5),
      risks: risks.slice(0, 4),
      usageTip: this.getUsageTip(kitRole, offers, pressures, risks),
    };
  }

  private getDefensiveOffers(types: string[]): string[] {
    const offers: string[] = [];

    for (const attackType of Object.keys(TYPE_CHART)) {
      const multiplier = getDamageMultiplier(types, attackType);

      if (multiplier === 0) {
        offers.push(`Entra gratuitamente contra golpes ${attackType}`);
      } else if (multiplier <= 0.25) {
        offers.push(`Absorve muito bem golpes ${attackType}`);
      } else if (multiplier <= 0.5) {
        offers.push(`Resiste a golpes ${attackType}`);
      }
    }

    return offers;
  }

  private getOffensivePressures(types: string[]): string[] {
    const pressures = new Set<string>();

    for (const attackType of types) {
      const resolvedAttackType = this.resolveTypeKey(attackType);

      if (!resolvedAttackType) continue;

      for (const defendingType of Object.keys(TYPE_CHART)) {
        const multiplier = TYPE_CHART[resolvedAttackType]?.[defendingType] ?? 1;

        if (multiplier > 1) {
          pressures.add(`Pressiona tipos ${defendingType} com STAB ${resolvedAttackType}`);
        }
      }
    }

    return [...pressures];
  }

  private getDefensiveRisks(types: string[]): string[] {
    const risks: string[] = [];

    for (const attackType of Object.keys(TYPE_CHART)) {
      const multiplier = getDamageMultiplier(types, attackType);

      if (multiplier >= 4) {
        risks.push(`Evite exposição direta a golpes ${attackType} (4x)`);
      } else if (multiplier >= 2) {
        risks.push(`Cuidado com golpes ${attackType}`);
      }
    }

    return risks;
  }

  private getPracticalRole(kitRole: string, types: string[]): string {
    if (kitRole.includes('Barreira Física')) return 'Entrada defensiva física';
    if (kitRole.includes('Barreira Especial')) return 'Entrada defensiva especial';
    if (kitRole.includes('Atacante') && kitRole.includes('Rápido')) return 'Revenge killer / pressão rápida';
    if (kitRole.includes('Demolidor')) return 'Wallbreaker para abrir caminho';
    if (kitRole.includes('Suporte')) return 'Pivot de suporte e estabilização';

    if (types.includes('Steel')) return 'Peça defensiva de resistência';
    if (types.includes('Flying')) return 'Pivot com imunidade a Ground';
    if (types.includes('Ghost')) return 'Spinblocker e pressão utilitária';

    return 'Peça flexível de composição';
  }

  private getUsageTip(
    kitRole: string,
    offers: string[],
    pressures: string[],
    risks: string[],
  ): string {
    if (kitRole.includes('Barreira Física') || kitRole.includes('Barreira Especial')) {
      return offers.length > 0
        ? 'Use como entrada segura contra os tipos listados, preservando HP para manter estabilidade defensiva ao longo da partida.'
        : 'Use para absorver dano e estabilizar a partida, evitando trocas diretas contra seus tipos de risco.';
    }

    if (kitRole.includes('Atacante') && kitRole.includes('Rápido')) {
      return pressures.length > 0
        ? 'Use para finalizar alvos enfraquecidos, pressionar matchups favoráveis e recuperar ritmo quando o adversário estiver vulnerável.'
        : 'Use como peça de velocidade para controlar o ritmo e ameaçar Pokémon fragilizados.';
    }

    if (kitRole.includes('Demolidor')) {
      return 'Use para quebrar núcleos defensivos. Evite entrar diretamente em ataques fortes; traga-o por troca segura ou após um nocaute.';
    }

    if (kitRole.includes('Suporte')) {
      return offers.length > 0
        ? 'Use como pivô para entrar em golpes resistidos e criar oportunidades para seus atacantes principais.'
        : 'Use como peça de transição para manter momentum e proteger os membros mais frágeis do time.';
    }

    if (risks.length > 0) {
      return 'Use em matchups favoráveis e evite deixá-lo exposto aos tipos de risco listados.';
    }

    return 'Use como peça flexível para cobrir lacunas do time e criar pressão conforme o matchup exigir.';
  }

  private resolveTypeKey(type: string): string | undefined {
    return Object.keys(TYPE_CHART).find(
      key => key.toLowerCase() === type.toLowerCase(),
    );
  }
}
