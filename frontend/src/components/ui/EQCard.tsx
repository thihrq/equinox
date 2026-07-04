import type { HTMLAttributes, ReactNode } from 'react';

type EQCardVariant = 'default' | 'soft' | 'strong';

interface EQCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: EQCardVariant;
  interactive?: boolean;
  bodyClassName?: string;
}

export function EQCard({
  children,
  variant = 'default',
  interactive = false,
  className = '',
  bodyClassName = '',
  ...props
}: EQCardProps) {
  const variantClass = variant === 'default' ? '' : `eq-ds-card--${variant}`;
  const interactiveClass = interactive ? 'eq-ds-card--interactive' : '';

  return (
    <section
      className={['eq-ds-card', variantClass, interactiveClass, className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <div className={['eq-ds-card__body', bodyClassName].filter(Boolean).join(' ')}>
        {children}
      </div>
    </section>
  );
}
