import {
  DamageMatchupReport,
  DamageReport,
  MatchupLevel,
} from './DamageReport';

export class DamageInterpreter {
  public buildReport(matchups: DamageMatchupReport[]): DamageReport {
    const sorted = [...matchups].sort((a, b) => a.matchupScore - b.matchupScore);

    const averageMatchupScore = sorted.length > 0
      ? Math.round(sorted.reduce((sum, matchup) => sum + matchup.matchupScore, 0) / sorted.length)
      : 0;

    const averageConfidence = sorted.length > 0
      ? Math.round(sorted.reduce((sum, matchup) => sum + matchup.confidence, 0) / sorted.length)
      : 0;

    return {
      averageMatchupScore,
      averageConfidence,
      dominantMatchups: this.filterByLevel(sorted, 'Dominant'),
      favorableMatchups: this.filterByLevel(sorted, 'Favorable'),
      playableMatchups: this.filterByLevel(sorted, 'Playable'),
      riskyMatchups: this.filterByLevel(sorted, 'Risky'),
      dangerousMatchups: this.filterByLevel(sorted, 'Dangerous'),
      matchups: sorted,
    };
  }

  private filterByLevel(matchups: DamageMatchupReport[], level: MatchupLevel): DamageMatchupReport[] {
    return matchups.filter(matchup => matchup.level === level);
  }
}
