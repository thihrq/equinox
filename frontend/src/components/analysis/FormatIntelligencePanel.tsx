import { t, translateContent, type Locale } from '../../i18n/equinoxI18n';
import type { TeamOption } from '../../types/equinox';

interface FormatIntelligencePanelProps {
  option: TeamOption;
  locale: Locale;
}

function statusLabel(locale: Locale, status?: string): string {
  switch (status) {
    case 'verified':
      return t(locale, 'formatDataVerified');
    case 'community':
      return t(locale, 'formatDataCommunity');
    case 'outdated':
      return t(locale, 'formatDataOutdated');
    case 'unknown':
    default:
      return t(locale, 'formatDataUnknown');
  }
}

function modeLabel(locale: Locale, mode?: string): string {
  switch (mode) {
    case 'generic_balance':
      return t(locale, 'formatModeGeneric');
    case 'meta_ladder':
      return t(locale, 'formatModeMeta');
    case 'boss_gauntlet':
      return t(locale, 'formatModeBoss');
    case 'live_regulation':
      return t(locale, 'formatModeRegulation');
    default:
      return t(locale, 'formatModeGeneric');
  }
}

export function FormatIntelligencePanel({ option, locale }: FormatIntelligencePanelProps) {
  const format = option.formatIntelligence;

  if (!format) {
    return <p className="eq-empty-copy">{t(locale, 'noFormatIntelligence')}</p>;
  }

  const warning = translateContent(format.warning, locale);

  return (
    <div className="eq-format-intelligence">
      <div className="eq-format-intelligence__head">
        <div>
          <span>{t(locale, 'formatIntelligenceActive')}</span>
          <strong>{translateContent(format.label, locale)}</strong>
          <p>{translateContent(format.description, locale)}</p>
        </div>
        <div className={`eq-format-status eq-format-status--${format.dataStatus}`}>
          {statusLabel(locale, format.dataStatus)}
        </div>
      </div>

      <div className="eq-format-intelligence__grid">
        <div>
          <span>{t(locale, 'formatEngineStrategy')}</span>
          <strong>{translateContent(format.engineStrategy, locale)}</strong>
        </div>
        <div>
          <span>{t(locale, 'formatMode')}</span>
          <strong>{modeLabel(locale, format.mode)}</strong>
        </div>
        <div>
          <span>{t(locale, 'formatBattleStyle')}</span>
          <strong>{translateContent(format.battleStyle, locale)}</strong>
        </div>
        <div>
          <span>{t(locale, 'formatDataVersion')}</span>
          <strong>{format.dataVersion}</strong>
        </div>
      </div>

      <div className="eq-format-intelligence__source">
        <span>{t(locale, 'formatDataSource')}</span>
        <strong>{translateContent(format.sourceName, locale)}</strong>
      </div>

      {warning && <div className="eq-format-warning">{warning}</div>}

      <div className="eq-format-tags">
        {format.uiTags.map(tag => (
          <span key={tag}>{translateContent(tag, locale)}</span>
        ))}
      </div>
    </div>
  );
}
