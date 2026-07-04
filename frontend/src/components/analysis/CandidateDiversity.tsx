import type { Locale } from '../../i18n/equinoxI18n';
import { t, translateContent } from '../../i18n/equinoxI18n';
import type { CandidateDiversitySummary } from '../../types/equinox';

interface CandidateDiversityProps {
  diversity?: CandidateDiversitySummary;
  locale: Locale;
}

export function CandidateDiversity({ diversity, locale }: CandidateDiversityProps) {
  if (!diversity) return <p className="eq-muted-v2">{t(locale, 'noDiversity')}</p>;

  return (
    <div className="eq-candidate-v2">
      <div className="eq-detail-grid-v2">
        <MetricCard label={t(locale, 'database')} value={String(diversity.rawCandidates)} />
        <MetricCard label={t(locale, 'valid')} value={String(diversity.validCandidates)} />
        <MetricCard label={t(locale, 'scored')} value={String(diversity.scoredCandidates)} />
        <MetricCard label={t(locale, 'diverse')} value={String(diversity.diversifiedCandidates)} />
      </div>

      <div className="eq-candidate-list-v2">
        {diversity.topCandidates.slice(0, 8).map(candidate => (
          <article key={candidate.name}>
            <strong>{candidate.name}</strong>
            <span>{candidate.score}</span>
            <p>{translateContent(candidate.reasons[0], locale) || t(locale, 'diversityReason')}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="eq-metric-card-v2">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
