import { TYPE_CHART } from '../../utils/TypeChart';
import { PokemonData } from '../core/AnalysisContext';
import { getDamageMultiplier } from '../utils/DamageMultiplier';
import { getPokemonTypes, getVariant } from '../utils/PokemonUtils';
import { Threat, ThreatLevel, ThreatMatchup } from './Threat';

interface AnalyzeThreatParams {
  team: PokemonData[];
  threat: Threat;
  format: string;
  hasSpeedControl: boolean;
  detectedRoles: Record<string, number>;
}

export class ThreatAnalyzer {
  public analyzeThreat(params: AnalyzeThreatParams): ThreatMatchup {
    const { team, threat, format, hasSpeedControl, detectedRoles } = params;

    let score = 50;
    const answers: string[] = [];
    const problems: string[] = [];

    const defensiveProfile = this.analyzeDefensiveAnswers(team, threat, format);
    const offensiveProfile = this.analyzeOffensiveAnswers(team, threat, format);
    const speedProfile = this.analyzeSpeedAnswers(team, threat, format, hasSpeedControl);
    const roleProfile = this.analyzeRoleAnswers(threat, detectedRoles);

    score += defensiveProfile.score;
    score += offensiveProfile.score;
    score += speedProfile.score;
    score += roleProfile.score;

    answers.push(...defensiveProfile.answers);
    answers.push(...offensiveProfile.answers);
    answers.push(...speedProfile.answers);
    answers.push(...roleProfile.answers);

    problems.push(...defensiveProfile.problems);
    problems.push(...offensiveProfile.problems);
    problems.push(...speedProfile.problems);
    problems.push(...roleProfile.problems);

    const weightedScore = this.applyImportancePenalty(score, threat.importance);
    const clampedScore = Math.max(0, Math.min(100, Math.round(weightedScore)));

    return {
      threat,
      score: clampedScore,
      level: this.getThreatLevel(clampedScore),
      answers: this.dedupe(answers).slice(0, 5),
      problems: this.dedupe(problems).slice(0, 5),
    };
  }

  private analyzeDefensiveAnswers(team: PokemonData[], threat: Threat, format: string) {
    let score = 0;
    const answers: string[] = [];
    const problems: string[] = [];

    let immuneSwitchIns = 0;
    let resistantSwitchIns = 0;
    let weakMembers = 0;

    for (const member of team) {
      const memberTypes = getPokemonTypes(member, format);
      const maxStabMultiplier = Math.max(
        ...threat.types.map(attackType => getDamageMultiplier(memberTypes, attackType)),
      );
      const minStabMultiplier = Math.min(
        ...threat.types.map(attackType => getDamageMultiplier(memberTypes, attackType)),
      );

      if (maxStabMultiplier === 0) {
        immuneSwitchIns += 1;
        answers.push(`${member.name} é imune a um STAB de ${threat.name}`);
      } else if (maxStabMultiplier <= 0.5) {
        resistantSwitchIns += 1;
        answers.push(`${member.name} resiste aos STABs principais de ${threat.name}`);
      } else if (minStabMultiplier <= 0.5) {
        resistantSwitchIns += 1;
        answers.push(`${member.name} resiste a parte da pressão de ${threat.name}`);
      }

      if (maxStabMultiplier >= 2) {
        weakMembers += 1;
      }
    }

    if (immuneSwitchIns > 0) score += 24;
    if (resistantSwitchIns > 0) score += 16;
    if (resistantSwitchIns >= 2) score += 8;

    if (immuneSwitchIns === 0 && resistantSwitchIns === 0) {
      score -= 18;
      problems.push(`Sem switch-in resistente claro contra os STABs de ${threat.name}`);
    }

    if (weakMembers >= 3) {
      score -= 14;
      problems.push(`${weakMembers} membros sofrem dano super efetivo dos STABs de ${threat.name}`);
    } else if (weakMembers >= 2) {
      score -= 8;
      problems.push(`${weakMembers} membros são pressionados pelos STABs de ${threat.name}`);
    }

    return { score, answers, problems };
  }

  private analyzeOffensiveAnswers(team: PokemonData[], threat: Threat, format: string) {
    let score = 0;
    const answers: string[] = [];
    const problems: string[] = [];

    const superEffectiveAttackers: string[] = [];

    for (const member of team) {
      const attackTypes = getPokemonTypes(member, format);

      const hasSuperEffectiveStab = attackTypes.some(attackType => {
        const multiplier = this.getAttackIntoThreatMultiplier(attackType, threat.types);
        return multiplier > 1;
      });

      if (hasSuperEffectiveStab) {
        superEffectiveAttackers.push(member.name);
      }
    }

    if (superEffectiveAttackers.length > 0) {
      score += 20;
      answers.push(`${superEffectiveAttackers.slice(0, 3).join(', ')} pressiona(m) ${threat.name} com STAB super efetivo`);
    } else {
      score -= 10;
      problems.push(`Sem STAB super efetivo claro contra ${threat.name}`);
    }

    if (superEffectiveAttackers.length >= 2) {
      score += 8;
      answers.push(`Múltiplas respostas ofensivas contra ${threat.name}`);
    }

    return { score, answers, problems };
  }

  private analyzeSpeedAnswers(
    team: PokemonData[],
    threat: Threat,
    format: string,
    hasSpeedControl: boolean,
  ) {
    let score = 0;
    const answers: string[] = [];
    const problems: string[] = [];

    const fasterMembers = team.filter(member => {
      const speed = Number(getVariant(member, format)?.baseStats?.spe ?? 0);
      return speed > threat.baseSpeed;
    });

    if (fasterMembers.length > 0) {
      score += 12;
      answers.push(`${fasterMembers.slice(0, 3).map(member => member.name).join(', ')} pode(m) ultrapassar ${threat.name}`);
    }

    if (hasSpeedControl) {
      score += 8;
      answers.push('O time possui controle de velocidade para limitar ameaças rápidas');
    }

    if (threat.baseSpeed >= 110 && fasterMembers.length === 0 && !hasSpeedControl) {
      score -= 18;
      problems.push(`${threat.name} é muito rápido e o time não possui resposta clara de velocidade`);
    }

    return { score, answers, problems };
  }

  private analyzeRoleAnswers(threat: Threat, detectedRoles: Record<string, number>) {
    let score = 0;
    const answers: string[] = [];
    const problems: string[] = [];

    if (threat.category === 'Physical') {
      if (detectedRoles['Physical Wall']) {
        score += 12;
        answers.push('O time possui wall física para absorver pressão física');
      } else {
        score -= 8;
        problems.push(`Sem wall física clara contra ${threat.name}`);
      }
    }

    if (threat.category === 'Special') {
      if (detectedRoles['Special Wall']) {
        score += 12;
        answers.push('O time possui wall especial para absorver pressão especial');
      } else {
        score -= 8;
        problems.push(`Sem wall especial clara contra ${threat.name}`);
      }
    }

    if (threat.category === 'Mixed') {
      const hasBothWalls = detectedRoles['Physical Wall'] && detectedRoles['Special Wall'];
      const hasAnyWall = detectedRoles['Physical Wall'] || detectedRoles['Special Wall'];

      if (hasBothWalls) {
        score += 14;
        answers.push('O time possui estrutura defensiva para lidar com ameaça mista');
      } else if (hasAnyWall) {
        score += 6;
        answers.push('O time possui ao menos uma parede defensiva contra ameaça mista');
      } else {
        score -= 10;
        problems.push(`Sem estrutura defensiva clara contra ameaça mista como ${threat.name}`);
      }
    }

    return { score, answers, problems };
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

  private applyImportancePenalty(score: number, importance: number): number {
    const dangerWeight = importance / 100;

    if (score < 55) {
      return score - (10 * dangerWeight);
    }

    return score;
  }

  private getThreatLevel(score: number): ThreatLevel {
    if (score >= 85) return 'Safe';
    if (score >= 70) return 'Good';
    if (score >= 55) return 'Neutral';
    if (score >= 40) return 'Dangerous';
    return 'Critical';
  }

  private dedupe(values: string[]): string[] {
    return [...new Set(values)];
  }
}
