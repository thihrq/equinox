import { PokemonData } from '../core/AnalysisContext';
import { getDamageMultiplier } from '../utils/DamageMultiplier';
import { getPokemonTypes, getVariant } from '../utils/PokemonUtils';
import { getRadicalRedDataPack } from './RadicalRedBossData';
import { RadicalRedBossPokemon } from './RadicalRedBossProfile';
import { TYPE_CHART } from '../../utils/TypeChart';

export interface RadicalRedQuickScore {
  averageBossScore: number;
  worstBossScore: number;
  consistencyScore: number;
  criticalThreatCount: number;
  totalThreats: number;
}

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
  const valid = values.filter(value => Number.isFinite(value));
  if (valid.length === 0) return 0;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
};

export class RadicalRedGauntletScorer {
  private static readonly maxTeamCacheEntries = 12000;
  private static readonly maxAnswerCacheEntries = 50000;
  private static readonly teamScoreCache = new Map<string, RadicalRedQuickScore>();
  private static readonly answerScoreCache = new Map<string, number>();

  public static getCacheStats(): { teamScores: number; answerScores: number } {
    return {
      teamScores: RadicalRedGauntletScorer.teamScoreCache.size,
      answerScores: RadicalRedGauntletScorer.answerScoreCache.size,
    };
  }

  public isApplicable(format: string): boolean {
    return getRadicalRedDataPack(format) !== undefined;
  }

  public scoreCandidate(params: {
    baseTeam: PokemonData[];
    candidate: PokemonData;
    format: string;
  }): { score: number; reasons: string[] } {
    const withoutCandidate = this.scoreTeam(params.baseTeam, params.format);
    const withCandidate = this.scoreTeam([...params.baseTeam, params.candidate], params.format);
    const improvement =
      (withCandidate.worstBossScore - withoutCandidate.worstBossScore) * 1.35 +
      (withCandidate.consistencyScore - withoutCandidate.consistencyScore) * 0.8 +
      (withoutCandidate.criticalThreatCount - withCandidate.criticalThreatCount) * 10;

    const reasons: string[] = [];

    if (improvement >= 14) {
      reasons.push('Melhora diretamente o pior matchup do Radical Red Hardcore');
    } else if (improvement >= 7) {
      reasons.push('Aumenta consistência contra a gauntlet do Radical Red');
    }

    if (withCandidate.criticalThreatCount < withoutCandidate.criticalThreatCount) {
      reasons.push('Reduz ameaças críticas de boss no Hardcore');
    }

    return {
      score: Math.round(improvement),
      reasons,
    };
  }

  public scoreTeam(team: PokemonData[], format: string): RadicalRedQuickScore {
    const cacheKey = this.getTeamCacheKey(team, format);
    const cached = RadicalRedGauntletScorer.teamScoreCache.get(cacheKey);

    if (cached) {
      return { ...cached };
    }

    const dataPack = getRadicalRedDataPack(format);

    if (!dataPack) {
      return {
        averageBossScore: 50,
        worstBossScore: 50,
        consistencyScore: 50,
        criticalThreatCount: 0,
        totalThreats: 0,
      };
    }

    const profiles = team.map(pokemon => this.toProfile(pokemon, format));
    const bossScores: number[] = [];
    let criticalThreatCount = 0;
    let totalThreats = 0;

    for (const boss of dataPack.bosses) {
      const variantScores: number[] = [];

      for (const variant of boss.variants) {
        const threatScores = variant.pokemon.map(threat => {
          totalThreats++;
          const best = profiles
            .map(profile => this.scoreAnswer(profile, threat))
            .sort((a, b) => b - a)[0] ?? 0;

          if (best < 58 && threat.importance >= 92) {
            criticalThreatCount++;
          }

          return best;
        });

        const avgThreat = average(threatScores);
        const worstThreat = Math.min(...threatScores, avgThreat);
        const highImportancePenalty = variant.pokemon
          .filter((threat, index) => threat.importance >= 96 && (threatScores[index] ?? 0) < 62)
          .length * 5;

        variantScores.push(clamp(avgThreat * 0.5 + worstThreat * 0.5 - highImportancePenalty));
      }

      bossScores.push(Math.min(...variantScores, average(variantScores)));
    }

    const averageBossScore = average(bossScores);
    const worstBossScore = Math.min(...bossScores, averageBossScore);
    const consistencyScore = clamp(worstBossScore * 0.62 + averageBossScore * 0.38 - Math.min(20, criticalThreatCount * 2));

    const result = {
      averageBossScore,
      worstBossScore,
      consistencyScore,
      criticalThreatCount,
      totalThreats,
    };

    this.rememberTeamScore(cacheKey, result);

    return { ...result };
  }

  private scoreAnswer(profile: TeamMemberProfile, threat: RadicalRedBossPokemon): number {
    const cacheKey = this.getAnswerCacheKey(profile, threat);
    const cached = RadicalRedGauntletScorer.answerScoreCache.get(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    const defensive = this.defensiveScore(profile, threat);
    const offensive = this.offensiveScore(profile, threat);
    const speed = this.speedScore(profile, threat);
    const role = this.roleScore(profile, threat);
    const risk = this.riskPenalty(profile, threat, defensive.maxMultiplier);

    const score = clamp(42 + defensive.score + offensive + speed + role - risk);
    this.rememberAnswerScore(cacheKey, score);

    return score;
  }

  private defensiveScore(profile: TeamMemberProfile, threat: RadicalRedBossPokemon): { score: number; maxMultiplier: number } {
    const multipliers = threat.types.map(type => getDamageMultiplier(profile.types, type));
    const maxMultiplier = multipliers.length ? Math.max(...multipliers) : 1;
    const minMultiplier = multipliers.length ? Math.min(...multipliers) : 1;
    let score = 0;

    if (maxMultiplier === 0) score += 34;
    else if (maxMultiplier <= 0.5) score += 27;
    else if (minMultiplier === 0) score += 22;
    else if (minMultiplier <= 0.5) score += 15;
    else score += 3;

    if (maxMultiplier >= 4) score -= 34;
    else if (maxMultiplier >= 2) score -= 18;

    if (threat.category === 'Physical' && profile.hp + profile.def >= 195) score += 10;
    if (threat.category === 'Special' && profile.hp + profile.spd >= 195) score += 10;
    if (threat.category === 'Mixed' && profile.hp + profile.def + profile.spd >= 270) score += 8;

    return { score, maxMultiplier };
  }

  private offensiveScore(profile: TeamMemberProfile, threat: RadicalRedBossPokemon): number {
    const bestStab = profile.types
      .map(type => this.getAttackMultiplier(type, threat.types))
      .sort((a, b) => b - a)[0] ?? 1;
    const bestAttackStat = Math.max(profile.atk, profile.spa);

    let score = 0;

    if (bestStab >= 4) score += 28;
    else if (bestStab >= 2) score += 18;
    else if (bestStab === 1) score += 4;
    else score -= 7;

    if (bestAttackStat >= 125 && bestStab >= 2) score += 8;
    else if (bestAttackStat >= 110 && bestStab >= 1) score += 4;

    return score;
  }

  private speedScore(profile: TeamMemberProfile, threat: RadicalRedBossPokemon): number {
    let score = 0;

    if (profile.spe > threat.baseSpeed) score += 14;
    else if (profile.spe + 15 >= threat.baseSpeed) score += 5;

    if (threat.baseSpeed >= 125 && profile.spe < threat.baseSpeed) score -= 10;
    if (threat.tags.some(tag => /swift swim|slush rush|booster energy|choice scarf|speed control/i.test(tag)) && profile.spe < threat.baseSpeed + 10) score -= 7;

    return score;
  }

  private roleScore(profile: TeamMemberProfile, threat: RadicalRedBossPokemon): number {
    const roles = profile.roles.join(' ').toLowerCase();
    let score = 0;

    if (threat.tags.some(tag => /setup|dragon dance|swords dance|calm mind|nasty plot/i.test(tag))) {
      if (/wall|tank|pivot|support|speed|hazard/i.test(roles)) score += 8;
      if (profile.spe > threat.baseSpeed || profile.atk >= 120 || profile.spa >= 120) score += 6;
    }

    if (threat.tags.some(tag => /focus sash|hazard|taunt|lead/i.test(tag)) && /support|pivot|speed|hazard/i.test(roles)) score += 5;
    if (threat.importance >= 97 && (profile.hp + profile.def + profile.spd >= 280 || profile.spe >= 115)) score += 8;

    return score;
  }

  private riskPenalty(profile: TeamMemberProfile, threat: RadicalRedBossPokemon, maxMultiplier: number): number {
    let penalty = 0;

    if (threat.tags.some(tag => /reverse sweep|imposter/i.test(tag))) penalty += 8;
    if (threat.tags.some(tag => /shadow tag/i.test(tag)) && maxMultiplier >= 2) penalty += 9;
    if (threat.tags.some(tag => /weather|swift swim|slush rush/i.test(tag)) && !profile.types.some(type => ['Water', 'Ice', 'Grass', 'Electric'].includes(type))) penalty += 5;
    if (threat.importance >= 98 && maxMultiplier >= 2) penalty += 8;

    return penalty;
  }

  private toProfile(pokemon: PokemonData, format: string): TeamMemberProfile {
    const variant = getVariant(pokemon, format);
    const stats = variant?.baseStats ?? {};

    return {
      pokemon,
      types: getPokemonTypes(pokemon, format),
      hp: Number(stats.hp ?? 80),
      atk: Number(stats.atk ?? 80),
      def: Number(stats.def ?? 80),
      spa: Number(stats.spa ?? 80),
      spd: Number(stats.spd ?? 80),
      spe: Number(stats.spe ?? 80),
      roles: pokemon.competitive?.roles ?? [],
    };
  }

  private getTeamCacheKey(team: PokemonData[], format: string): string {
    return [
      format,
      ...team
        .map(pokemon => pokemon.name.toLowerCase().trim())
        .sort(),
    ].join('|');
  }

  private getAnswerCacheKey(profile: TeamMemberProfile, threat: RadicalRedBossPokemon): string {
    return [
      profile.pokemon.name.toLowerCase(),
      profile.types.join('/'),
      profile.hp,
      profile.atk,
      profile.def,
      profile.spa,
      profile.spd,
      profile.spe,
      threat.name.toLowerCase(),
      threat.types.join('/'),
      threat.category,
      threat.baseSpeed,
      threat.importance,
      threat.tags.join('/'),
    ].join('|');
  }

  private rememberTeamScore(cacheKey: string, score: RadicalRedQuickScore): void {
    RadicalRedGauntletScorer.teamScoreCache.set(cacheKey, { ...score });
    this.pruneCache(RadicalRedGauntletScorer.teamScoreCache, RadicalRedGauntletScorer.maxTeamCacheEntries);
  }

  private rememberAnswerScore(cacheKey: string, score: number): void {
    RadicalRedGauntletScorer.answerScoreCache.set(cacheKey, score);
    this.pruneCache(RadicalRedGauntletScorer.answerScoreCache, RadicalRedGauntletScorer.maxAnswerCacheEntries);
  }

  private pruneCache<TKey, TValue>(cache: Map<TKey, TValue>, maxEntries: number): void {
    while (cache.size > maxEntries) {
      const oldestKey = cache.keys().next().value;

      if (oldestKey === undefined) {
        return;
      }

      cache.delete(oldestKey);
    }
  }

  private getAttackMultiplier(attackType: string, targetTypes: string[]): number {
    const attackKey = Object.keys(TYPE_CHART).find(key => key.toLowerCase() === attackType.toLowerCase());

    if (!attackKey) return 1;

    return targetTypes.reduce((multiplier, targetType) => {
      const targetKey = Object.keys(TYPE_CHART[attackKey]).find(key => key.toLowerCase() === targetType.toLowerCase());
      return multiplier * (targetKey ? TYPE_CHART[attackKey][targetKey] ?? 1 : 1);
    }, 1);
  }
}
