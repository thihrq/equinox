import type { HTMLAttributes, ReactNode } from 'react';

type EQBadgeVariant = 'default' | 'strong';

interface EQBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: EQBadgeVariant;
}

export function EQBadge({
  children,
  variant = 'default',
  className = '',
  ...props
}: EQBadgeProps) {
  const variantClass = variant === 'strong' ? 'eq-ds-badge--strong' : '';

  return (
    <span
      className={['eq-ds-badge', variantClass, className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </span>
  );
}
