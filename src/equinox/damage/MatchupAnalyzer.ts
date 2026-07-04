import { TYPE_CHART } from '../../utils/TypeChart';
import { PokemonData } from '../core/AnalysisContext';
import { getDamageMultiplier } from '../utils/DamageMultiplier';
import { getPokemonTypes, getVariant } from '../utils/PokemonUtils';
import { Threat } from '../threats/Threat';
import {
  DamageMatchupReport,
  MatchupLevel,
  PokemonMatchupAnswer,
} from './DamageReport';

interface AnalyzeMatchupParams {
  team: PokemonData[];
  threat: Threat;
  format: string;
  hasSpeedControl: boolean;
}

interface RoleProfile {
  roles: string[];
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export class MatchupAnalyzer {
  public analyzeThreatMatchup(params: AnalyzeMatchupParams): DamageMatchupReport {
    const { team, threat, format, hasSpeedControl } = params;

    const answers = team
      .map(pokemon => this.analyzePokemonAnswer(pokemon, threat, format, hasSpeedControl))
      .sort((a, b) => b.score - a.score);

    const bestAnswer = answers[0] ?? this.createFallbackAnswer(threat);
    const alternatives = answers.slice(1, 4);

    return {
      threat,
      bestAnswer,
      alternativeAnswers: alternatives,
      matchupScore: bestAnswer.score,
      confidence: bestAnswer.confidence,
      level: bestAnswer.level,
      reasons: bestAnswer.reasons.slice(0, 4),
      warnings: bestAnswer.warnings.slice(0, 3),
    };
  }

  private analyzePokemonAnswer(
    pokemon: PokemonData,
    threat: Threat,
    format: string,
    hasSpeedControl: boolean,
  ): PokemonMatchupAnswer {
    const profile = this.getRoleProfile(pokemon, format);
    const pokemonTypes = getPokemonTypes(pokemon, format);

    const defensive = this.calculateDefensiveScore(pokemon.name, pokemonTypes, threat);
    const offensive = this.calculateOffensivePressure(pokemon.name, pokemonTypes, threat);
    const speed = this.calculateSpeedAdvantage(pokemon.name, profile.spe, threat, hasSpeedControl);
    const role = this.calculateRoleCompatibility(pokemon.name, profile, threat);
    const riskPenalty = this.calculateRiskPenalty(defensive.rawMultiplier, threat);

    const rawScore = 50 + defensive.score + offensive.score + speed.score + role.score - riskPenalty.score;
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    const reasons = [
      ...defensive.reasons,
      ...offensive.reasons,
      ...speed.reasons,
      ...role.reasons,
    ];

    const warnings = [
      ...defensive.warnings,
      ...offensive.warnings,
      ...speed.warnings,
      ...riskPenalty.warnings,
    ];

    return {
      pokemon: pokemon.name,
      score,
      confidence: this.calculateConfidence(score, reasons.length, warnings.length, threat.importance),
      level: this.getMatchupLevel(score),
      reasons: this.dedupe(reasons).slice(0, 5),
      warnings: this.dedupe(warnings).slice(0, 4),
      defensiveScore: defensive.score,
      offensivePressure: offensive.score,
      speedAdvantage: speed.score,
      roleCompatibility: role.score,
      riskPenalty: riskPenalty.score,
    };
  }

  private calculateDefensiveScore(pokemonName: string, pokemonTypes: string[], threat: Threat) {
    let score = 0;
    const reasons: string[] = [];
    const warnings: string[] = [];

    const multipliers = threat.types.map(type => getDamageMultiplier(pokemonTypes, type));
    const maxMultiplier = Math.max(...multipliers);
    const minMultiplier = Math.min(...multipliers);

    if (maxMultiplier === 0) {
      score += 34;
      reasons.push(`${pokemonName} is immune to ${threat.name}'s main STAB pressure`);
    } else if (maxMultiplier <= 0.5) {
      score += 30;
      reasons.push(`${pokemonName} resists ${threat.name}'s main STAB pressure`);
    } else if (minMultiplier === 0) {
      score += 22;
      reasons.push(`${pokemonName} has an immunity against part of ${threat.name}'s pressure`);
    } else if (minMultiplier <= 0.5) {
      score += 14;
      reasons.push(`${pokemonName} resists part of ${threat.name}'s pressure`);
    }

    if (maxMultiplier >= 4) {
      score -= 28;
      warnings.push(`${pokemonName} has a severe weakness to ${threat.name}'s STAB pressure`);
    } else if (maxMultiplier >= 2) {
      score -= 16;
      warnings.push(`${pokemonName} is vulnerable to ${threat.name}'s STAB pressure`);
    }

    if (score === 0 && warnings.length === 0) {
      reasons.push(`${pokemonName} has a neutral defensive matchup into ${threat.name}`);
    }

    return { score, reasons, warnings, rawMultiplier: maxMultiplier };
  }

  private calculateOffensivePressure(pokemonName: string, pokemonTypes: string[], threat: Threat) {
    let score = 0;
    const reasons: string[] = [];
    const warnings: string[] = [];

    const bestAttack = pokemonTypes
      .map(type => ({ type, multiplier: this.getAttackIntoThreatMultiplier(type, threat.types) }))
      .sort((a, b) => b.multiplier - a.multiplier)[0];

    if (bestAttack && bestAttack.multiplier >= 4) {
      score += 30;
      reasons.push(`${pokemonName} strongly pressures ${threat.name} with ${bestAttack.type} STAB`);
    } else if (bestAttack && bestAttack.multiplier > 1) {
      score += 20;
      reasons.push(`${pokemonName} pressures ${threat.name} super effectively with ${bestAttack.type} STAB`);
    } else if (bestAttack && bestAttack.multiplier === 1) {
      score += 4;
      reasons.push(`${pokemonName} can apply neutral pressure to ${threat.name}`);
    } else {
      score -= 8;
      warnings.push(`${pokemonName} does not clearly pressure ${threat.name} offensively`);
    }

    return { score, reasons, warnings };
  }

  private calculateSpeedAdvantage(
    pokemonName: string,
    pokemonSpeed: number,
    threat: Threat,
    hasSpeedControl: boolean,
  ) {
    let score = 0;
    const reasons: string[] = [];
    const warnings: string[] = [];

    if (pokemonSpeed > threat.baseSpeed) {
      score += 14;
      reasons.push(`${pokemonName} naturally outspeeds ${threat.name}`);
    } else if (pokemonSpeed + 15 >= threat.baseSpeed) {
      score += 6;
      reasons.push(`${pokemonName} is close enough in speed to contest ${threat.name}`);
    }

    if (hasSpeedControl) {
      score += 6;
      reasons.push('Team speed control improves this matchup');
    }

    if (threat.baseSpeed >= 110 && pokemonSpeed <= threat.baseSpeed && !hasSpeedControl) {
      score -= 10;
      warnings.push(`${threat.name} can outspeed this answer without speed control`);
    }

    return { score, reasons, warnings };
  }

  private calculateRoleCompatibility(pokemonName: string, profile: RoleProfile, threat: Threat) {
    let score = 0;
    const reasons: string[] = [];

    if (threat.category === 'Physical') {
      if (profile.roles.includes('Physical Wall') || profile.def >= 105 || (profile.hp >= 90 && profile.def >= 90)) {
        score += 14;
        reasons.push(`${pokemonName} has a defensive role compatible with physical pressure`);
      } else if (profile.atk >= 110) {
        score += 7;
        reasons.push(`${pokemonName} can answer physical pressure through offensive tempo`);
      }
    }

    if (threat.category === 'Special') {
      if (profile.roles.includes('Special Wall') || profile.spd >= 105 || (profile.hp >= 90 && profile.spd >= 90)) {
        score += 14;
        reasons.push(`${pokemonName} has a defensive role compatible with special pressure`);
      } else if (profile.spa >= 110) {
        score += 7;
        reasons.push(`${pokemonName} can answer special pressure through offensive tempo`);
      }
    }

    if (threat.category === 'Mixed') {
      if (profile.hp >= 90 && (profile.def >= 90 || profile.spd >= 90)) {
        score += 10;
        reasons.push(`${pokemonName} has enough bulk to contest mixed pressure`);
      }

      if (profile.atk >= 110 || profile.spa >= 110) {
        score += 8;
        reasons.push(`${pokemonName} can pressure mixed threats before they snowball`);
      }
    }

    return { score, reasons };
  }

  private calculateRiskPenalty(maxStabMultiplier: number, threat: Threat) {
    let score = 0;
    const warnings: string[] = [];

    if (threat.tags.some(tag => /setup|swords dance|late game/i.test(tag))) {
      score += 6;
      warnings.push(`Avoid giving ${threat.name} free setup momentum`);
    }

    if (threat.importance >= 95 && maxStabMultiplier >= 2) {
      score += 8;
      warnings.push(`${threat.name} is a high-priority threat, avoid risky direct switches`);
    }

    return { score, warnings };
  }

  private getRoleProfile(pokemon: PokemonData, format: string): RoleProfile {
    const stats = getVariant(pokemon, format)?.baseStats ?? {};
    const hp = Number(stats.hp ?? 0);
    const atk = Number(stats.atk ?? 0);
    const def = Number(stats.def ?? 0);
    const spa = Number(stats.spa ?? 0);
    const spd = Number(stats.spd ?? 0);
    const spe = Number(stats.spe ?? 0);

    const roles = new Set<string>(pokemon.competitive?.roles ?? []);

    if (hp >= 80 && def >= 100) roles.add('Physical Wall');
    if (hp >= 80 && spd >= 100) roles.add('Special Wall');
    if (atk >= 110 || spa >= 110) roles.add('Wallbreaker');
    if (spe >= 100) roles.add('Speed Control');

    return {
      roles: [...roles],
      hp,
      atk,
      def,
      spa,
      spd,
      spe,
    };
  }

  private getAttackIntoThreatMultiplier(attackType: string, threatTypes: string[]): number {
    const resolvedAttackType = Object.keys(TYPE_CHART).find(
      type => type.toLowerCase() === attackType.toLowerCase(),
    );

    if (!resolvedAttackType) return 1;

    return threatTypes.reduce((multiplier, defendingType) => {
      const defendingKeys = Object.keys(TYPE_CHART[resolvedAttackType] ?? {});
      const resolvedDefendingType = defendingKeys.find(
        type => type.toLowerCase() === defendingType.toLowerCase(),
      );

      if (!resolvedDefendingType) return multiplier;

      return multiplier * (TYPE_CHART[resolvedAttackType][resolvedDefendingType] ?? 1);
    }, 1);
  }

  private calculateConfidence(score: number, reasonsCount: number, warningsCount: number, importance: number): number {
    const distanceFromNeutral = Math.abs(score - 50);
    const confidence = 54 + (distanceFromNeutral * 0.48) + (reasonsCount * 3) - (warningsCount * 4) + ((importance - 80) * 0.15);

    return Math.max(35, Math.min(98, Math.round(confidence)));
  }

  private getMatchupLevel(score: number): MatchupLevel {
    if (score >= 90) return 'Dominant';
    if (score >= 75) return 'Favorable';
    if (score >= 58) return 'Playable';
    if (score >= 42) return 'Risky';
    return 'Dangerous';
  }

  private createFallbackAnswer(threat: Threat): PokemonMatchupAnswer {
    return {
      pokemon: '—',
      score: 0,
      confidence: 35,
      level: 'Dangerous',
      reasons: [],
      warnings: [`No clear answer found for ${threat.name}`],
      defensiveScore: 0,
      offensivePressure: 0,
      speedAdvantage: 0,
      roleCompatibility: 0,
      riskPenalty: 0,
    };
  }

  private dedupe(values: string[]): string[] {
    return [...new Set(values)];
  }
}
