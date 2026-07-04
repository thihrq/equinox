import type { HTMLAttributes, ReactNode } from 'react';

interface EQChipProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

export function EQChip({ children, className = '', ...props }: EQChipProps) {
  return (
    <span className={['eq-ds-chip', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </span>
  );
}
