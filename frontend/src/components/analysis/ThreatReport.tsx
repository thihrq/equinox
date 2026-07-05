import type { Locale } from '../../i18n/equinoxI18n';
import { t, translateContent, translateThreatLevel } from '../../i18n/equinoxI18n';
import type { TeamOption } from '../../types/equinox';

export function ThreatReport({ option, locale }: { option: TeamOption; locale: Locale }) {
  const analysis = option.threatAnalysis;

  if (!analysis) return <p className="eq-muted-v2">{t(locale, 'noThreatReport')}</p>;

  const importantMatchups = [
    ...analysis.criticalThreats,
    ...analysis.dangerousThreats,
    ...analysis.safeThreats,
    ...analysis.goodThreats,
  ].slice(0, 8);

  return (
    <div className="eq-threat-grid-v2">
      {importantMatchups.map(matchup => (
        <article key={matchup.threat.name}>
          <span>{translateThreatLevel(matchup.level, locale)}</span>
          <strong>{matchup.threat.name}</strong>
          <p>{translateContent(matchup.answers[0] ?? matchup.problems[0], locale) || t(locale, 'matchupAnalyzed')}</p>
          <small>{matchup.score}/100</small>
        </article>
      ))}
    </div>
  );
}
