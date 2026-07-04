import type { Locale } from '../../i18n/equinoxI18n';
import { t, translateContent } from '../../i18n/equinoxI18n';
import type { EquinoxDataSourceEntry, EquinoxDataSourceStatus, TeamOption } from '../../types/equinox';

interface DataSourcePanelProps {
  option: TeamOption;
  locale: Locale;
}

const formatScore = (value?: number): string => `${Math.round(value ?? 0)}%`;

function statusLabel(locale: Locale, status?: EquinoxDataSourceStatus): string {
  switch (status) {
    case 'verified':
      return t(locale, 'dataSourceVerified');
    case 'community':
      return t(locale, 'dataSourceCommunity');
    case 'bootstrap':
      return t(locale, 'dataSourceBootstrap');
    case 'pending':
      return t(locale, 'dataSourcePending');
    case 'outdated':
      return t(locale, 'dataSourceOutdated');
    case 'unknown':
    default:
      return t(locale, 'dataSourceUnknown');
  }
}

function categoryLabel(locale: Locale, category?: string): string {
  switch (category) {
    case 'format':
      return t(locale, 'dataSourceCategoryFormat');
    case 'vanilla_pool':
      return t(locale, 'dataSourceCategoryVanillaPool');
    case 'boss_gauntlet':
      return t(locale, 'dataSourceCategoryBossGauntlet');
    case 'regulation':
      return t(locale, 'dataSourceCategoryRegulation');
    case 'roster':
      return t(locale, 'dataSourceCategoryRoster');
    case 'meta':
      return t(locale, 'dataSourceCategoryMeta');
    default:
      return t(locale, 'dataSourceCategoryFormat');
  }
}

export function DataSourcePanel({ option, locale }: DataSourcePanelProps) {
  const report = option.dataSourceReport;

  if (!report) {
    return <p className="eq-muted-text">{t(locale, 'noDataSourceReport')}</p>;
  }

  return (
    <section className="eq-data-source-panel">
      <div className="eq-data-source-hero">
        <div>
          <span>{t(locale, 'dataSourceOverview')}</span>
          <strong>{statusLabel(locale, report.overallStatus)}</strong>
          <p>{t(locale, 'dataSourceOverviewText')}</p>
        </div>
        <div className="eq-data-source-confidence">
          <span>{t(locale, 'dataSourceConfidence')}</span>
          <strong>{formatScore(report.confidence)}</strong>
        </div>
      </div>

      {report.criticalWarnings.length > 0 && (
        <div className="eq-data-source-warning" role="note">
          {report.criticalWarnings.slice(0, 4).map(warning => (
            <p key={warning}>{translateContent(warning, locale)}</p>
          ))}
        </div>
      )}

      <div className="eq-data-source-grid">
        {report.entries.map(entry => (
          <DataSourceCard key={entry.id} entry={entry} locale={locale} />
        ))}
      </div>

      <div className="eq-data-source-checklist">
        <strong>{t(locale, 'dataSourceChecklist')}</strong>
        <ul>
          {report.updateChecklist.map(item => (
            <li key={item}>{translateContent(item, locale)}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function DataSourceCard({ entry, locale }: { entry: EquinoxDataSourceEntry; locale: Locale }) {
  const externalLabel = t(locale, 'openSource');

  return (
    <article className={`eq-data-source-card is-${entry.severity}`}>
      <div className="eq-data-source-card__head">
        <div>
          <span>{categoryLabel(locale, entry.category)}</span>
          <strong>{translateContent(entry.title, locale)}</strong>
        </div>
        <em>{statusLabel(locale, entry.status)}</em>
      </div>

      <dl>
        <div>
          <dt>{t(locale, 'dataSourceScope')}</dt>
          <dd>{translateContent(entry.scope, locale)}</dd>
        </div>
        {entry.version && (
          <div>
            <dt>{t(locale, 'formatDataVersion')}</dt>
            <dd>{translateContent(entry.version, locale)}</dd>
          </div>
        )}
        <div>
          <dt>{t(locale, 'formatDataSource')}</dt>
          <dd>
            {entry.sourceUrl ? (
              <a href={entry.sourceUrl} target="_blank" rel="noreferrer">{translateContent(entry.sourceName, locale)} · {externalLabel}</a>
            ) : (
              translateContent(entry.sourceName, locale)
            )}
          </dd>
        </div>
        {entry.sourceUpdatedAt && (
          <div>
            <dt>{t(locale, 'dataSourceUpdatedAt')}</dt>
            <dd>{entry.sourceUpdatedAt}</dd>
          </div>
        )}
      </dl>

      {entry.warnings.length > 0 && (
        <ul className="eq-data-source-card__warnings">
          {entry.warnings.slice(0, 3).map(warning => (
            <li key={warning}>{translateContent(warning, locale)}</li>
          ))}
        </ul>
      )}

      <p>{translateContent(entry.refreshPolicy, locale)}</p>
    </article>
  );
}
