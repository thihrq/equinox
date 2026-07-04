import type { Locale } from '../../i18n/equinoxI18n';
import { t, translateContent, translateMatchupLevel } from '../../i18n/equinoxI18n';
import type { DamageMatchupReport, TeamOption } from '../../types/equinox';

interface MatchupAnalysisProps {
  option: TeamOption;
  locale: Locale;
}

export function MatchupAnalysis({ option, locale }: MatchupAnalysisProps) {
  const report = option.damageReport;

  if (!report) {
    return <p className="eq-muted-v2">{t(locale, 'noMatchupAnalysis')}</p>;
  }

  const priorityMatchups = [
    ...report.dangerousMatchups,
    ...report.riskyMatchups,
    ...report.dominantMatchups,
    ...report.favorableMatchups,
    ...report.playableMatchups,
  ].slice(0, 8);

  return (
    <div className="eq-matchup-analysis-v1">
      <div className="eq-matchup-summary-v1">
        <Metric label={t(locale, 'matchupAverage')} value={`${report.averageMatchupScore}/100`} />
        <Metric label={t(locale, 'confidence')} value={`${report.averageConfidence}%`} />
        <Metric label={t(locale, 'riskyMatchups')} value={String(report.riskyMatchups.length + report.dangerousMatchups.length)} />
        <Metric label={t(locale, 'strongAnswers')} value={String(report.dominantMatchups.length + report.favorableMatchups.length)} />
      </div>

      <div className="eq-matchup-grid-v1">
        {priorityMatchups.map(matchup => (
          <MatchupCard key={matchup.threat.name} matchup={matchup} locale={locale} />
        ))}
      </div>
    </div>
  );
}

function MatchupCard({ matchup, locale }: { matchup: DamageMatchupReport; locale: Locale }) {
  const warning = matchup.warnings[0];
  const reason = matchup.reasons[0];

  return (
    <article className={`eq-matchup-card-v1 level-${matchup.level.toLowerCase()}`}>
      <header>
        <span>{translateMatchupLevel(matchup.level, locale)}</span>
        <strong>{matchup.threat.name}</strong>
      </header>

      <div className="eq-matchup-answer-v1">
        <small>{t(locale, 'bestAnswer')}</small>
        <b>{matchup.bestAnswer.pokemon}</b>
      </div>

      <div className="eq-matchup-meter-v1" aria-label={`${t(locale, 'matchupScore')}: ${matchup.matchupScore}`}>
        <i style={{ width: `${matchup.matchupScore}%` }} />
      </div>

      <p>{translateContent(reason, locale) || t(locale, 'matchupAnalyzed')}</p>

      {warning && <em>{translateContent(warning, locale)}</em>}

      <footer>
        <span>{matchup.matchupScore}/100</span>
        <span>{matchup.confidence}% {t(locale, 'confidenceShort')}</span>
      </footer>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="eq-metric-card-v2">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
