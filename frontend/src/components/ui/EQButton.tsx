import type { ButtonHTMLAttributes, ReactNode } from 'react';

type EQButtonVariant = 'primary' | 'secondary' | 'ghost';

interface EQButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: EQButtonVariant;
}

export function EQButton({
  children,
  variant = 'primary',
  className = '',
  ...props
}: EQButtonProps) {
  return (
    <button
      className={['eq-ds-button', `eq-ds-button--${variant}`, className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}
