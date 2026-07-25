import type { Locale } from '../../i18n/equinoxI18n';
import { formatTeamIdentity, t, translateContent } from '../../i18n/equinoxI18n';
import type { TeamOption } from '../../types/equinox';
import { EquinoxMeter } from '../ui/EquinoxMeter';

interface BattlePlanHeroProps {
  option: TeamOption;
  identityLabel: string;
  format: string;
  locale: Locale;
  formatScore: (value?: number) => string;
  formatPercent: (value?: number) => string;
  normalizeScore: (value: number) => number;
}

const getStarCount = (score?: number) => Math.max(0, Math.min(5, Math.round((score ?? 0) / 25)));

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill={filled ? 'var(--eq-accent)' : 'var(--eq-surface-soft)'}
      aria-hidden="true"
    >
      <path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5 6.1 20.6l1.2-6.5L2.5 9.5l6.6-.9z" />
    </svg>
  );
}

export function BattlePlanHero({
  option,
  identityLabel,
  format,
  locale,
  formatScore,
  formatPercent,
  normalizeScore,
}: BattlePlanHeroProps) {
  const translatedIdentity = formatTeamIdentity(locale, identityLabel);
  const stars = getStarCount(option.score?.total);
  const score = option.score;

  // Os campos de ScoreBreakdown já são deltas em torno de zero, e normalizeScore
  // os converte para 0–100 com 50 no equilíbrio — exatamente o que o medidor lê.
  const meters = score
    ? [
        { label: locale === 'pt-BR' ? 'Ameaças do meta' : 'Meta threats', value: normalizeScore(score.threats) },
        { label: locale === 'pt-BR' ? 'Controle de velocidade' : 'Speed control', value: normalizeScore(score.speed) },
        { label: locale === 'pt-BR' ? 'Cobertura ofensiva' : 'Offensive coverage', value: normalizeScore(score.coverage) },
        { label: locale === 'pt-BR' ? 'Resiliência defensiva' : 'Defensive resilience', value: normalizeScore(score.defense) },
      ]
    : [];

  return (
    <section className="eq-battle-plan-hero-compact">
      <div className="eq-battle-hero-header">
        <h2>
          {locale === 'pt-BR'
            ? `${t(locale, 'teamPrefix')} ${translatedIdentity}`
            : `${translatedIdentity} ${t(locale, 'teamSuffix')}`}
        </h2>
        <span className="eq-battle-hero-stars" role="img" aria-label={`${stars} / 5`}>
          {[0, 1, 2, 3, 4].map(index => (
            <Star key={index} filled={index < stars} />
          ))}
        </span>
      </div>

      <div className="eq-battle-hero-metrics">
        <div className="eq-battle-hero-metric">
          <span>{t(locale, 'overall')}:</span>
          <strong>{formatScore(option.score?.total)}</strong>
        </div>
        <div className="eq-battle-hero-metric">
          <span>{t(locale, 'meta')}:</span>
          <strong>
            {translateContent(
              option.metaAnalysis?.name ?? (format === 'radical_red' ? 'Radical Red' : 'Vanilla'),
              locale,
            )}
          </strong>
        </div>
        <div className="eq-battle-hero-metric">
          <span>{t(locale, 'threatCoverage')}:</span>
          <strong>{formatPercent((option.threatAnalysis?.averageScore ?? 0) / 100)}</strong>
        </div>
        <div className="eq-battle-hero-metric">
          <span>{t(locale, 'speed')}:</span>
          <strong>{translateContent(option.speed?.speedProfile ?? '—', locale)}</strong>
        </div>
      </div>

      {meters.length > 0 && (
        <div className="eq-meter-grid">
          {meters.map(meter => (
            <EquinoxMeter key={meter.label} label={meter.label} value={meter.value} locale={locale} />
          ))}
        </div>
      )}
    </section>
  );
}
