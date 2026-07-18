import type { Locale } from '../../i18n/equinoxI18n';
import { formatTeamIdentity, t, translateContent } from '../../i18n/equinoxI18n';
import type { TeamOption } from '../../types/equinox';

interface BattlePlanHeroProps {
  option: TeamOption;
  identityLabel: string;
  format: string;
  locale: Locale;
  formatScore: (value?: number) => string;
  formatPercent: (value?: number) => string;
}

const getStarCount = (score?: number) => Math.max(0, Math.min(5, Math.round((score ?? 0) / 25)));



export function BattlePlanHero({ option, identityLabel, format, locale, formatScore, formatPercent }: BattlePlanHeroProps) {
  const threatCoverage = formatPercent((option.threatAnalysis?.averageScore ?? 0) / 100);
  const translatedIdentity = formatTeamIdentity(locale, identityLabel);

  return (
    <section className="eq-battle-plan-hero-compact">
      <div className="eq-battle-hero-header">
        <h2>{locale === 'pt-BR' ? `${t(locale, 'teamPrefix')} ${translatedIdentity}` : `${translatedIdentity} ${t(locale, 'teamSuffix')}`}</h2>
        <span className="eq-battle-hero-stars" aria-label={`${getStarCount(option.score?.total)} / 5`}>
          {'★'.repeat(getStarCount(option.score?.total))}
          <span className="eq-battle-hero-stars--empty">{'★'.repeat(5 - getStarCount(option.score?.total))}</span>
        </span>
      </div>

      <div className="eq-battle-hero-metrics">
        <div className="eq-battle-hero-metric">
          <span>{t(locale, 'overall')}:</span>
          <strong>{formatScore(option.score?.total)}</strong>
        </div>
        <div className="eq-battle-hero-metric">
          <span>{t(locale, 'meta')}:</span>
          <strong>{translateContent(option.metaAnalysis?.name ?? (format === 'radical_red' ? 'Radical Red' : 'Vanilla'), locale)}</strong>
        </div>
        <div className="eq-battle-hero-metric">
          <span>{t(locale, 'threatCoverage')}:</span>
          <strong>{threatCoverage}</strong>
        </div>
        <div className="eq-battle-hero-metric">
          <span>{t(locale, 'speed')}:</span>
          <strong>{translateContent(option.speed?.speedProfile ?? '—', locale)}</strong>
        </div>
      </div>
    </section>
  );
}


