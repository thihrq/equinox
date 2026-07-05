import { CircleAlert } from 'lucide-react';
import type { Locale } from '../../i18n/equinoxI18n';
import { t, translateContent } from '../../i18n/equinoxI18n';
import type { AIBuilderAnalysis, TeamOption } from '../../types/equinox';

interface AIBuilderDecisionProps {
  option: TeamOption;
  locale: Locale;
}

const getRiskLabel = (analysis: AIBuilderAnalysis, locale: Locale): string => {
  const key = `riskLevel${analysis.riskLevel}`;
  return t(locale, key);
};

const getScoreRows = (analysis: AIBuilderAnalysis, locale: Locale) => {
  const rows: Array<[string, number]> = [
    [t(locale, 'defense'), analysis.scores.defense],
    [t(locale, 'coverage'), analysis.scores.offense],
    [t(locale, 'roles'), analysis.scores.roles],
    [t(locale, 'speed'), analysis.scores.speed],
    [t(locale, 'threats'), analysis.scores.threats],
    [t(locale, 'matchups'), analysis.scores.matchups],
    [t(locale, 'metaFit'), analysis.scores.metaFit],
  ];

  if (analysis.scores.gauntletFit !== undefined) {
    rows.push([t(locale, 'gauntletFit'), analysis.scores.gauntletFit]);
  }

  if (analysis.scores.regulationFit !== undefined) {
    rows.push([t(locale, 'regulationFit'), analysis.scores.regulationFit]);
  }

  return rows;
};

export function AIBuilderDecision({ option, locale }: AIBuilderDecisionProps) {
  const analysis = option.aiBuilder;

  if (!analysis) {
    return <p className="eq-muted-text">{t(locale, 'noAIBuilder')}</p>;
  }

  return (
    <section className="eq-ai-builder-panel">
      <div className="eq-ai-builder-overview">
        <div>
          <span>{t(locale, 'profile')}</span>
          <strong>{translateContent(analysis.profile.name, locale)}</strong>
          <p>{translateContent(analysis.profile.summary, locale)}</p>
        </div>

        <div className="eq-ai-builder-metrics">
          <Metric label={t(locale, 'aiScore')} value={`${analysis.scores.total}%`} tooltip={t(locale, 'aiScoreTooltip')} />
          <Metric label={t(locale, 'decisionConfidence')} value={`${analysis.confidence}%`} tooltip={t(locale, 'decisionConfidenceTooltip')} />
          <Metric label={t(locale, 'riskLevel')} value={getRiskLabel(analysis, locale)} tooltip={t(locale, 'riskLevelTooltip')} />
        </div>
      </div>

      <div className="eq-ai-builder-tags" aria-label={t(locale, 'playstyleTags')}>
        {analysis.playstyleTags.map(tag => (
          <span key={tag}>{translateContent(tag, locale)}</span>
        ))}
      </div>

      <div className="eq-ai-builder-grid">
        <ListBlock title={t(locale, 'strengths')} items={analysis.strengths} locale={locale} />
        <ListBlock title={t(locale, 'concerns')} items={analysis.concerns} locale={locale} />
        <ListBlock title={t(locale, 'priorities')} items={analysis.priorities} locale={locale} />
      </div>

      <div className="eq-ai-score-grid">
        {getScoreRows(analysis, locale).map(([label, score]) => (
          <div key={label}>
            <span>{label}</span>
            <i><b style={{ width: `${Number(score)}%` }} /></i>
            <strong>{score}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
  return (
    <article className={tooltip ? 'eq-metric-with-info' : undefined}>
      <span>{label}</span>
      {tooltip && (
        <button className="eq-metric-info" type="button" aria-label={`${label}: ${tooltip}`}>
          <CircleAlert size={14} strokeWidth={2.1} />
          <span className="eq-metric-tooltip" role="tooltip">{tooltip}</span>
        </button>
      )}
      <strong>{value}</strong>
    </article>
  );
}

function ListBlock({ title, items, locale }: { title: string; items: string[]; locale: Locale }) {
  return (
    <article className="eq-ai-list-block">
      <strong>{title}</strong>
      <ul>
        {items.map(item => (
          <li key={item}>{translateContent(item, locale)}</li>
        ))}
      </ul>
    </article>
  );
}
