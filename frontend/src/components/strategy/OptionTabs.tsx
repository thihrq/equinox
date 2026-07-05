import type { Locale } from '../../i18n/equinoxI18n';
import { t } from '../../i18n/equinoxI18n';
import type { TeamOption } from '../../types/equinox';

interface OptionTabsProps {
  options: TeamOption[];
  selectedIndex: number;
  locale: Locale;
  onSelect: (index: number) => void;
  formatScore: (value?: number) => string;
}

const labelKeys = [
  { title: 'recommended', note: 'recommendedNote' },
  { title: 'offensive', note: 'offensiveNote' },
  { title: 'defensive', note: 'defensiveNote' },
  { title: 'antiMeta', note: 'antiMetaNote' },
  { title: 'creative', note: 'creativeNote' },
];

export function OptionTabs({ options, selectedIndex, locale, onSelect, formatScore }: OptionTabsProps) {
  return (
    <nav className="eq-option-tabs-v3" aria-label={t(locale, 'suggestedOptions')}>
      {options.map((option, index) => {
        const label = labelKeys[index];
        const title = label ? t(locale, label.title) : `${t(locale, 'optionFallback')} ${index + 1}`;
        const note = label ? t(locale, label.note) : t(locale, 'alternativeComposition');
        return (
          <button
            key={`option-${index}`}
            type="button"
            className={selectedIndex === index ? 'is-active' : ''}
            onClick={() => onSelect(index)}
          >
            <span>{title}</span>
            <small>{note}</small>
            <strong>{formatScore(option.score?.total)}</strong>
          </button>
        );
      })}
    </nav>
  );
}
