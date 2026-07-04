import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Locale } from '../../i18n/equinoxI18n';
import { t } from '../../i18n/equinoxI18n';

interface DetailsBlockProps {
  title: string;
  subtitle?: string;
  count?: number;
  locale: Locale;
  children: ReactNode;
}

export function DetailsBlock({ title, subtitle, count, locale, children }: DetailsBlockProps) {
  return (
    <details className="eq-details-block-v3">
      <summary>
        <span>
          <strong>{title}</strong>
          {subtitle && <small>{subtitle}</small>}
        </span>
        <em>{typeof count === 'number' ? count : t(locale, 'see')}</em>
        <ChevronDown size={16} />
      </summary>
      <div>{children}</div>
    </details>
  );
}
