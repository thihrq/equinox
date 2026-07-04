import { TYPE_CHART } from '../../utils/TypeChart';
import { AnalysisContext, PokemonData } from '../core/AnalysisContext';
import { AnalysisEngine } from '../core/AnalysisEngine';
import { getDamageMultiplier } from '../utils/DamageMultiplier';
import { getPokemonTypes, getVariant } from '../utils/PokemonUtils';
import { getRadicalRedDataPack } from '../radicalred/RadicalRedBossData';
import {
  RadicalRedBossBattle,
  RadicalRedBossLevel,
  RadicalRedBossPokemon,
  RadicalRedBossReport,
  RadicalRedBossVariant,
  RadicalRedBossVariantReport,
  RadicalRedGauntletAnalysis,
  RadicalRedThreatAnswer,
  RadicalRedThreatReport,
} from '../radicalred/RadicalRedBossProfile';

interface TeamMemberProfile {
  pokemon: PokemonData;
  types: string[];
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
  roles: string[];
}

const clamp = (value: number, min = 0, max = 100): number =>
  Math.max(min, Math.min(max, Math.round(value)));

const average = (values: number[]): number => {
  const validValues = values.filter(value => Number.isFinite(value));

  if (validValues.length === 0) return 0;

  return Math.round(validValues.reduce((sum, value) => sum + value, 0) / validValues.length);
};

export class RadicalRedBossGauntletEngine implements AnalysisEngine {
  public readonly name = 'RadicalRedBossGauntletEngine';

  public execute(context: AnalysisContext): void {
    const formatProfile = context.analysis.formatIntelligence;

    if (formatProfile?.gameFamily !== 'radical_red' || !formatProfile.usesBossData) {
      return;
    }

    const dataPack = getRadicalRedDataPack(context.format);

    if (!dataPack) {
      context.addExplanation({
        engine: this.name,
        reason: 'Radical Red boss data pack not found for the selected format.',
        value: -3,
        impact: 'negative',
      });
      return;
    }

    const teamProfiles = context.selectedPokemon.map(pokemon => this.toTeamMemberProfile(pokemon, context.format));
    const bossReports = dataPack.bosses
      .map(boss => this.analyzeBoss(boss, teamProfiles))
      .sort((a, b) => a.order - b.order);

    const worstBoss = [...bossReports].sort((a, b) => a.score - b.score)[0];
    const averageBossScore = average(bossReports.map(report => report.score));
    const worstBossScore = worstBoss?.score ?? averageBossScore;
    const consistencyScore = clamp((averageBossScore * 0.45) + (worstBossScore * 0.55));
    const criticalThreats = bossReports
      .flatMap(report => report.worstVariant.criticalThreats)
      .sort((a, b) => a.score - b.score)
      .slice(0, 8);

    const analysis: RadicalRedGauntletAnalysis = {
      profileId: dataPack.id,
      label: dataPack.label,
      version: dataPack.version,
      mode: dataPack.mode,
      dataStatus: dataPack.dataStatus,
      dataVersion: dataPack.dataVersion,
      sourceName: dataPack.sourceName,
      sourceUpdatedAt: dataPack.sourceUpdatedAt,
      dataHash: dataPack.dataHash,
      averageBossScore,
      worstBossScore,
      consistencyScore,
      confidence: this.calculateGauntletConfidence(dataPack.dataStatus, bossReports, criticalThreats.length),
      level: this.toLevel(consistencyScore),
      worstBoss,
      bossReports,
      criticalThreats,
      requiredActions: this.buildRequiredActions(worstBoss, criticalThreats, dataPack.warnings),
      warnings: dataPack.warnings,
    };

    context.analysis.radicalRedGauntlet = analysis;
    this.applyScore(context, analysis);
    this.addExplanations(context, analysis);
  }

  private analyzeBoss(
    boss: RadicalRedBossBattle,
    teamProfiles: TeamMemberProfile[],
  ): RadicalRedBossReport {
    const variants = boss.variants
      .map(variant => this.analyzeVariant(variant, teamProfiles))
      .sort((a, b) => a.score - b.score);
    const worstVariant = variants[0] ?? this.createEmptyVariantReport(boss.id);
    const score = worstVariant.score;
    const confidence = average(variants.map(variant => variant.confidence));

    return {
      id: boss.id,
      name: boss.name,
      stage: boss.stage,
      order: boss.order,
      score,
      confidence,
      level: this.toLevel(score),
      notes: boss.notes,
      requiredAnswers: boss.requiredAnswers,
      worstVariant,
      variants,
    };
  }

  private analyzeVariant(
    variant: RadicalRedBossVariant,
    teamProfiles: TeamMemberProfile[],
  ): RadicalRedBossVariantReport {
    const threatReports = variant.pokemon
      .map(threat => this.analyzeThreat(threat, teamProfiles))
      .sort((a, b) => a.score - b.score);
    const worstThreat = threatReports[0];
    const criticalThreats = threatReports.filter(report => report.level === 'Dangerous' || report.level === 'Risky');
    const bestCoveredThreats = [...threatReports]
      .filter(report => report.level === 'Dominant' || report.level === 'Favorable')
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const averageThreatScore = average(threatReports.map(report => report.score));
    const worstThreatScore = worstThreat?.score ?? averageThreatScore;
    const highImportancePenalty = threatReports
      .filter(report => report.threat.importance >= 95 && report.score < 62)
      .length * 4;

    const score = clamp((averageThreatScore * 0.55) + (worstThreatScore * 0.45) - highImportancePenalty);
    const confidence = average(threatReports.map(report => report.confidence));

    return {
      id: variant.id,
      label: variant.label,
      trigger: variant.trigger,
      battleEffect: variant.battleEffect,
      score,
      confidence,
      level: this.toLevel(score),
      criticalThreats,
      bestCoveredThreats,
      worstThreat,
      threatReports,
    };
  }

  private analyzeThreat(
    threat: RadicalRedBossPokemon,
    teamProfiles: TeamMemberProfile[],
  ): RadicalRedThreatReport {
    const answers = teamProfiles
      .map(profile => this.analyzeAnswer(profile, threat))
      .sort((a, b) => b.score - a.score);
    const bestAnswer = answers[0] ?? this.createFallbackAnswer(threat);

    return {
      threat,
      bestAnswer,
      alternativeAnswers: answers.slice(1, 4),
      score: bestAnswer.score,
      confidence: bestAnswer.confidence,
      level: bestAnswer.level,
      reasons: bestAnswer.reasons.slice(0, 4),
      warnings: bestAnswer.warnings.slice(0, 3),
    };
  }

  private analyzeAnswer(profile: TeamMemberProfile, threat: RadicalRedBossPokemon): RadicalRedThreatAnswer {
    const defensive = this.calculateDefensive(profile, threat);
    const offensive = this.calculateOffensive(profile, threat);
    const speed = this.calculateSpeed(profile, threat);
    const role = this.calculateRole(profile, threat);
    const tagPenalty = this.calculateTagPenalty(profile, threat, defensive.maxMultiplier);

    const rawScore = 48 + defensive.score + offensive.score + speed.score + role.score - tagPenalty.score;
    const score = clamp(rawScore);
    const reasons = this.dedupe([...defensive.reasons, ...offensive.reasons, ...speed.reasons, ...role.reasons]);
    const warnings = this.dedupe([...defensive.warnings, ...offensive.warnings, ...speed.warnings, ...tagPenalty.warnings]);

    return {
      pokemon: profile.pokemon.name,
      score,
      confidence: this.calculateAnswerConfidence(score, reasons.length, warnings.length, threat.importance),
      level: this.toLevel(score),
      reasons: reasons.slice(0, 5),
      warnings: warnings.slice(0, 4),
    };
  }

  private calculateDefensive(profile: TeamMemberProfile, threat: RadicalRedBossPokemon) {
    let score = 0;
    const reasons: string[] = [];
    const warnings: string[] = [];
    const multipliers = threat.types.map(type => getDamageMultiplier(profile.types, type));
    const maxMultiplier = multipliers.length > 0 ? Math.max(...multipliers) : 1;
    const minMultiplier = multipliers.length > 0 ? Math.min(...multipliers) : 1;

    if (maxMultiplier === 0) {
      score += 34;
      reasons.push(`${profile.pokemon.name} can fully blank ${threat.name}'s primary STAB pressure.`);
    } else if (maxMultiplier <= 0.5) {
      score += 28;
      reasons.push(`${profile.pokemon.name} resists ${threat.name}'s primary STAB pressure.`);
    } else if (minMultiplier === 0) {
      score += 22;
      reasons.push(`${profile.pokemon.name} has an immunity into part of ${threat.name}'s pressure.`);
    } else if (minMultiplier <= 0.5) {
      score += 14;
      reasons.push(`${profile.pokemon.name} resists part of ${threat.name}'s pressure.`);
    } else {
      score += 2;
      reasons.push(`${profile.pokemon.name} has at least a neutral entry profile into ${threat.name}.`);
    }

    if (maxMultiplier >= 4) {
      score -= 30;
      warnings.push(`${profile.pokemon.name} has a severe weakness into ${threat.name}'s STAB profile.`);
    } else if (maxMultiplier >= 2) {
      score -= 16;
      warnings.push(`${profile.pokemon.name} is vulnerable to ${threat.name}'s STAB profile.`);
    }

    if (threat.category === 'Physical' && profile.hp + profile.def >= 190) {
      score += 8;
      reasons.push(`${profile.pokemon.name} has enough physical bulk for this boss threat.`);
    }

    if (threat.category === 'Special' && profile.hp + profile.spd >= 190) {
      score += 8;
      reasons.push(`${profile.pokemon.name} has enough special bulk for this boss threat.`);
    }

    return { score, reasons, warnings, maxMultiplier };
  }

  private calculateOffensive(profile: TeamMemberProfile, threat: RadicalRedBossPokemon) {
    let score = 0;
    const reasons: string[] = [];
    const warnings: string[] = [];
    const bestAttack = profile.types
      .map(type => ({ type, multiplier: this.getAttackIntoTargetMultiplier(type, threat.types) }))
      .sort((a, b) => b.multiplier - a.multiplier)[0];

    if (bestAttack && bestAttack.multiplier >= 4) {
      score += 28;
      reasons.push(`${profile.pokemon.name} can heavily punish ${threat.name} with ${bestAttack.type} STAB.`);
    } else if (bestAttack && bestAttack.multiplier > 1) {
      score += 18;
      reasons.push(`${profile.pokemon.name} pressures ${threat.name} super effectively with ${bestAttack.type} STAB.`);
    } else if (bestAttack && bestAttack.multiplier === 1) {
      score += 5;
      reasons.push(`${profile.pokemon.name} can apply neutral pressure into ${threat.name}.`);
    } else {
      score -= 8;
      warnings.push(`${profile.pokemon.name} lacks clear STAB pressure into ${threat.name}.`);
    }

    return { score, reasons, warnings };
  }

  private calculateSpeed(profile: TeamMemberProfile, threat: RadicalRedBossPokemon) {
    let score = 0;
    const reasons: string[] = [];
    const warnings: string[] = [];

    if (profile.spe > threat.baseSpeed) {
      score += 13;
      reasons.push(`${profile.pokemon.name} naturally outspeeds ${threat.name}.`);
    } else if (profile.spe + 15 >= threat.baseSpeed) {
      score += 5;
      reasons.push(`${profile.pokemon.name} is close enough in speed to contest ${threat.name}.`);
    }

    if (threat.baseSpeed >= 125 && profile.spe < threat.baseSpeed) {
      score -= 9;
      warnings.push(`${threat.name} is a major speed benchmark for this gauntlet.`);
    }

    if (threat.tags.some(tag => /swift swim|slush rush|booster energy|speed control/i.test(tag)) && profile.spe < threat.baseSpeed + 10) {
      score -= 5;
      warnings.push(`${threat.name} can become faster through its boss tempo tools.`);
    }

    return { score, reasons, warnings };
  }

  private calculateRole(profile: TeamMemberProfile, threat: RadicalRedBossPokemon) {
    let score = 0;
    const reasons: string[] = [];
    const rolesText = profile.roles.join(' ').toLowerCase();

    if (threat.tags.some(tag => /setup|dragon dance|swords dance|calm mind|nasty plot/i.test(tag))) {
      if (/support|pivot|wall|tank|speed/i.test(rolesText)) {
        score += 8;
        reasons.push(`${profile.pokemon.name} brings structure against ${threat.name}'s setup pressure.`);
      } else if (profile.spe > threat.baseSpeed || profile.atk >= 115 || profile.spa >= 115) {
        score += 6;
        reasons.push(`${profile.pokemon.name} can punish ${threat.name} before setup snowballs.`);
      }
    }

    if (threat.tags.some(tag => /hazards|focus sash|taunt/i.test(tag)) && /support|pivot|speed/i.test(rolesText)) {
      score += 5;
      reasons.push(`${profile.pokemon.name} helps manage ${threat.name}'s opening utility.`);
    }

    if (threat.importance >= 97 && (profile.hp + profile.def + profile.spd >= 270 || profile.spe >= 110)) {
      score += 7;
      reasons.push(`${profile.pokemon.name} has a high-value profile for a critical boss threat.`);
    }

    return { score, reasons };
  }

  private calculateTagPenalty(
    profile: TeamMemberProfile,
    threat: RadicalRedBossPokemon,
    maxMultiplier: number,
  ) {
    let score = 0;
    const warnings: string[] = [];

    if (threat.tags.some(tag => /reverse sweep|imposter/i.test(tag))) {
      score += 7;
      warnings.push(`${threat.name} can punish over-boosted win conditions through Imposter/Scarf pressure.`);
    }

    if (threat.tags.some(tag => /shadow tag/i.test(tag)) && maxMultiplier >= 2) {
      score += 8;
      warnings.push(`${profile.pokemon.name} should avoid being trapped by ${threat.name}.`);
    }

    if (threat.tags.some(tag => /weather|swift swim|slush rush/i.test(tag)) && !profile.types.some(type => ['Water', 'Ice', 'Grass', 'Electric'].includes(type))) {
      score += 3;
      warnings.push(`${threat.name} is part of a weather line that may require dedicated tempo control.`);
    }

    return { score, warnings };
  }

  private toTeamMemberProfile(pokemon: PokemonData, format: string): TeamMemberProfile {
    const stats = getVariant(pokemon, format)?.baseStats ?? {};
    const roles = pokemon.competitive?.roles ?? [];

    return {
      pokemon,
      types: getPokemonTypes(pokemon, format),
      hp: Number(stats.hp ?? 80),
      atk: Number(stats.atk ?? 80),
      def: Number(stats.def ?? 80),
      spa: Number(stats.spa ?? 80),
      spd: Number(stats.spd ?? 80),
      spe: Number(stats.spe ?? 80),
      roles,
    };
  }

  private getAttackIntoTargetMultiplier(attackType: string, targetTypes: string[]): number {
    const chartAttackKey = Object.keys(TYPE_CHART).find(
      key => key.toLowerCase() === attackType.toLowerCase(),
    );

    if (!chartAttackKey) return 1;

    return targetTypes.reduce((multiplier, targetType) => {
      const targetKey = Object.keys(TYPE_CHART[chartAttackKey]).find(
        key => key.toLowerCase() === targetType.toLowerCase(),
      );

      return multiplier * (targetKey ? TYPE_CHART[chartAttackKey][targetKey] ?? 1 : 1);
    }, 1);
  }

  private calculateAnswerConfidence(
    score: number,
    reasonCount: number,
    warningCount: number,
    importance: number,
  ): number {
    return clamp(45 + score * 0.4 + reasonCount * 4 - warningCount * 5 - Math.max(0, importance - 94) * 1.5, 25, 96);
  }

  private calculateGauntletConfidence(
    status: string,
    bossReports: RadicalRedBossReport[],
    criticalThreatCount: number,
  ): number {
    const statusBase = status === 'verified' ? 86 : status === 'community' ? 78 : status === 'outdated' ? 58 : 50;
    const bossConfidence = average(bossReports.map(report => report.confidence));

    return clamp((statusBase * 0.45) + (bossConfidence * 0.55) - criticalThreatCount * 2, 30, 96);
  }

  private applyScore(context: AnalysisContext, analysis: RadicalRedGauntletAnalysis): void {
    const gauntletDelta = Math.round((analysis.consistencyScore - 50) / 2);
    const worstBossDelta = Math.round((analysis.worstBossScore - 50) / 3);

    context.score.meta += gauntletDelta;
    context.score.threats += worstBossDelta;
    context.score.cores += Math.round((analysis.confidence - 65) / 5);
  }

  private addExplanations(context: AnalysisContext, analysis: RadicalRedGauntletAnalysis): void {
    context.addExplanation({
      engine: this.name,
      reason: `Radical Red gauntlet profile applied: ${analysis.label}. Worst boss: ${analysis.worstBoss?.name ?? 'unknown'} (${analysis.worstBossScore}).`,
      value: Math.round((analysis.consistencyScore - 50) / 2),
      impact: analysis.consistencyScore >= 65 ? 'positive' : analysis.consistencyScore <= 48 ? 'negative' : 'neutral',
    });

    if (analysis.criticalThreats.length > 0) {
      context.addExplanation({
        engine: this.name,
        reason: `${analysis.criticalThreats.length} Radical Red boss threat(s) still require safer answers.`,
        value: -(analysis.criticalThreats.length * 3),
        impact: 'negative',
      });
    }
  }

  private buildRequiredActions(
    worstBoss: RadicalRedBossReport | undefined,
    criticalThreats: RadicalRedThreatReport[],
    dataWarnings: string[],
  ): string[] {
    const actions: string[] = [];

    if (worstBoss) {
      actions.push(`Prioritize the ${worstBoss.name} line because it is the current worst gauntlet matchup.`);
      actions.push(...worstBoss.requiredAnswers.slice(0, 2));
    }

    for (const threat of criticalThreats.slice(0, 3)) {
      actions.push(`Add or preserve a safer answer into ${threat.threat.name}. Current best answer: ${threat.bestAnswer.pokemon}.`);
    }

    if (dataWarnings.length > 0) {
      actions.push('Revalidate the data pack after Radical Red updates before treating the recommendation as final.');
    }

    return this.dedupe(actions).slice(0, 7);
  }

  private toLevel(score: number): RadicalRedBossLevel {
    if (score >= 84) return 'Dominant';
    if (score >= 72) return 'Favorable';
    if (score >= 58) return 'Playable';
    if (score >= 44) return 'Risky';
    return 'Dangerous';
  }

  private createFallbackAnswer(threat: RadicalRedBossPokemon): RadicalRedThreatAnswer {
    return {
      pokemon: 'No clear answer',
      score: 0,
      confidence: 20,
      level: 'Dangerous',
      reasons: [],
      warnings: [`No available team answer for ${threat.name}.`],
    };
  }

  private createEmptyVariantReport(bossId: string): RadicalRedBossVariantReport {
    return {
      id: `${bossId}_empty`,
      label: 'No variant data',
      score: 0,
      confidence: 0,
      level: 'Dangerous',
      criticalThreats: [],
      bestCoveredThreats: [],
      threatReports: [],
    };
  }

  private dedupe(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
  }
}
