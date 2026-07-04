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

const getStars = (score?: number) => {
  const value = Math.max(0, Math.min(5, Math.round((score ?? 0) / 25)));
  return '★★★★★'.slice(0, value).padEnd(5, '☆');
};

const getReadingTime = (option: TeamOption) => {
  const totalItems =
    (option.coach?.earlyGame.length ?? 0) +
    (option.coach?.midGame.length ?? 0) +
    (option.coach?.lateGame.length ?? 0) +
    (option.coach?.winConditions.length ?? 0);

  return Math.max(18, Math.min(45, totalItems * 4));
};

const getBattlePlanQuote = (option: TeamOption, locale: Locale) => {
  if (option.aiBuilder?.battlePlanSummary) {
    return translateContent(option.aiBuilder.battlePlanSummary, locale);
  }

  const lead = option.coach?.leadSuggestions[0] ?? option.suggestedPokemons[0]?.name ?? 'sua melhor abertura';
  const winCondition = option.coach?.winConditions[0] ?? option.suggestedPokemons[1]?.name ?? 'sua condição de vitória';
  const closer = option.suggestedPokemons[2]?.name ?? winCondition;

  const quote = `Abra com ${lead}, transforme trocas neutras em vantagem posicional e prepare ${closer} para finalizar quando os checks estiverem enfraquecidos.`;
  return translateContent(quote, locale);
};

export function BattlePlanHero({ option, identityLabel, format, locale, formatScore, formatPercent }: BattlePlanHeroProps) {
  const threatCoverage = formatPercent((option.threatAnalysis?.averageScore ?? 0) / 100);
  const translatedIdentity = formatTeamIdentity(locale, identityLabel);

  return (
    <section className="eq-battle-plan-hero">
      <div className="eq-battle-plan-copy">
        <span className="eq-kicker-v2">{t(locale, 'battlePlanEyebrow')}</span>
        <h2>{locale === 'pt-BR' ? `${t(locale, 'teamPrefix')} ${translatedIdentity}` : `${translatedIdentity} ${t(locale, 'teamSuffix')}`}</h2>
        <p className="eq-battle-plan-quote">“{getBattlePlanQuote(option, locale)}”</p>
        <div className="eq-battle-plan-meta">
          <span>{getStars(option.score?.total)}</span>
          <small>≈ {getReadingTime(option)} {t(locale, 'readingTime')}</small>
        </div>
      </div>

      <div className="eq-battle-plan-metrics">
        <Metric label={t(locale, 'overall')} value={formatScore(option.score?.total)} />
        <Metric label={t(locale, 'meta')} value={translateContent(option.metaAnalysis?.name ?? (format === 'radical_red' ? 'Radical Red' : 'Vanilla'), locale)} />
        <Metric label={t(locale, 'threatCoverage')} value={threatCoverage} />
        <Metric label={t(locale, 'speed')} value={translateContent(option.speed?.speedProfile ?? '—', locale)} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="eq-battle-plan-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
