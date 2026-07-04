import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

interface EQAccordionProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function EQAccordion({ title, children, defaultOpen = false }: EQAccordionProps) {
  return (
    <details className="eq-ds-accordion" open={defaultOpen}>
      <summary className="eq-ds-accordion__summary">
        <span>{title}</span>
        <ChevronDown className="eq-ds-accordion__icon" size={16} />
      </summary>
      <div className="eq-ds-accordion__content">{children}</div>
    </details>
  );
}
