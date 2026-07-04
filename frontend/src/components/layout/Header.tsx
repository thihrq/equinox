import type { ReactNode } from 'react';

interface HeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function Header({ eyebrow, title, subtitle, actions }: HeaderProps) {
  return (
    <header className="eq-ds-header">
      <div>
        {eyebrow ? <p className="eq-ds-header__eyebrow">{eyebrow}</p> : null}
        <h1 className="eq-ds-header__title">{title}</h1>
        {subtitle ? <p className="eq-ds-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </header>
  );
}
