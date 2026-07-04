import type { Locale } from '../../i18n/equinoxI18n';
import { t, translateContent } from '../../i18n/equinoxI18n';
import type { ExplanationEntry } from '../../types/equinox';

interface ExplanationListProps {
  explanations: ExplanationEntry[];
  locale: Locale;
  formatScore: (value?: number) => string;
}

export function ExplanationList({ explanations, locale, formatScore }: ExplanationListProps) {
  if (!explanations.length) return <p className="eq-muted-v2">{t(locale, 'noTechExplanation')}</p>;

  return (
    <div className="eq-explanations-v2">
      {explanations.map((explanation, index) => (
        <div key={`${explanation.reason}-${index}`}>
          <span>{translateContent(explanation.reason, locale)}</span>
          <strong>{formatScore(explanation.value)}</strong>
        </div>
      ))}
    </div>
  );
}
