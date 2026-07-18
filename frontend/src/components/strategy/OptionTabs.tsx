import { Compass, Shield, Sparkles, Swords, Target } from 'lucide-react';
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
  { title: 'recommended', note: 'recommendedNote', icon: Compass, intent: null },
  { title: 'offensive', note: 'offensiveNote', icon: Swords, intent: 'offensive' },
  { title: 'defensive', note: 'defensiveNote', icon: Shield, intent: 'defensive' },
  { title: 'antiMeta', note: 'antiMetaNote', icon: Target, intent: 'antimeta' },
  { title: 'creative', note: 'creativeNote', icon: Sparkles, intent: 'creative' },
];

export function OptionTabs({ options, selectedIndex, locale, onSelect, formatScore }: OptionTabsProps) {
  return (
    <nav className="eq-option-tabs-v3" aria-label={t(locale, 'suggestedOptions')}>
      {options.map((option, index) => {
        const label = labelKeys[index];
        const title = label ? t(locale, label.title) : `${t(locale, 'optionFallback')} ${index + 1}`;
        const note = label ? t(locale, label.note) : t(locale, 'alternativeComposition');
        const Icon = label?.icon ?? Compass;
        const isActive = selectedIndex === index;
        return (
          <button
            key={`option-${index}`}
            type="button"
            className={isActive ? 'is-active' : ''}
            data-intent={!isActive ? label?.intent ?? undefined : undefined}
            onClick={() => onSelect(index)}
          >
            <span className="eq-option-tab-title">
              <Icon className="eq-option-tab-icon" size={14} aria-hidden="true" />
              {title}
            </span>
            <small>{note}</small>
            <strong>{formatScore(option.score?.total)}</strong>
          </button>
        );
      })}
    </nav>
  );
}
