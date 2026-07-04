import type { Locale } from '../../i18n/equinoxI18n';
import { t } from '../../i18n/equinoxI18n';
import type { TeamOption } from '../../types/equinox';

interface ScoreBreakdownViewProps {
  option: TeamOption;
  locale: Locale;
  normalizeScore: (value: number) => number;
  formatScore: (value?: number) => string;
}

export function ScoreBreakdownView({ option, locale, normalizeScore, formatScore }: ScoreBreakdownViewProps) {
  if (!option.score) return <p className="eq-muted-v2">{t(locale, 'noBreakdown')}</p>;

  const rows = [
    [t(locale, 'defense'), option.score.defense],
    [t(locale, 'roles'), option.score.roles],
    [t(locale, 'speed'), option.score.speed],
    [t(locale, 'coverage'), option.score.coverage],
    [t(locale, 'threats'), option.score.threats],
    [t(locale, 'meta'), option.score.meta],
    [t(locale, 'aiDecision'), option.score.cores],
  ];

  return (
    <div className="eq-score-breakdown-v2">
      {rows.map(([label, value]) => {
        const numericValue = Number(value);
        return (
          <div key={label}>
            <span>{label}</span>
            <i><b style={{ width: `${normalizeScore(numericValue)}%` }} /></i>
            <strong>{formatScore(numericValue)}</strong>
          </div>
        );
      })}
    </div>
  );
}
