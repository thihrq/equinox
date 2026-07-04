import type { Locale } from '../../i18n/equinoxI18n';
import { t } from '../../i18n/equinoxI18n';
import type { TeamOption } from '../../types/equinox';

interface CoverageSpeedProps {
  option: TeamOption;
  locale: Locale;
  formatPercent: (value?: number) => string;
  formatAverageSpeed: (value?: number) => string;
}

export function CoverageSpeed({ option, locale, formatPercent, formatAverageSpeed }: CoverageSpeedProps) {
  return (
    <div className="eq-detail-grid-v2">
      <MetricCard label={t(locale, 'coverage')} value={formatPercent(option.offensiveCoverage?.coverageRatio)} />
      <MetricCard label="STABs" value={String(option.offensiveCoverage?.uniqueAttackTypes.length ?? 0)} />
      <MetricCard label={t(locale, 'speedAvg')} value={formatAverageSpeed(option.speed?.averageBaseSpeed)} />
      <MetricCard label={t(locale, 'fastest')} value={option.speed?.fastestPokemon?.name ?? '—'} />
      <div className="eq-chip-cloud-v2">
        {(option.offensiveCoverage?.uniqueAttackTypes ?? []).slice(0, 10).map(type => <span key={type}>{type}</span>)}
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
