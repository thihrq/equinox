import { AnalysisContext } from '../core/AnalysisContext';
import {
  AIBuilderAnalysis,
  AIBuilderProfile,
  AIBuilderProfileId,
  AIBuilderRiskLevel,
  AIBuilderScores,
} from './AIBuilderAnalysis';

const clamp = (value: number, min = 0, max = 100): number =>
  Math.max(min, Math.min(max, Math.round(value)));

const average = (values: number[]): number => {
  const validValues = values.filter(value => Number.isFinite(value));

  if (validValues.length === 0) return 0;

  return Math.round(
    validValues.reduce((sum, value) => sum + value, 0) / validValues.length,
  );
};

export class AIBuilderDecisionEngine {
  public analyze(context: AnalysisContext): AIBuilderAnalysis {
    const scores = this.calculateScores(context);
    const profile = this.resolveProfile(context, scores);
    const confidence = this.calculateConfidence(context, scores);
    const riskLevel = this.resolveRiskLevel(context, scores);
    const strengths = this.buildStrengths(context, scores);
    const concerns = this.buildConcerns(context, scores);
    const priorities = this.buildPriorities(context, scores);
    const playstyleTags = this.buildPlaystyleTags(context, profile.id, scores);

    const recommendedLead = context.analysis.coach?.leadSuggestions[0];
    const primaryWinCondition = context.analysis.coach?.winConditions[0]
      ?? context.selectedPokemon.find(pokemon => pokemon.name)?.name;

    return {
      profile,
      confidence,
      decisionScore: this.calculateDecisionScore(scores),
      riskLevel,
      scores,
      strengths,
      concerns,
      priorities,
      playstyleTags,
      recommendedLead,
      primaryWinCondition,
      battlePlanSummary: this.buildBattlePlanSummary({
        profile,
        recommendedLead,
        primaryWinCondition,
        scores,
      }),
    };
  }

  private calculateScores(context: AnalysisContext): AIBuilderScores {
    const defense = clamp(
      100 -
        context.analysis.fatalUncovered * 24 -
        context.analysis.normalUncovered * 11 -
        context.analysis.totalWeaknesses * 3,
    );

    const offense = clamp((context.analysis.offensiveCoverage?.coverageRatio ?? 0) * 100);

    const roles = clamp(
      (context.analysis.roles?.roleCoverageRatio ?? 0) * 100 -
        (context.analysis.roles?.duplicatedRoles.length ?? 0) * 8,
    );

    const speed = this.calculateSpeedScore(context);
    const threats = clamp(context.analysis.threats?.averageScore ?? 50);
    const matchups = clamp(context.analysis.damage?.averageMatchupScore ?? threats);
    const coach = this.calculateCoachScore(context);
    const metaFit = this.calculateMetaFit(context, {
      defense,
      offense,
      roles,
      speed,
      threats,
      matchups,
      coach,
      metaFit: 0,
    });
    const gauntletFit = this.calculateGauntletFit(context, { defense, speed, roles, threats, matchups });
    const regulationFit = this.calculateRegulationFit(context, { defense, speed, roles, threats, matchups, offense });

    const total = average([
      defense * 1.15,
      offense,
      roles,
      speed,
      threats * 1.2,
      matchups * 1.1,
      coach * 0.75,
      metaFit,
      (gauntletFit ?? metaFit) * (gauntletFit !== undefined ? 1.45 : 1),
      (regulationFit ?? metaFit) * (regulationFit !== undefined ? 1.4 : 1),
    ]);

    return {
      defense,
      offense,
      roles,
      speed,
      threats,
      matchups,
      coach,
      metaFit,
      gauntletFit,
      regulationFit,
      total: clamp(total),
    };
  }

  private calculateGauntletFit(
    context: AnalysisContext,
    scores: Pick<AIBuilderScores, 'defense' | 'speed' | 'roles' | 'threats' | 'matchups'>,
  ): number | undefined {
    const gauntlet = context.analysis.radicalRedGauntlet;

    if (!gauntlet) return undefined;

    const criticalPenalty = Math.min(24, gauntlet.criticalThreats.length * 4);

    return clamp(
      average([
        gauntlet.worstBossScore * 1.45,
        gauntlet.averageBossScore,
        gauntlet.consistencyScore * 1.25,
        gauntlet.confidence,
        scores.defense,
        scores.speed * 0.85,
        scores.roles * 0.8,
        scores.threats * 0.75,
        scores.matchups * 0.75,
      ]) - criticalPenalty,
    );
  }

  private calculateRegulationFit(
    context: AnalysisContext,
    scores: Pick<AIBuilderScores, 'defense' | 'speed' | 'roles' | 'threats' | 'matchups' | 'offense'>,
  ): number | undefined {
    const regulation = context.analysis.championsRegulation;

    if (!regulation) return undefined;

    const fieldWeight = regulation.battleStyle === 'doubles' ? 1.35 : 0.7;

    return clamp(
      average([
        regulation.score * 1.45,
        regulation.roleCoverage.threatCoverage * 1.25,
        regulation.roleCoverage.speedControl * 1.2,
        regulation.roleCoverage.roleCompression,
        regulation.roleCoverage.fieldControl * fieldWeight,
        regulation.roleCoverage.megaReadiness * 0.8,
        scores.speed,
        scores.threats,
        scores.matchups,
        scores.offense * 0.75,
      ]),
    );
  }

  private calculateSpeedScore(context: AnalysisContext): number {
    const speed = context.analysis.speed;

    if (!speed) return 50;

    let score = 45;

    score += speed.fastCount * 10;
    score += speed.veryFastCount * 6;
    score -= speed.slowCount * 4;

    if (speed.hasSpeedControl) score += 16;

    if (speed.speedProfile === 'Fast') score += 10;
    if (speed.speedProfile === 'Very Fast') score += 14;
    if (speed.speedProfile === 'Balanced') score += 8;
    if (speed.speedProfile === 'Very Slow') score -= 12;

    return clamp(score);
  }

  private calculateCoachScore(context: AnalysisContext): number {
    const coach = context.analysis.coach;

    if (!coach) return 50;

    let score = 35;

    if (coach.earlyGame.length > 0) score += 10;
    if (coach.midGame.length > 0) score += 10;
    if (coach.lateGame.length > 0) score += 10;
    if (coach.winConditions.length > 0) score += 12;
    if (coach.leadSuggestions.length > 0) score += 8;
    if (coach.switchPatterns.length > 0) score += 8;

    return clamp(score);
  }

  private calculateMetaFit(context: AnalysisContext, scores: Omit<AIBuilderScores, 'total'>): number {
    const formatProfile = context.analysis.formatIntelligence;

    if (formatProfile?.mode === 'boss_gauntlet') {
      const gauntlet = context.analysis.radicalRedGauntlet;

      if (gauntlet) {
        return clamp(
          average([
            gauntlet.worstBossScore * formatProfile.weights.worstMatchup,
            gauntlet.averageBossScore * formatProfile.weights.boss,
            gauntlet.consistencyScore * formatProfile.weights.consistency,
            scores.defense * formatProfile.weights.defense,
            scores.threats * formatProfile.weights.threats,
            scores.speed * formatProfile.weights.speed,
          ]) - gauntlet.criticalThreats.length * 3,
        );
      }

      return clamp(
        average([
          scores.defense * formatProfile.weights.defense,
          scores.threats * formatProfile.weights.threats,
          scores.matchups * formatProfile.weights.worstMatchup,
          scores.speed * formatProfile.weights.speed,
          scores.roles * formatProfile.weights.consistency,
        ]),
      );
    }

    if (formatProfile?.mode === 'live_regulation') {
      const regulation = context.analysis.championsRegulation;

      if (regulation) {
        return clamp(
          average([
            regulation.score * formatProfile.weights.regulation,
            regulation.roleCoverage.threatCoverage * formatProfile.weights.threats,
            regulation.roleCoverage.speedControl * formatProfile.weights.speed,
            regulation.roleCoverage.roleCompression * formatProfile.weights.roles,
            regulation.roleCoverage.fieldControl * formatProfile.weights.consistency,
            scores.offense,
          ]),
        );
      }

      return clamp(
        average([
          scores.speed * formatProfile.weights.speed,
          scores.threats * formatProfile.weights.threats,
          scores.matchups * formatProfile.weights.consistency,
          scores.roles * formatProfile.weights.roles,
          scores.offense,
        ]),
      );
    }

    const weights = context.analysis.meta?.weights;

    if (!weights) {
      return average([
        scores.defense,
        scores.offense,
        scores.roles,
        scores.speed,
        scores.threats,
      ]);
    }

    const weightedSum =
      scores.offense * weights.coverage +
      scores.defense * weights.defense +
      scores.roles * weights.roles +
      scores.speed * weights.speed +
      scores.threats * weights.threats;

    const totalWeight =
      weights.coverage +
      weights.defense +
      weights.roles +
      weights.speed +
      weights.threats;

    return clamp(totalWeight > 0 ? weightedSum / totalWeight : 50);
  }

  private resolveProfile(context: AnalysisContext, scores: AIBuilderScores): AIBuilderProfile {
    const profileId = this.resolveProfileId(context, scores);

    const profileMap: Record<AIBuilderProfileId, AIBuilderProfile> = {
      recommended: {
        id: 'recommended',
        name: 'Recommended Core',
        summary: 'Best overall balance between safety, pressure, and execution.',
      },
      offensive: {
        id: 'offensive',
        name: 'Offensive Core',
        summary: 'Prioritizes tempo, pressure, and fast win conditions.',
      },
      defensive: {
        id: 'defensive',
        name: 'Defensive Core',
        summary: 'Prioritizes safety, switch-ins, and long-game stability.',
      },
      anti_meta: {
        id: 'anti_meta',
        name: 'Anti-Meta Core',
        summary: 'Best suited to answer the most relevant threats in the selected meta.',
      },
      creative: {
        id: 'creative',
        name: 'Creative Core',
        summary: 'Keeps identity and flexibility while staying competitively coherent.',
      },
      tempo: {
        id: 'tempo',
        name: 'Tempo Core',
        summary: 'Designed to control speed, force switches, and keep momentum.',
      },
      balanced: {
        id: 'balanced',
        name: 'Balanced Core',
        summary: 'Blends defensive structure, pressure, and reliable execution.',
      },
      gauntlet: {
        id: 'gauntlet',
        name: 'Gauntlet Core',
        summary: 'Optimized for scenario progression, worst-matchup safety, and resource preservation.',
      },
      regulation: {
        id: 'regulation',
        name: 'Regulation Core',
        summary: 'Optimized for a live competitive ruleset with season-sensitive threat assumptions.',
      },
    };

    return profileMap[profileId];
  }

  private resolveProfileId(context: AnalysisContext, scores: AIBuilderScores): AIBuilderProfileId {
    const formatMode = context.analysis.formatIntelligence?.mode;

    if (formatMode === 'boss_gauntlet' && (scores.gauntletFit ?? scores.matchups) >= 58) return 'gauntlet';
    if (formatMode === 'live_regulation' && (scores.regulationFit ?? scores.threats) >= 64) return 'regulation';
    if (context.teamIdentity === 'fun') return 'creative';
    if (scores.threats >= 86 && scores.matchups >= 78) return 'anti_meta';
    if (scores.offense >= 78 && scores.speed >= 75) return 'offensive';
    if (scores.defense >= 82 && scores.roles >= 70) return 'defensive';
    if (scores.speed >= 84) return 'tempo';
    if (scores.total >= 78) return 'recommended';

    return 'balanced';
  }

  private calculateConfidence(context: AnalysisContext, scores: AIBuilderScores): number {
    const damageConfidence = context.analysis.damage?.averageConfidence ?? scores.matchups;
    const threatCertainty = scores.threats;
    const roleCertainty = scores.roles;
    const coachCertainty = scores.coach;
    const gauntletConfidence = context.analysis.radicalRedGauntlet?.confidence;
    const regulationConfidence = context.analysis.championsRegulation?.confidence;

    const penalty =
      (context.analysis.threats?.criticalThreats.length ?? 0) * 6 +
      (context.analysis.threats?.dangerousThreats.length ?? 0) * 3 +
      (context.analysis.radicalRedGauntlet?.criticalThreats.length ?? 0) * 4 +
      (context.analysis.roles?.missingRoles.length ?? 0) * 2;

    return clamp(
      average([damageConfidence, threatCertainty, roleCertainty, coachCertainty, gauntletConfidence ?? 0, regulationConfidence ?? 0].filter(value => value > 0)) - penalty,
      35,
      98,
    );
  }

  private calculateDecisionScore(scores: AIBuilderScores): number {
    return Math.round((scores.total - 65) / 2);
  }

  private resolveRiskLevel(context: AnalysisContext, scores: AIBuilderScores): AIBuilderRiskLevel {
    const critical = context.analysis.threats?.criticalThreats.length ?? 0;
    const dangerous = context.analysis.threats?.dangerousThreats.length ?? 0;
    const riskyDamage = context.analysis.damage?.riskyMatchups.length ?? 0;
    const dangerousDamage = context.analysis.damage?.dangerousMatchups.length ?? 0;
    const gauntlet = context.analysis.radicalRedGauntlet;
    const regulation = context.analysis.championsRegulation;

    if ((gauntlet?.worstBossScore ?? 100) < 44 || (gauntlet?.criticalThreats.length ?? 0) >= 3) return 'High';
    if ((regulation?.score ?? 100) < 52 || (regulation?.roleCoverage.threatCoverage ?? 100) < 50) return 'High';
    if (critical > 0 || dangerousDamage > 2 || scores.defense < 45) return 'High';
    if ((gauntlet?.worstBossScore ?? 100) < 58 || (regulation?.score ?? 100) < 64 || dangerous > 1 || riskyDamage > 3 || scores.total < 65) return 'Medium';

    return 'Low';
  }

  private buildStrengths(context: AnalysisContext, scores: AIBuilderScores): string[] {
    const strengths: string[] = [];

    if (context.analysis.formatIntelligence?.mode === 'boss_gauntlet') strengths.push('Scenario-aware scoring is prioritizing gauntlet consistency over generic meta fit.');
    if ((context.analysis.radicalRedGauntlet?.criticalThreats.length ?? 1) === 0) strengths.push('Radical Red boss gauntlet has no unresolved critical threat in this option.');
    if ((context.analysis.radicalRedGauntlet?.averageBossScore ?? 0) >= 72) strengths.push('The team has favorable average coverage into the Radical Red Elite Four and Champion gauntlet.');
    if (context.analysis.formatIntelligence?.mode === 'live_regulation') strengths.push('The recommendation is using a regulation-aware profile instead of vanilla assumptions.');
    if ((context.analysis.championsRegulation?.score ?? 0) >= 74) strengths.push('Pokémon Champions regulation fit is strong for the selected battle style.');
    if ((context.analysis.championsRegulation?.roleCoverage.fieldControl ?? 0) >= 75) strengths.push('Field-control tools support the current Champions regulation profile.');
    if (scores.threats >= 80) strengths.push('Strong coverage against relevant meta threats.');
    if (scores.matchups >= 80) strengths.push('Damage Lite found reliable matchup answers.');
    if (scores.defense >= 80) strengths.push('Defensive structure is stable and well distributed.');
    if (scores.offense >= 75) strengths.push('Offensive STAB pressure covers many defensive types.');
    if (scores.speed >= 75) strengths.push('Speed profile supports tempo and revenge-kill opportunities.');
    if ((context.analysis.roles?.roleCoverageRatio ?? 0) >= 0.75) strengths.push('Essential competitive roles are mostly covered.');

    if (strengths.length === 0) {
      strengths.push('The team keeps a coherent baseline across the main Equinox engines.');
    }

    return strengths.slice(0, 4);
  }

  private buildConcerns(context: AnalysisContext, scores: AIBuilderScores): string[] {
    const concerns: string[] = [];

    if (context.analysis.formatIntelligence?.warning) {
      concerns.push(context.analysis.formatIntelligence.warning);
    }

    const regulation = context.analysis.championsRegulation;
    if (regulation?.concerns.length) {
      concerns.push(regulation.concerns[0]);
    }

    const gauntlet = context.analysis.radicalRedGauntlet;
    if (gauntlet?.worstBoss && gauntlet.worstBossScore < 58) {
      concerns.push(`Worst Radical Red boss line: ${gauntlet.worstBoss.name} (${gauntlet.worstBossScore}).`);
    }

    if ((gauntlet?.criticalThreats.length ?? 0) > 0) {
      concerns.push(`Radical Red critical boss threat: ${gauntlet?.criticalThreats[0].threat.name}.`);
    }

    if (context.analysis.fatalUncovered > 0) {
      concerns.push('There are still uncovered 4x defensive weaknesses.');
    }

    if (context.analysis.normalUncovered > 2) {
      concerns.push('Several common weaknesses still lack ideal switch-ins.');
    }

    if ((context.analysis.roles?.missingRoles.length ?? 0) > 0) {
      concerns.push(`Missing role: ${context.analysis.roles?.missingRoles[0]}.`);
    }

    if ((context.analysis.threats?.criticalThreats.length ?? 0) > 0) {
      concerns.push(`Critical threat to monitor: ${context.analysis.threats?.criticalThreats[0].threat.name}.`);
    }

    if ((context.analysis.damage?.dangerousMatchups.length ?? 0) > 0) {
      concerns.push(`Dangerous matchup: ${context.analysis.damage?.dangerousMatchups[0].threat.name}.`);
    }

    if (scores.speed < 55) {
      concerns.push('Speed control may be inconsistent into faster teams.');
    }

    if (concerns.length === 0) {
      concerns.push('No major structural warning detected by the current engines.');
    }

    return concerns.slice(0, 4);
  }

  private buildPriorities(context: AnalysisContext, scores: AIBuilderScores): string[] {
    const priorities: string[] = [];
    const lead = context.analysis.coach?.leadSuggestions[0];
    const winCondition = context.analysis.coach?.winConditions[0];

    if (context.analysis.formatIntelligence?.mode === 'boss_gauntlet') priorities.push('Prioritize the worst expected boss matchup over the average matchup score.');
    priorities.push(...(context.analysis.radicalRedGauntlet?.requiredActions.slice(0, 2) ?? []));
    if (context.analysis.formatIntelligence?.mode === 'live_regulation') priorities.push('Re-check the active regulation data before treating this as a season-specific answer.');
    priorities.push(...(context.analysis.championsRegulation?.recommendations.slice(0, 2) ?? []));
    if (lead) priorities.push(`Open with ${lead} when the matchup allows safe tempo.`);
    if (scores.threats < 70) priorities.push('Scout the opposing win condition before committing your main answer.');
    if (scores.defense < 70) priorities.push('Avoid unnecessary trades with your defensive pivots early.');
    if (scores.offense >= 75) priorities.push('Use offensive pressure to prevent the opponent from stabilizing.');
    if (winCondition) priorities.push(`Preserve resources to enable ${winCondition}.`);

    if (priorities.length === 0) {
      priorities.push('Play patiently, preserve the main answers, and convert safe switches into pressure.');
    }

    return priorities.slice(0, 4);
  }

  private buildPlaystyleTags(
    context: AnalysisContext,
    profileId: AIBuilderProfileId,
    scores: AIBuilderScores,
  ): string[] {
    const tags = new Set<string>();

    tags.add(profileId.replace('_', ' '));

    if (scores.speed >= 75) tags.add('tempo');
    if (scores.defense >= 75) tags.add('stable');
    if (scores.offense >= 75) tags.add('pressure');
    if (scores.threats >= 80) tags.add('anti-meta');
    if (context.teamIdentity === 'fun') tags.add('identity');
    if (context.analysis.formatIntelligence?.mode === 'boss_gauntlet') tags.add('gauntlet');
    if (context.analysis.radicalRedGauntlet?.level) tags.add(context.analysis.radicalRedGauntlet.level.toLowerCase());
    if (context.analysis.formatIntelligence?.mode === 'live_regulation') tags.add('regulation');
    if (context.analysis.championsRegulation?.regulationSet) tags.add(`reg ${context.analysis.championsRegulation.regulationSet.toLowerCase()}`);
    if (context.analysis.championsRegulation?.battleStyle) tags.add(context.analysis.championsRegulation.battleStyle);

    return [...tags].slice(0, 5);
  }

  private buildBattlePlanSummary(params: {
    profile: AIBuilderProfile;
    recommendedLead?: string;
    primaryWinCondition?: string;
    scores: AIBuilderScores;
  }): string {
    const { profile, recommendedLead, primaryWinCondition, scores } = params;

    const lead = recommendedLead ?? 'your safest lead';
    const winCondition = primaryWinCondition ?? 'your primary win condition';

    if (profile.id === 'offensive' || scores.offense >= 80) {
      return `Open with ${lead}, force progress with offensive pressure, and preserve tempo until ${winCondition} can close the game.`;
    }

    if (profile.id === 'defensive' || scores.defense >= 85) {
      return `Use ${lead} to stabilize the opening, protect your key switch-ins, and wait until ${winCondition} has a safe closing window.`;
    }

    if (profile.id === 'anti_meta') {
      return `Use ${lead} to scout the opponent's main threat, keep your best answers healthy, and convert the matchup edge into a ${winCondition} endgame.`;
    }

    if (profile.id === 'gauntlet') {
      return `Use ${lead} to preserve resources, avoid unnecessary trades, and keep the best answer healthy for the hardest boss matchup before ${winCondition} closes.`;
    }

    if (profile.id === 'regulation') {
      return `Use ${lead} to test the current regulation tempo, preserve flexible answers, and position ${winCondition} after the opponent's fastest threats are controlled.`;
    }

    return `Open with ${lead}, convert neutral turns into positional advantage, and prepare ${winCondition} to finish once its checks are weakened.`;
  }
}
